import { FastifyInstance } from 'fastify';
import { getSettings, updateAgentSettings, updateSyncSettings } from '../db/queries/settings.js';
import { stat, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { db } from '../db/index.js';
import { conversations, messages, toolCalls, tokenUsage, plans, planSteps } from '../db/schema.js';
import { eq, inArray, sql } from 'drizzle-orm';

/**
 * Expand tilde (~) at the start of a path to the user's home directory.
 * Shell-style tilde expansion is not done automatically by Node.js fs APIs.
 */
function expandTilde(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return join(homedir(), p.slice(1));
  }
  return p;
}

/**
 * Validate an agent log directory path and count relevant files.
 */
async function validateAgentPath(dirPath: string, agent: string): Promise<{
  valid: boolean;
  fileCount: number;
  message: string;
}> {
  try {
    const dirStat = await stat(dirPath);
    if (!dirStat.isDirectory()) {
      return { valid: false, fileCount: 0, message: 'Path is not a directory' };
    }
    if (agent === 'claude-code') {
      const entries = await readdir(dirPath, { recursive: true });
      const jsonlFiles = (entries as string[]).filter(e => e.endsWith('.jsonl'));
      return { valid: true, fileCount: jsonlFiles.length, message: `Path exists: ${jsonlFiles.length} JSONL files found` };
    } else {
      // Cursor: check for state.vscdb
      const entries = await readdir(dirPath);
      const hasDb = (entries as string[]).some(e => e === 'state.vscdb');
      return {
        valid: true,
        fileCount: hasDb ? 1 : 0,
        message: hasDb ? 'Path exists: state.vscdb found' : 'Path exists but no state.vscdb found',
      };
    }
  } catch {
    return { valid: false, fileCount: 0, message: 'Path not found' };
  }
}

export default async function settingsRoutes(app: FastifyInstance) {
  // GET /settings -- return current settings (auto-seeds on first call)
  app.get('/settings', async () => {
    return getSettings();
  });

  // PUT /settings/agent -- update agent configuration
  app.put('/settings/agent', async (request) => {
    const body = request.body as {
      claudeCodePath: string;
      claudeCodeEnabled: boolean;
      cursorPath: string;
      cursorEnabled: boolean;
    };
    // Resolve tilde in paths before saving
    const updated = updateAgentSettings({
      claudeCodePath: expandTilde(body.claudeCodePath),
      claudeCodeEnabled: body.claudeCodeEnabled,
      cursorPath: expandTilde(body.cursorPath),
      cursorEnabled: body.cursorEnabled,
    });

    // Restart file watcher with new paths and trigger re-ingestion
    try {
      await app.fileWatcher.restart();
    } catch {
      // fileWatcher may not be registered in all contexts (e.g. tests)
    }

    return updated;
  });

  // PUT /settings/sync -- update sync configuration
  app.put('/settings/sync', async (request) => {
    const body = request.body as {
      syncEnabled: boolean;
      syncUrl: string;
      syncFrequency: number;
      syncCategories: string[];
    };
    const updated = updateSyncSettings(body);

    // Wire sync scheduler based on new settings
    try {
      if (updated.syncEnabled && updated.syncUrl) {
        app.syncScheduler.start(updated.syncFrequency * 1000);
      } else {
        app.syncScheduler.stop();
      }
    } catch {
      // syncScheduler may not be registered in all contexts (e.g. tests)
    }

    return updated;
  });

  // POST /settings/validate-path -- check if a path is valid and count files
  app.post('/settings/validate-path', async (request) => {
    const { path: rawPath, agent } = request.body as { path: string; agent: string };
    const resolvedPath = expandTilde(rawPath);
    return validateAgentPath(resolvedPath, agent);
  });

  // POST /settings/test-sync -- test remote endpoint connectivity
  app.post('/settings/test-sync', async (request) => {
    const { url } = request.body as { url: string };
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
        signal: AbortSignal.timeout(10000),
      });
      return { success: response.ok, status: response.status };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // POST /settings/sync-now -- trigger immediate sync
  app.post('/settings/sync-now', async () => {
    try {
      await app.syncScheduler.syncNow();
      return { message: 'Sync triggered' };
    } catch {
      return { message: 'Sync not configured' };
    }
  });

  /**
   * Helper: clear data tables (NOT settings) inside a transaction.
   * When agentFilter is provided, only clear rows belonging to that agent.
   */
  async function clearDataTables(agentFilter?: string): Promise<void> {
    db.transaction((tx) => {
      if (agentFilter) {
        // Collect conversation IDs for the target agent
        const convIds = tx
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.agent, agentFilter))
          .all()
          .map((r) => r.id);

        if (convIds.length > 0) {
          // Delete child tables first (FK-safe order)
          tx.delete(planSteps)
            .where(
              inArray(
                planSteps.planId,
                tx
                  .select({ id: plans.id })
                  .from(plans)
                  .where(inArray(plans.conversationId, convIds)),
              ),
            )
            .run();
          tx.delete(plans).where(inArray(plans.conversationId, convIds)).run();
          tx.delete(toolCalls).where(inArray(toolCalls.conversationId, convIds)).run();
          tx.delete(tokenUsage).where(inArray(tokenUsage.conversationId, convIds)).run();
          tx.delete(messages).where(inArray(messages.conversationId, convIds)).run();
          tx.delete(conversations).where(inArray(conversations.id, convIds)).run();
        }
      } else {
        // Delete all data tables in FK-safe order
        tx.delete(planSteps).run();
        tx.delete(plans).run();
        tx.delete(toolCalls).run();
        tx.delete(tokenUsage).run();
        tx.delete(messages).run();
        tx.delete(conversations).run();
      }
    });
  }

  // DELETE /settings/clear-db -- Clear all data tables (NOT settings)
  app.delete('/settings/clear-db', async (request) => {
    const { agent } = request.query as { agent?: string };
    await clearDataTables(agent);

    try {
      app.broadcast({ type: 'data-changed', timestamp: new Date().toISOString() });
    } catch {
      // broadcast may not exist in test contexts
    }

    return { message: 'Database cleared', ...(agent ? { agent } : {}) };
  });

  // POST /settings/refresh-db -- Clear data then re-ingest
  app.post('/settings/refresh-db', async (request) => {
    const { agent } = request.query as { agent?: string };

    // Clear data first
    await clearDataTables(agent);

    try {
      app.broadcast({ type: 'data-changed', timestamp: new Date().toISOString() });
    } catch {
      // broadcast may not exist in test contexts
    }

    // Trigger re-ingestion
    const ingestResponse = await app.inject({ method: 'POST', url: '/api/ingest' });
    let ingestBody: unknown;
    try {
      ingestBody = JSON.parse(ingestResponse.body);
    } catch {
      ingestBody = { message: ingestResponse.body };
    }

    return ingestBody;
  });

  // GET /settings/db-stats -- Return row counts for UI display
  app.get('/settings/db-stats', async () => {
    const [convCount] = db.select({ count: sql<number>`count(*)` }).from(conversations).all();
    const [msgCount] = db.select({ count: sql<number>`count(*)` }).from(messages).all();
    const [tcCount] = db.select({ count: sql<number>`count(*)` }).from(toolCalls).all();
    const [tuCount] = db.select({ count: sql<number>`count(*)` }).from(tokenUsage).all();
    const [plCount] = db.select({ count: sql<number>`count(*)` }).from(plans).all();

    const agentCounts = db
      .select({ agent: conversations.agent, count: sql<number>`count(*)` })
      .from(conversations)
      .groupBy(conversations.agent)
      .all();

    const byAgent: Record<string, number> = {};
    for (const row of agentCounts) {
      byAgent[row.agent] = row.count;
    }

    return {
      total: {
        conversations: convCount.count,
        messages: msgCount.count,
        toolCalls: tcCount.count,
        tokenUsage: tuCount.count,
        plans: plCount.count,
      },
      byAgent,
    };
  });
}
