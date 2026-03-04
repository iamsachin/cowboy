import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getSettings, updateSyncStatus } from '../db/queries/settings.js';
import { db as defaultDb } from '../db/index.js';
import { conversations, messages, toolCalls, tokenUsage, plans, planSteps } from '../db/schema.js';
import { gt } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export interface SyncPayload {
  source: 'cowboy';
  syncedAt: string;
  incrementalFrom: string | null;
  categories: {
    conversations?: Array<Record<string, unknown>>;
    messages?: Array<Record<string, unknown>>;
    toolCalls?: Array<Record<string, unknown>>;
    tokenUsage?: Array<Record<string, unknown>>;
    plans?: Array<Record<string, unknown>>;
  };
}

declare module 'fastify' {
  interface FastifyInstance {
    syncScheduler: {
      start: (intervalMs: number) => void;
      stop: () => void;
      syncNow: () => Promise<void>;
    };
  }
}

// ── postWithRetry (exported for testing) ─────────────────────────────────────

const DEFAULT_RETRY_OPTS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 5000,
  maxDelay: 60000,
  backoffFactor: 2,
};

export async function postWithRetry(
  url: string,
  body: unknown,
  opts: RetryOptions = DEFAULT_RETRY_OPTS,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (err) {
      lastError = err as Error;
      if (attempt < opts.maxRetries) {
        const delay = Math.min(
          opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
          opts.maxDelay,
        );
        const jitter = delay * 0.5 * Math.random();
        await new Promise((r) => setTimeout(r, delay + jitter));
      }
    }
  }

  throw lastError!;
}

// ── buildSyncPayload (exported for testing) ──────────────────────────────────

export function buildSyncPayload(
  database: BetterSQLite3Database<typeof schema>,
  selectedCategories: string[],
  syncCursor: string | null,
): SyncPayload {
  const now = new Date().toISOString();
  const payload: SyncPayload = {
    source: 'cowboy',
    syncedAt: now,
    incrementalFrom: syncCursor,
    categories: {},
  };

  for (const category of selectedCategories) {
    switch (category) {
      case 'conversations': {
        const query = syncCursor
          ? database.select().from(conversations).where(gt(conversations.createdAt, syncCursor))
          : database.select().from(conversations);
        payload.categories.conversations = query.all() as Array<Record<string, unknown>>;
        break;
      }
      case 'messages': {
        const query = syncCursor
          ? database.select().from(messages).where(gt(messages.createdAt, syncCursor))
          : database.select().from(messages);
        payload.categories.messages = query.all() as Array<Record<string, unknown>>;
        break;
      }
      case 'toolCalls': {
        const query = syncCursor
          ? database.select().from(toolCalls).where(gt(toolCalls.createdAt, syncCursor))
          : database.select().from(toolCalls);
        payload.categories.toolCalls = query.all() as Array<Record<string, unknown>>;
        break;
      }
      case 'tokenUsage': {
        const query = syncCursor
          ? database.select().from(tokenUsage).where(gt(tokenUsage.createdAt, syncCursor))
          : database.select().from(tokenUsage);
        payload.categories.tokenUsage = query.all() as Array<Record<string, unknown>>;
        break;
      }
      case 'plans': {
        const plansQuery = syncCursor
          ? database.select().from(plans).where(gt(plans.createdAt, syncCursor))
          : database.select().from(plans);
        const plansData = plansQuery.all();

        // Attach steps to each plan
        const plansWithSteps = plansData.map((plan) => {
          const steps = database.select().from(planSteps)
            .where(gt(planSteps.planId, ''))  // always true, just need the base query
            .all()
            .filter((s) => s.planId === plan.id)
            .map((s) => ({
              stepNumber: s.stepNumber,
              content: s.content,
              status: s.status,
            }));

          // Use a simpler approach: query steps by planId
          const actualSteps = database.select().from(planSteps).all()
            .filter((s) => s.planId === plan.id)
            .map((s) => ({
              stepNumber: s.stepNumber,
              content: s.content,
              status: s.status,
            }));

          return { ...plan, steps: actualSteps };
        });

        payload.categories.plans = plansWithSteps as Array<Record<string, unknown>>;
        break;
      }
    }
  }

  return payload;
}

// ── Fastify Plugin ───────────────────────────────────────────────────────────

const syncSchedulerPluginInner: FastifyPluginAsync = async (app: FastifyInstance) => {
  let timer: ReturnType<typeof setInterval> | null = null;
  let syncing = false;

  async function doSync(): Promise<void> {
    if (syncing) return; // Prevent overlap
    syncing = true;

    try {
      const currentSettings = getSettings();

      // Skip if sync not enabled or no URL configured
      if (!currentSettings.syncEnabled || !currentSettings.syncUrl) {
        return;
      }

      const categories = (currentSettings.syncCategories as string[]) || [];
      const payload = buildSyncPayload(
        defaultDb,
        categories,
        currentSettings.syncCursor || null,
      );

      // Check if there is any data to sync
      const hasData = Object.values(payload.categories).some(
        (arr) => arr && arr.length > 0,
      );
      if (!hasData) {
        return;
      }

      await postWithRetry(currentSettings.syncUrl, payload);

      // Success: update status and advance cursor
      updateSyncStatus({
        lastSyncAt: new Date().toISOString(),
        lastSyncSuccess: true,
        lastSyncError: null,
        syncCursor: payload.syncedAt,
      });
    } catch (err) {
      // Failure: record error without crashing
      const errorMessage = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, 'Sync failed');
      updateSyncStatus({
        lastSyncSuccess: false,
        lastSyncError: errorMessage,
      });
    } finally {
      syncing = false;
    }
  }

  function startScheduler(intervalMs: number): void {
    stopScheduler();
    if (intervalMs > 0) {
      timer = setInterval(() => {
        doSync().catch((err) => {
          app.log.error({ err }, 'Unexpected error in sync scheduler tick');
        });
      }, intervalMs);
    }
  }

  function stopScheduler(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Decorate app so settings routes can restart/trigger sync
  app.decorate('syncScheduler', {
    start: startScheduler,
    stop: stopScheduler,
    syncNow: doSync,
  });

  // Auto-start if sync is enabled on plugin init
  try {
    const currentSettings = getSettings();
    if (currentSettings.syncEnabled && currentSettings.syncUrl) {
      startScheduler(currentSettings.syncFrequency * 1000);
    }
  } catch {
    // Settings table may not exist during some test scenarios
  }

  // Clean shutdown
  app.addHook('onClose', async () => {
    stopScheduler();
  });
};

// Use fp() to break encapsulation so syncScheduler decorator propagates to parent
const syncSchedulerPlugin = fp(syncSchedulerPluginInner, {
  name: 'cowboy-sync-scheduler',
});

export default syncSchedulerPlugin;
