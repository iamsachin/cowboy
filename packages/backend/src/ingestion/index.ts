import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { conversations, messages, toolCalls, tokenUsage } from '../db/schema.js';
import { discoverJsonlFiles } from './file-discovery.js';
import { parseJsonlFile } from './claude-code-parser.js';
import { normalizeConversation } from './normalizer.js';
import type { IngestionStats, IngestionStatus } from './types.js';

export interface IngestionPluginOptions {
  basePath?: string;
  autoIngest?: boolean;
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
