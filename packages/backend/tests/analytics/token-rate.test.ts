import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database before importing app
const testDbPath = path.join(os.tmpdir(), `cowboy-test-token-rate-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { runMigrations } = await import('../../src/db/migrate.js');
const { db } = await import('../../src/db/index.js');
const { getTokenRate } = await import('../../src/db/queries/analytics.js');
const { conversations, messages, tokenUsage } = await import('../../src/db/schema.js');

describe('getTokenRate', () => {
  beforeAll(() => {
    runMigrations();
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

  it('returns empty array when no token_usage rows exist', () => {
    const result = getTokenRate();
    expect(result).toEqual([]);
  });

  it('returns per-minute aggregated input/output tokens for rows within last 60 minutes', () => {
    // Insert a conversation, message, and token usage row with createdAt = now
    const now = new Date();
    const minuteStr = now.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"

    db.insert(conversations).values({
      id: 'rate-conv-1',
      agent: 'claude-code',
      title: 'Rate test',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      status: 'active',
    }).run();

    db.insert(messages).values({
      id: 'rate-msg-1',
      conversationId: 'rate-conv-1',
      role: 'assistant',
      content: 'test',
      createdAt: now.toISOString(),
      model: 'claude-sonnet-4-5',
    }).run();

    db.insert(tokenUsage).values({
      id: 'rate-tu-1',
      conversationId: 'rate-conv-1',
      messageId: 'rate-msg-1',
      model: 'claude-sonnet-4-5',
      inputTokens: 5000,
      outputTokens: 2000,
      createdAt: now.toISOString(),
    }).run();

    const result = getTokenRate();
    expect(result.length).toBeGreaterThanOrEqual(1);

    const point = result.find(p => p.minute === minuteStr);
    expect(point).toBeDefined();
    expect(point!.inputTokens).toBe(5000);
    expect(point!.outputTokens).toBe(2000);
  });

  it('excludes token_usage rows older than 60 minutes', () => {
    // Insert a row with createdAt > 60 minutes ago
    const oldTime = new Date(Date.now() - 90 * 60 * 1000); // 90 minutes ago

    db.insert(tokenUsage).values({
      id: 'rate-tu-old',
      conversationId: 'rate-conv-1',
      messageId: 'rate-msg-1',
      model: 'claude-sonnet-4-5',
      inputTokens: 99999,
      outputTokens: 88888,
      createdAt: oldTime.toISOString(),
    }).run();

    const result = getTokenRate();
    const oldMinute = oldTime.toISOString().slice(0, 16);
    const oldPoint = result.find(p => p.minute === oldMinute);
    expect(oldPoint).toBeUndefined();
  });

  it('groups multiple rows in the same minute into a single TokenRatePoint', () => {
    // Insert another token usage row in the same minute as the existing one
    const now = new Date();

    db.insert(tokenUsage).values({
      id: 'rate-tu-2',
      conversationId: 'rate-conv-1',
      messageId: 'rate-msg-1',
      model: 'claude-sonnet-4-5',
      inputTokens: 3000,
      outputTokens: 1000,
      createdAt: now.toISOString(),
    }).run();

    const result = getTokenRate();
    const minuteStr = now.toISOString().slice(0, 16);
    const point = result.find(p => p.minute === minuteStr);
    expect(point).toBeDefined();
    // Should be 5000 + 3000 = 8000 input, 2000 + 1000 = 3000 output
    expect(point!.inputTokens).toBe(8000);
    expect(point!.outputTokens).toBe(3000);
  });

  it('returns results sorted by minute ascending', () => {
    // Insert a row 10 minutes ago to create a second distinct minute
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

    db.insert(tokenUsage).values({
      id: 'rate-tu-3',
      conversationId: 'rate-conv-1',
      messageId: 'rate-msg-1',
      model: 'claude-sonnet-4-5',
      inputTokens: 1000,
      outputTokens: 500,
      createdAt: tenMinAgo.toISOString(),
    }).run();

    const result = getTokenRate();
    expect(result.length).toBeGreaterThanOrEqual(2);

    // Verify ascending order
    for (let i = 1; i < result.length; i++) {
      expect(result[i].minute >= result[i - 1].minute).toBe(true);
    }
  });
});
