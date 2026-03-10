import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { stat } from 'node:fs/promises';
import { db } from '../db/index.js';
import { conversations, messages, toolCalls, tokenUsage, compactionEvents, plans, planSteps, ingestedFiles } from '../db/schema.js';
import { eq, and, lte, sql } from 'drizzle-orm';
import type { WebSocketEventPayload, ChangeType } from '@cowboy/shared';
import { discoverJsonlFiles } from './file-discovery.js';
import { parseJsonlFile } from './claude-code-parser.js';
import { normalizeConversation, type NormalizedData } from './normalizer.js';
import { discoverCursorDb } from './cursor-file-discovery.js';
import { parseCursorDb, getBubblesForConversation } from './cursor-parser.js';
import { normalizeCursorConversation } from './cursor-normalizer.js';
import { extractPlans, inferStepCompletion } from './plan-extractor.js';
import { generateId } from './id-generator.js';
import { runDataQualityMigration } from './migration.js';
import { linkSubagents } from './subagent-linker.js';
import { summarizeSubagent } from './subagent-summarizer.js';
import { basename } from 'node:path';
import type { DiscoveredFile, IngestionStats, IngestionStatus } from './types.js';

export interface IngestionPluginOptions {
  basePath?: string;
  autoIngest?: boolean;
  onIngestionComplete?: (events: WebSocketEventPayload[]) => void;
}

/**
 * Snapshot existing DB state for a conversation before the transaction,
 * then compare after to determine what changed.
 */
interface ConversationSnapshot {
  exists: boolean;
  messageCount: number;
  toolCallCount: number;
  tokenUsageCount: number;
  planCount: number;
  status: string | null;
  title: string | null;
  model: string | null;
}

function snapshotConversation(conversationId: string): ConversationSnapshot {
  const existingConv = db.select({
    id: conversations.id,
    status: conversations.status,
    title: conversations.title,
    model: conversations.model,
  }).from(conversations).where(eq(conversations.id, conversationId)).get();

  if (!existingConv) {
    return { exists: false, messageCount: 0, toolCallCount: 0, tokenUsageCount: 0, planCount: 0, status: null, title: null, model: null };
  }

  const [msgCount] = db.select({ count: sql<number>`count(*)` }).from(messages).where(eq(messages.conversationId, conversationId)).all();
  const [tcCount] = db.select({ count: sql<number>`count(*)` }).from(toolCalls).where(eq(toolCalls.conversationId, conversationId)).all();
  const [tuCount] = db.select({ count: sql<number>`count(*)` }).from(tokenUsage).where(eq(tokenUsage.conversationId, conversationId)).all();
  const [plCount] = db.select({ count: sql<number>`count(*)` }).from(plans).where(eq(plans.conversationId, conversationId)).all();

  return {
    exists: true,
    messageCount: msgCount.count,
    toolCallCount: tcCount.count,
    tokenUsageCount: tuCount.count,
    planCount: plCount.count,
    status: existingConv.status,
    title: existingConv.title,
    model: existingConv.model,
  };
}

function trackChanges(
  conversationId: string,
  normalizedData: NormalizedData,
  snapshot: ConversationSnapshot,
  collectedEvents: WebSocketEventPayload[],
): void {
  const now = new Date().toISOString();

  if (!snapshot.exists) {
    // New conversation
    collectedEvents.push({
      type: 'conversation:created',
      conversationId,
      summary: {
        title: normalizedData.conversation.title ?? null,
        agent: normalizedData.conversation.agent,
        project: normalizedData.conversation.project ?? null,
        createdAt: normalizedData.conversation.createdAt,
      },
      timestamp: now,
    });
    return;
  }

  // Existing conversation: compare counts
  const changes: ChangeType[] = [];

  const [newMsgCount] = db.select({ count: sql<number>`count(*)` }).from(messages).where(eq(messages.conversationId, conversationId)).all();
  if (newMsgCount.count > snapshot.messageCount) changes.push('messages-added');

  const [newTcCount] = db.select({ count: sql<number>`count(*)` }).from(toolCalls).where(eq(toolCalls.conversationId, conversationId)).all();
  if (newTcCount.count > snapshot.toolCallCount) changes.push('tool-calls-added');

  const [newTuCount] = db.select({ count: sql<number>`count(*)` }).from(tokenUsage).where(eq(tokenUsage.conversationId, conversationId)).all();
  if (newTuCount.count > snapshot.tokenUsageCount) changes.push('tokens-updated');

  const [newPlCount] = db.select({ count: sql<number>`count(*)` }).from(plans).where(eq(plans.conversationId, conversationId)).all();
  if (newPlCount.count > snapshot.planCount) changes.push('plan-updated');

  // Check status change
  const updatedConv = db.select({ status: conversations.status, title: conversations.title, model: conversations.model })
    .from(conversations).where(eq(conversations.id, conversationId)).get();
  if (updatedConv && updatedConv.status !== snapshot.status) changes.push('status-changed');
  if (updatedConv && (updatedConv.title !== snapshot.title || updatedConv.model !== snapshot.model)) changes.push('metadata-changed');

  if (changes.length > 0) {
    collectedEvents.push({
      type: 'conversation:changed',
      conversationId,
      changes,
      timestamp: now,
    });
  }
}

/**
 * Extract plans from assistant messages in a normalized conversation
 * and insert them into the plans/planSteps tables.
 * Shared between Claude Code and Cursor ingestion paths.
 */
function insertExtractedPlans(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  normalizedData: NormalizedData,
): void {
  // Delete existing plans for this conversation so re-ingestion reflects latest extraction logic
  const existingPlanIds = tx.select({ id: plans.id }).from(plans)
    .where(eq(plans.conversationId, normalizedData.conversation.id)).all();
  if (existingPlanIds.length > 0) {
    for (const p of existingPlanIds) {
      tx.delete(planSteps).where(eq(planSteps.planId, p.id)).run();
    }
    tx.delete(plans).where(eq(plans.conversationId, normalizedData.conversation.id)).run();
  }

  for (const msg of normalizedData.messages) {
    if (msg.role === 'assistant' && msg.content) {
      const extracted = extractPlans(msg.content, msg.id);

      // Build completion context from later messages and tool calls
      const laterMessages = normalizedData.messages
        .filter(m => m.createdAt > msg.createdAt)
        .map(m => ({ role: m.role, content: m.content }));
      const toolCallsInConv = normalizedData.toolCalls
        .map(tc => ({ name: tc.name, input: tc.input, status: tc.status }));
      const completionContext = { laterMessages, toolCalls: toolCallsInConv };

      for (const plan of extracted) {
        // Infer completion for each step
        const stepsWithStatus = plan.steps.map(s => ({
          ...s,
          status: inferStepCompletion(s, completionContext),
        }));
        const completedCount = stepsWithStatus.filter(s => s.status === 'complete').length;
        const planStatus = completedCount === plan.steps.length ? 'complete'
          : completedCount === 0 ? (stepsWithStatus.some(s => s.status === 'incomplete') ? 'not-started' : 'unknown')
          : 'partial';

        const planId = generateId(normalizedData.conversation.id, 'plan', msg.id, plan.title);
        tx.insert(plans).values({
          id: planId,
          conversationId: normalizedData.conversation.id,
          sourceMessageId: msg.id,
          title: plan.title,
          totalSteps: plan.steps.length,
          completedSteps: completedCount,
          status: planStatus,
          createdAt: msg.createdAt,
        }).onConflictDoNothing({ target: plans.id }).run();

        for (const step of stepsWithStatus) {
          tx.insert(planSteps).values({
            id: generateId(planId, String(step.stepNumber)),
            planId,
            stepNumber: step.stepNumber,
            content: step.content,
            status: step.status,
            createdAt: msg.createdAt,
          }).onConflictDoNothing({ target: planSteps.id }).run();
        }
      }
    }
  }
}

/**
 * Determine if a conversation appears to still be running by inspecting
 * its message sequence. A conversation is "ongoing" if the last activity
 * suggests the agent is mid-turn (e.g., tool calls dispatched but not yet
 * followed by a final text response).
 */
export function isConversationOngoing(normalizedData: NormalizedData): boolean {
  const msgs = normalizedData.messages;
  if (msgs.length === 0) return false;

  // Sort by createdAt descending to find the last message
  const sorted = [...msgs].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const lastMsg = sorted[0];

  if (lastMsg.role === 'assistant') {
    // Check if this assistant message has associated tool calls
    const hasToolCalls = normalizedData.toolCalls.some(
      tc => tc.messageId === lastMsg.id
    );
    // If the assistant's last action was invoking tools, it's ongoing
    // If it was pure text, the conversation turn is complete
    return hasToolCalls;
  }

  // Last message is from user. Check if it looks like a tool_result
  // flow (tool calls exist that are newer than the last assistant message).
  const lastAssistant = sorted.find(m => m.role === 'assistant');
  if (!lastAssistant) return false; // Only user messages = not ongoing

  const toolCallsAfterAssistant = normalizedData.toolCalls.filter(
    tc => tc.createdAt >= lastAssistant.createdAt
  );
  // If there are tool calls at/after the last assistant message,
  // tool results are still flowing back
  return toolCallsAfterAssistant.length > 0
    && normalizedData.toolCalls.some(tc => tc.messageId === lastAssistant.id);
}

const ingestionPlugin: FastifyPluginAsync<IngestionPluginOptions> = async (
  app: FastifyInstance,
  opts: IngestionPluginOptions,
) => {
  const basePath = opts.basePath;
  const autoIngest = opts.autoIngest !== false; // default true

  // Module-level status state inside the plugin closure
  const status: IngestionStatus = {
    running: false,
    progress: null,
    lastRun: null,
  };

  async function runIngestion(): Promise<void> {
    status.running = true;
    status.progress = { filesProcessed: 0, totalFiles: 0 };
    const startTime = Date.now();

    const stats: IngestionStats = {
      filesScanned: 0,
      filesSkipped: 0,
      conversationsFound: 0,
      messagesParsed: 0,
      toolCallsExtracted: 0,
      tokensRecorded: 0,
      skippedLines: 0,
      duration: 0,
    };

    // Ensure ingested_files tracking table exists
    db.run(sql`CREATE TABLE IF NOT EXISTS ingested_files (
      file_path TEXT PRIMARY KEY,
      mtime_ms INTEGER NOT NULL,
      size INTEGER NOT NULL,
      ingested_at TEXT NOT NULL
    )`);

    // One-time data quality migration for existing conversations
    try {
      const migrationResult = runDataQualityMigration(db);
      if (migrationResult.titlesFixed > 0 || migrationResult.modelsFixed > 0 || migrationResult.cursorProjectsFixed > 0 || migrationResult.cursorMessagesFixed > 0 || migrationResult.contentFixed > 0) {
        app.log.info({ migrationResult }, 'Data quality migration applied');
      }
    } catch (err) {
      app.log.error({ err }, 'Data quality migration failed (non-fatal)');
    }

    const collectedEvents: WebSocketEventPayload[] = [];

    try {
      const files = await discoverJsonlFiles(basePath);
      stats.filesScanned = files.length;
      status.progress.totalFiles = files.length;

      for (const file of files) {
        try {
          // Check if file has changed since last ingestion
          const fileStat = await stat(file.filePath);
          const mtimeMs = Math.floor(fileStat.mtimeMs);
          const fileSize = fileStat.size;

          const cached = db.select()
            .from(ingestedFiles)
            .where(eq(ingestedFiles.filePath, file.filePath))
            .get();

          if (cached && cached.mtimeMs === mtimeMs && cached.size === fileSize) {
            stats.filesSkipped++;
            status.progress!.filesProcessed++;
            continue;
          }

          const parseResult = await parseJsonlFile(file.filePath);
          stats.skippedLines += parseResult.skippedLines;

          const normalizedData = normalizeConversation(
            parseResult,
            file.projectDir,
            file.isSubagent ? file.sessionId : undefined,
          );
          if (normalizedData === null) {
            status.progress.filesProcessed++;
            continue;
          }

          // Snapshot state before transaction for diff tracking
          const snapshot = snapshotConversation(normalizedData.conversation.id);

          // Wrap database inserts in a synchronous transaction
          db.transaction((tx) => {
            tx.insert(conversations)
              .values(normalizedData.conversation)
              .onConflictDoUpdate({
                target: conversations.id,
                set: {
                  updatedAt: normalizedData.conversation.updatedAt,
                  status: isConversationOngoing(normalizedData) ? 'active' : 'completed',
                },
              })
              .run();

            if (normalizedData.messages.length > 0) {
              tx.insert(messages)
                .values(normalizedData.messages)
                .onConflictDoNothing({ target: messages.id })
                .run();
            }

            if (normalizedData.toolCalls.length > 0) {
              tx.insert(toolCalls)
                .values(normalizedData.toolCalls)
                .onConflictDoNothing({ target: toolCalls.id })
                .run();
            }

            if (normalizedData.tokenUsage.length > 0) {
              tx.insert(tokenUsage)
                .values(normalizedData.tokenUsage)
                .onConflictDoNothing({ target: tokenUsage.id })
                .run();
            }

            if (normalizedData.compactionEvents.length > 0) {
              tx.insert(compactionEvents)
                .values(normalizedData.compactionEvents)
                .onConflictDoNothing({ target: compactionEvents.id })
                .run();
            }

            // Extract plans from assistant messages
            insertExtractedPlans(tx, normalizedData);
          });

          // Track what changed after transaction committed
          trackChanges(normalizedData.conversation.id, normalizedData, snapshot, collectedEvents);

          // Record file as ingested for future skip-unchanged checks
          db.insert(ingestedFiles).values({
            filePath: file.filePath,
            mtimeMs,
            size: fileSize,
            ingestedAt: new Date().toISOString(),
          }).onConflictDoUpdate({
            target: ingestedFiles.filePath,
            set: { mtimeMs, size: fileSize, ingestedAt: new Date().toISOString() },
          }).run();

          stats.conversationsFound++;
          stats.messagesParsed += normalizedData.messages.length;
          stats.toolCallsExtracted += normalizedData.toolCalls.length;
          stats.tokensRecorded += normalizedData.tokenUsage.length;
        } catch (err) {
          app.log.error({ err, file: file.filePath }, 'Error processing JSONL file');
        }

        status.progress!.filesProcessed++;
      }

      // ── Subagent linking (post-processing) ─────────────────────────────
      // Two-phase approach:
      // Phase A: Set parentConversationId from filesystem structure (100% reliable)
      // Phase B: Match subagents to specific tool calls for summaries (best-effort)
      try {
        // Clear all existing links first so stale/incorrect links are removed.
        db.update(conversations)
          .set({ parentConversationId: null })
          .where(sql`${conversations.parentConversationId} IS NOT NULL`)
          .run();
        db.update(toolCalls)
          .set({ subagentConversationId: null, subagentSummary: null })
          .where(sql`${toolCalls.subagentConversationId} IS NOT NULL`)
          .run();

        const subagentFiles = files.filter(f => f.isSubagent);

        // ── Phase A: Filesystem-based parent linking ─────────────────────
        // Each subagent file sits under {parentSessionId}/subagents/,
        // so we know exactly which parent it belongs to.
        let parentLinksCreated = 0;
        db.transaction((tx) => {
          for (const sf of subagentFiles) {
            if (!sf.parentSessionId) continue;

            const subagentConvId = generateId('claude-code', sf.sessionId);
            const parentConvId = generateId('claude-code', sf.parentSessionId);

            // Verify both exist in DB
            const parentExists = db.select({ id: conversations.id })
              .from(conversations)
              .where(eq(conversations.id, parentConvId))
              .get();
            const subExists = db.select({ id: conversations.id })
              .from(conversations)
              .where(eq(conversations.id, subagentConvId))
              .get();

            if (parentExists && subExists) {
              tx.update(conversations)
                .set({ parentConversationId: parentConvId })
                .where(eq(conversations.id, subagentConvId))
                .run();
              parentLinksCreated++;
            }
          }
        });

        // ── Phase B: Tool-call matching for summaries ────────────────────
        // Group by project to prevent cross-project tool-call matching.
        const filesByProject = new Map<string, DiscoveredFile[]>();
        for (const f of files) {
          const existing = filesByProject.get(f.projectDir);
          if (existing) existing.push(f);
          else filesByProject.set(f.projectDir, [f]);
        }

        const getConversationId = (sessionId: string): string | null => {
          const convId = generateId('claude-code', sessionId);
          const row = db.select({ id: conversations.id })
            .from(conversations)
            .where(eq(conversations.id, convId))
            .get();
          return row ? row.id : null;
        };

        const getToolCallsForConv = (conversationId: string) => {
          return db.select({
            id: toolCalls.id,
            name: toolCalls.name,
            input: toolCalls.input,
            output: toolCalls.output,
            createdAt: toolCalls.createdAt,
          })
            .from(toolCalls)
            .where(eq(toolCalls.conversationId, conversationId))
            .all() as Array<{ id: string; name: string; input: unknown; output: unknown; createdAt: string }>;
        };

        const getFirstUserMessage = (conversationId: string): string | null => {
          const msg = db.select({ content: messages.content })
            .from(messages)
            .where(and(eq(messages.conversationId, conversationId), eq(messages.role, 'user')))
            .orderBy(messages.createdAt)
            .limit(1)
            .get();
          return msg?.content ?? null;
        };

        let toolCallLinksCreated = 0;
        for (const [, projectFiles] of filesByProject) {
          const parentFiles = projectFiles.filter(f => !f.isSubagent);
          const projSubagentFiles = projectFiles.filter(f => f.isSubagent);

          if (projSubagentFiles.length > 0 && parentFiles.length > 0) {
            const links = await linkSubagents({
              parentFiles,
              subagentFiles: projSubagentFiles,
              getToolCalls: getToolCallsForConv,
              getConversationId,
              getFirstUserMessage,
            });

            if (links.length > 0) {
              // Update tool_calls with subagent references
              db.transaction((tx) => {
                for (const link of links) {
                  tx.update(toolCalls)
                    .set({ subagentConversationId: link.subagentConversationId })
                    .where(eq(toolCalls.id, link.toolCallId))
                    .run();
                }
              });

              // Compute summaries
              for (const link of links) {
                const subagentFile = projSubagentFiles.find(f => {
                  const convId = generateId('claude-code', f.sessionId);
                  return convId === link.subagentConversationId;
                });

                if (subagentFile) {
                  try {
                    const subagentParseResult = await parseJsonlFile(subagentFile.filePath);
                    const summaryData = summarizeSubagent(subagentParseResult);
                    const fullSummary = { ...summaryData, matchConfidence: link.matchConfidence };

                    db.update(toolCalls)
                      .set({ subagentSummary: fullSummary as unknown as null })
                      .where(eq(toolCalls.id, link.toolCallId))
                      .run();
                  } catch (err) {
                    app.log.error({ err, file: subagentFile.filePath }, 'Error computing subagent summary');
                  }
                }
              }

              toolCallLinksCreated += links.length;
            }
          }
        }

        app.log.info({ parentLinksCreated, toolCallLinksCreated }, 'Subagent linking complete');
      } catch (err) {
        app.log.error({ err }, 'Error during subagent linking (non-fatal)');
      }

      // ── Cursor ingestion ────────────────────────────────────────────────
      const cursorDbPath = discoverCursorDb();
      if (cursorDbPath) {
        try {
          const cursorConversations = parseCursorDb(cursorDbPath);
          app.log.info({ count: cursorConversations.length }, 'Discovered Cursor conversations');

          for (const conv of cursorConversations) {
            try {
              const bubbles = getBubblesForConversation(cursorDbPath, conv.composerId);
              const cursorProject = conv.workspacePath ? basename(conv.workspacePath) : 'Cursor';
              const normalizedData = normalizeCursorConversation(conv, bubbles, cursorProject);
              if (!normalizedData) continue;

              // Snapshot state before transaction for diff tracking
              const cursorSnapshot = snapshotConversation(normalizedData.conversation.id);

              db.transaction((tx) => {
                tx.insert(conversations)
                  .values(normalizedData.conversation)
                  .onConflictDoUpdate({
                    target: conversations.id,
                    set: {
                      updatedAt: normalizedData.conversation.updatedAt,
                      status: isConversationOngoing(normalizedData) ? 'active' : 'completed',
                    },
                  })
                  .run();

                if (normalizedData.messages.length > 0) {
                  tx.insert(messages)
                    .values(normalizedData.messages)
                    .onConflictDoNothing({ target: messages.id })
                    .run();
                }

                if (normalizedData.toolCalls.length > 0) {
                  tx.insert(toolCalls)
                    .values(normalizedData.toolCalls)
                    .onConflictDoNothing({ target: toolCalls.id })
                    .run();
                }

                if (normalizedData.tokenUsage.length > 0) {
                  tx.insert(tokenUsage)
                    .values(normalizedData.tokenUsage)
                    .onConflictDoNothing({ target: tokenUsage.id })
                    .run();
                }

                // Extract plans from assistant messages
                insertExtractedPlans(tx, normalizedData);
              });

              // Track what changed after transaction committed
              trackChanges(normalizedData.conversation.id, normalizedData, cursorSnapshot, collectedEvents);

              stats.conversationsFound++;
              stats.messagesParsed += normalizedData.messages.length;
              stats.toolCallsExtracted += normalizedData.toolCalls.length;
              stats.tokensRecorded += normalizedData.tokenUsage.length;
            } catch (err) {
              app.log.error({ err, composerId: conv.composerId }, 'Error processing Cursor conversation');
            }
          }
        } catch (err) {
          app.log.error({ err }, 'Error processing Cursor state.vscdb');
        }
      }

      // Mark stale conversations as completed (not updated in last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      db.update(conversations)
        .set({ status: 'completed' })
        .where(
          and(
            eq(conversations.status, 'active'),
            lte(conversations.updatedAt, fiveMinutesAgo)
          )
        )
        .run();
    } catch (err) {
      app.log.error({ err }, 'Error during ingestion');
    } finally {
      stats.duration = Date.now() - startTime;
      status.running = false;
      status.progress = null;
      status.lastRun = {
        completedAt: new Date().toISOString(),
        stats,
      };
      app.log.info({ stats, skipped: stats.filesSkipped, events: collectedEvents.length }, 'Ingestion complete');
      opts.onIngestionComplete?.(collectedEvents);
    }
  }

  // ── Routes ─────────────────────────────────────────────────────────────

  app.post('/ingest', async (_request, reply) => {
    if (status.running) {
      reply.status(409);
      return { error: 'Ingestion already in progress' };
    }

    status.running = true;
    // Fire-and-forget: start ingestion without awaiting
    runIngestion().catch((err) => {
      app.log.error({ err }, 'Unhandled ingestion error');
    });

    return { message: 'Ingestion started' };
  });

  app.get('/ingest/status', async () => {
    return status;
  });

  // ── Auto-ingest on boot ────────────────────────────────────────────────

  if (autoIngest) {
    app.addHook('onReady', () => {
      setImmediate(() => {
        runIngestion().catch((err) => {
          app.log.error({ err }, 'Auto-ingest failed');
        });
      });
    });
  }
};

export default ingestionPlugin;
