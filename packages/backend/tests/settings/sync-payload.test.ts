import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database before importing anything
const testDbPath = path.join(os.tmpdir(), `cowboy-test-sync-payload-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { db } = await import('../../src/db/index.js');
const { runMigrations } = await import('../../src/db/migrate.js');
const { conversations, messages, toolCalls, tokenUsage, plans, planSteps } = await import('../../src/db/schema.js');
const { buildSyncPayload } = await import('../../src/plugins/sync-scheduler.js');

describe('buildSyncPayload', () => {
  beforeAll(() => {
    runMigrations();

    // Seed test data with known timestamps
    db.insert(conversations).values([
      { id: 'conv-1', agent: 'claude-code', project: 'test-project', title: 'Conv 1', createdAt: '2026-03-01T10:00:00Z', updatedAt: '2026-03-01T10:00:00Z', model: 'claude-3' },
      { id: 'conv-2', agent: 'claude-code', project: 'test-project', title: 'Conv 2', createdAt: '2026-03-03T10:00:00Z', updatedAt: '2026-03-03T10:00:00Z', model: 'claude-3' },
    ]).run();

    db.insert(messages).values([
      { id: 'msg-1', conversationId: 'conv-1', role: 'user', content: 'Hello', createdAt: '2026-03-01T10:01:00Z', model: 'claude-3' },
      { id: 'msg-2', conversationId: 'conv-1', role: 'assistant', content: 'Hi', createdAt: '2026-03-01T10:02:00Z', model: 'claude-3' },
      { id: 'msg-3', conversationId: 'conv-2', role: 'user', content: 'Later msg', createdAt: '2026-03-03T10:01:00Z', model: 'claude-3' },
    ]).run();

    db.insert(toolCalls).values([
      { id: 'tc-1', messageId: 'msg-2', conversationId: 'conv-1', name: 'Read', input: null, output: null, status: 'success', duration: 100, createdAt: '2026-03-01T10:02:30Z' },
      { id: 'tc-2', messageId: 'msg-3', conversationId: 'conv-2', name: 'Write', input: null, output: null, status: 'success', duration: 200, createdAt: '2026-03-03T10:01:30Z' },
    ]).run();

    db.insert(tokenUsage).values([
      { id: 'tu-1', conversationId: 'conv-1', messageId: 'msg-1', model: 'claude-3', inputTokens: 100, outputTokens: 50, createdAt: '2026-03-01T10:01:00Z' },
      { id: 'tu-2', conversationId: 'conv-2', messageId: 'msg-3', model: 'claude-3', inputTokens: 200, outputTokens: 100, createdAt: '2026-03-03T10:01:00Z' },
    ]).run();

    db.insert(plans).values([
      { id: 'plan-1', conversationId: 'conv-1', sourceMessageId: 'msg-2', title: 'Plan A', totalSteps: 2, completedSteps: 1, status: 'partial', createdAt: '2026-03-01T10:02:00Z' },
    ]).run();

    db.insert(planSteps).values([
      { id: 'ps-1', planId: 'plan-1', stepNumber: 1, content: 'Step 1', status: 'complete', createdAt: '2026-03-01T10:02:00Z' },
      { id: 'ps-2', planId: 'plan-1', stepNumber: 2, content: 'Step 2', status: 'unknown', createdAt: '2026-03-01T10:02:00Z' },
    ]).run();
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

  it('includes all tables when all categories are selected', () => {
    const payload = buildSyncPayload(
      db,
      ['conversations', 'messages', 'toolCalls', 'tokenUsage', 'plans'],
      null,
    );

    expect(payload.source).toBe('cowboy');
    expect(payload.syncedAt).toBeDefined();
    expect(payload.incrementalFrom).toBeNull();

    expect(payload.categories.conversations).toHaveLength(2);
    expect(payload.categories.messages).toHaveLength(3);
    expect(payload.categories.toolCalls).toHaveLength(2);
    expect(payload.categories.tokenUsage).toHaveLength(2);
    expect(payload.categories.plans).toHaveLength(1);
    // Plan should include steps
    expect(payload.categories.plans![0].steps).toHaveLength(2);
  });

  it('includes only selected categories', () => {
    const payload = buildSyncPayload(
      db,
      ['conversations', 'tokenUsage'],
      null,
    );

    expect(payload.categories.conversations).toHaveLength(2);
    expect(payload.categories.tokenUsage).toHaveLength(2);
    expect(payload.categories.messages).toBeUndefined();
    expect(payload.categories.toolCalls).toBeUndefined();
    expect(payload.categories.plans).toBeUndefined();
  });

  it('filters records newer than syncCursor timestamp', () => {
    const payload = buildSyncPayload(
      db,
      ['conversations', 'messages', 'toolCalls', 'tokenUsage', 'plans'],
      '2026-03-02T00:00:00Z',
    );

    expect(payload.incrementalFrom).toBe('2026-03-02T00:00:00Z');
    // Only conv-2 is newer than 2026-03-02
    expect(payload.categories.conversations).toHaveLength(1);
    expect(payload.categories.conversations![0].id).toBe('conv-2');
    // Only msg-3 is newer
    expect(payload.categories.messages).toHaveLength(1);
    expect(payload.categories.messages![0].id).toBe('msg-3');
    // Only tc-2 is newer
    expect(payload.categories.toolCalls).toHaveLength(1);
    // Only tu-2 is newer
    expect(payload.categories.tokenUsage).toHaveLength(1);
    // plan-1 is from March 1 -- older than cursor, so none returned
    expect(payload.categories.plans).toHaveLength(0);
  });

  it('returns empty categories when syncCursor is after all data', () => {
    const payload = buildSyncPayload(
      db,
      ['conversations', 'messages', 'toolCalls', 'tokenUsage', 'plans'],
      '2026-12-31T00:00:00Z',
    );

    expect(payload.categories.conversations).toHaveLength(0);
    expect(payload.categories.messages).toHaveLength(0);
    expect(payload.categories.toolCalls).toHaveLength(0);
    expect(payload.categories.tokenUsage).toHaveLength(0);
    expect(payload.categories.plans).toHaveLength(0);
  });
});
