import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { conversations, messages, toolCalls, tokenUsage, plans, planSteps } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { discoverJsonlFiles } from './file-discovery.js';
import { parseJsonlFile } from './claude-code-parser.js';
import { normalizeConversation, type NormalizedData } from './normalizer.js';
import { discoverCursorDb } from './cursor-file-discovery.js';
import { parseCursorDb, getBubblesForConversation } from './cursor-parser.js';
import { normalizeCursorConversation } from './cursor-normalizer.js';
import { extractPlans, inferStepCompletion } from './plan-extractor.js';
import { generateId } from './id-generator.js';
import { runDataQualityMigration } from './migration.js';
import { basename } from 'node:path';
import type { IngestionStats, IngestionStatus } from './types.js';

export interface IngestionPluginOptions {
  basePath?: string;
  autoIngest?: boolean;
  onIngestionComplete?: () => void;
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
        }).run();

        for (const step of stepsWithStatus) {
          tx.insert(planSteps).values({
            id: generateId(planId, String(step.stepNumber)),
            planId,
            stepNumber: step.stepNumber,
            content: step.content,
            status: step.status,
            createdAt: msg.createdAt,
          }).run();
        }
      }
    }
  }
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
      conversationsFound: 0,
      messagesParsed: 0,
      toolCallsExtracted: 0,
      tokensRecorded: 0,
      skippedLines: 0,
      duration: 0,
    };

    // One-time data quality migration for existing conversations
    try {
      const migrationResult = runDataQualityMigration(db);
      if (migrationResult.titlesFixed > 0 || migrationResult.modelsFixed > 0 || migrationResult.cursorProjectsFixed > 0 || migrationResult.cursorMessagesFixed > 0) {
        app.log.info({ migrationResult }, 'Data quality migration applied');
      }
    } catch (err) {
      app.log.error({ err }, 'Data quality migration failed (non-fatal)');
    }

    try {
      const files = await discoverJsonlFiles(basePath);
      stats.filesScanned = files.length;
      status.progress.totalFiles = files.length;

      for (const file of files) {
        try {
          const parseResult = await parseJsonlFile(file.filePath);
          stats.skippedLines += parseResult.skippedLines;

          const normalizedData = normalizeConversation(parseResult, file.projectDir);
          if (normalizedData === null) {
            status.progress.filesProcessed++;
            continue;
          }

          // Wrap database inserts in a synchronous transaction
          db.transaction((tx) => {
            tx.insert(conversations)
              .values(normalizedData.conversation)
              .onConflictDoNothing({ target: conversations.id })
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

          stats.conversationsFound++;
          stats.messagesParsed += normalizedData.messages.length;
          stats.toolCallsExtracted += normalizedData.toolCalls.length;
          stats.tokensRecorded += normalizedData.tokenUsage.length;
        } catch (err) {
          app.log.error({ err, file: file.filePath }, 'Error processing JSONL file');
        }

        status.progress.filesProcessed++;
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

              db.transaction((tx) => {
                tx.insert(conversations)
                  .values(normalizedData.conversation)
                  .onConflictDoNothing({ target: conversations.id })
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
      app.log.info({ stats }, 'Ingestion complete');
      opts.onIngestionComplete?.();
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
