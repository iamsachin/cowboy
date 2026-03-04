import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database before importing app
const testDbPath = path.join(os.tmpdir(), `cowboy-test-sync-scheduler-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { runMigrations } = await import('../../src/db/migrate.js');
const { db } = await import('../../src/db/index.js');
const { settings, conversations, messages } = await import('../../src/db/schema.js');
const { eq } = await import('drizzle-orm');

describe('Sync Scheduler Plugin', () => {
  let syncSchedulerPlugin: typeof import('../../src/plugins/sync-scheduler.js').default;

  beforeAll(async () => {
    runMigrations();
    const mod = await import('../../src/plugins/sync-scheduler.js');
    syncSchedulerPlugin = mod.default;
  });

  afterAll(() => {
    try {
      fs.unlinkSync(testDbPath);
      fs.unlinkSync(testDbPath + '-wal');
      fs.unlinkSync(testDbPath + '-shm');
    } catch {
      // Files may not exist
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('decorates app with syncScheduler containing start, stop, syncNow', async () => {
    // Seed settings with sync disabled so scheduler does not auto-start
    db.delete(settings).run();
    db.insert(settings).values({
      id: 1,
      claudeCodePath: '/test',
      claudeCodeEnabled: true,
      cursorPath: '/test',
      cursorEnabled: false,
      syncEnabled: false,
      syncUrl: '',
      syncFrequency: 900,
      syncCategories: ['conversations'],
    }).run();

    const app = Fastify({ logger: false });
    await app.register(syncSchedulerPlugin);
    await app.ready();

    expect(app.syncScheduler).toBeDefined();
    expect(typeof app.syncScheduler.start).toBe('function');
    expect(typeof app.syncScheduler.stop).toBe('function');
    expect(typeof app.syncScheduler.syncNow).toBe('function');

    await app.close();
  });

  it('syncNow POSTs payload to configured syncUrl and updates status on success', async () => {
    // Set up a local Fastify server to receive sync POSTs
    const receiverApp = Fastify({ logger: false });
    let receivedBody: unknown = null;
    receiverApp.post('/receive', async (request) => {
      receivedBody = request.body;
      return { ok: true };
    });
    const receiverAddress = await receiverApp.listen({ port: 0, host: '127.0.0.1' });

    // Seed settings with sync enabled
    db.delete(settings).run();
    db.insert(settings).values({
      id: 1,
      claudeCodePath: '/test',
      claudeCodeEnabled: true,
      cursorPath: '/test',
      cursorEnabled: false,
      syncEnabled: true,
      syncUrl: `${receiverAddress}/receive`,
      syncFrequency: 900,
      syncCategories: ['conversations'],
    }).run();

    // Seed some data
    db.insert(conversations).values({
      id: 'sync-conv-1',
      agent: 'claude-code',
      project: 'proj',
      title: 'Test Conv',
      createdAt: '2026-03-04T10:00:00Z',
      updatedAt: '2026-03-04T10:00:00Z',
      model: 'claude-3',
    }).onConflictDoNothing().run();

    const app = Fastify({ logger: false });
    await app.register(syncSchedulerPlugin);
    await app.ready();

    // Trigger immediate sync
    await app.syncScheduler.syncNow();

    // Verify POST was received
    expect(receivedBody).toBeDefined();
    const body = receivedBody as { source: string; categories: { conversations: unknown[] } };
    expect(body.source).toBe('cowboy');
    expect(body.categories.conversations).toBeDefined();

    // Verify sync status updated in DB
    const row = db.select().from(settings).where(eq(settings.id, 1)).get()!;
    expect(row.lastSyncSuccess).toBe(true);
    expect(row.lastSyncAt).toBeDefined();
    expect(row.lastSyncError).toBeNull();
    expect(row.syncCursor).toBeDefined();

    await app.close();
    await receiverApp.close();
  });

  it('updates lastSyncError on sync failure without crashing', async () => {
    // Seed settings and data so payload is non-empty
    db.delete(settings).run();
    db.insert(settings).values({
      id: 1,
      claudeCodePath: '/test',
      claudeCodeEnabled: true,
      cursorPath: '/test',
      cursorEnabled: false,
      syncEnabled: true,
      syncUrl: 'http://127.0.0.1:19999/nonexistent',
      syncFrequency: 900,
      syncCategories: ['conversations'],
    }).run();

    db.insert(conversations).values({
      id: 'fail-conv-1',
      agent: 'claude-code',
      project: 'proj',
      title: 'Fail Conv',
      createdAt: '2026-03-04T10:00:00Z',
      updatedAt: '2026-03-04T10:00:00Z',
      model: 'claude-3',
    }).onConflictDoNothing().run();

    // Mock fetch to fail immediately (avoids real network timeout)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    // Use fake timers to skip retry delays
    vi.useFakeTimers();

    const app = Fastify({ logger: false });
    await app.register(syncSchedulerPlugin);
    await app.ready();

    // Start syncNow and advance timers to exhaust retries
    const syncPromise = app.syncScheduler.syncNow();
    // Advance past all retry delays (3 retries * max 60s each)
    await vi.advanceTimersByTimeAsync(300000);
    await syncPromise;

    vi.useRealTimers();

    // Verify error status in DB
    const row = db.select().from(settings).where(eq(settings.id, 1)).get()!;
    expect(row.lastSyncSuccess).toBe(false);
    expect(row.lastSyncError).toBeDefined();
    expect(row.lastSyncError!.length).toBeGreaterThan(0);

    await app.close();
    vi.unstubAllGlobals();
  });

  it('skips sync when syncEnabled is false', async () => {
    db.delete(settings).run();
    db.insert(settings).values({
      id: 1,
      claudeCodePath: '/test',
      claudeCodeEnabled: true,
      cursorPath: '/test',
      cursorEnabled: false,
      syncEnabled: false,
      syncUrl: 'http://127.0.0.1:19999/should-not-be-called',
      syncFrequency: 900,
      syncCategories: ['conversations'],
    }).run();

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const app = Fastify({ logger: false });
    await app.register(syncSchedulerPlugin);
    await app.ready();

    await app.syncScheduler.syncNow();

    // fetch should not have been called since sync is disabled
    expect(mockFetch).not.toHaveBeenCalled();

    await app.close();
    vi.unstubAllGlobals();
  });

  it('skips sync when payload has no new data', async () => {
    // Seed settings with sync enabled and a cursor in the far future
    db.delete(settings).run();
    db.insert(settings).values({
      id: 1,
      claudeCodePath: '/test',
      claudeCodeEnabled: true,
      cursorPath: '/test',
      cursorEnabled: false,
      syncEnabled: true,
      syncUrl: 'http://127.0.0.1:19999/should-not-be-called',
      syncFrequency: 900,
      syncCategories: ['conversations'],
      syncCursor: '2099-01-01T00:00:00Z',
    }).run();

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const app = Fastify({ logger: false });
    await app.register(syncSchedulerPlugin);
    await app.ready();

    await app.syncScheduler.syncNow();

    // fetch should not have been called since there is no new data
    expect(mockFetch).not.toHaveBeenCalled();

    await app.close();
    vi.unstubAllGlobals();
  });
});
