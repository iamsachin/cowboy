import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database
const testDbPath = path.join(os.tmpdir(), `cowboy-test-multimodel-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { buildApp } = await import('../../src/app.js');
const { runMigrations } = await import('../../src/db/migrate.js');
const { db } = await import('../../src/db/index.js');
const { conversations, messages, tokenUsage } = await import('../../src/db/schema.js');

/**
 * Seed multi-model test data:
 *   conv-mm-1: Uses both opus and haiku in a single conversation.
 *     - Opus turn: input=100000, output=50000, cacheRead=0, cacheCreation=0
 *     - Haiku turn: input=500000, output=200000, cacheRead=0, cacheCreation=0
 *     Correct cost = opus(100000*15 + 50000*75)/1M + haiku(500000*1 + 200000*5)/1M
 *                  = (1500000 + 3750000)/1M + (500000 + 1000000)/1M
 *                  = 5.25 + 1.5 = 6.75
 *     BUG cost (all at opus rate): (600000*15 + 250000*75)/1M = (9000000+18750000)/1M = 27.75
 *     BUG cost (all at haiku rate): (600000*1 + 250000*5)/1M = (600000+1250000)/1M = 1.85
 *
 *   conv-mm-2: Pure opus conversation (expensive per token, fewer tokens).
 *     - Opus turn: input=50000, output=20000, cacheRead=0, cacheCreation=0
 *     Correct cost = (50000*15 + 20000*75)/1M = (750000 + 1500000)/1M = 2.25
 *
 *   conv-mm-3: Pure haiku conversation (cheap per token, more tokens).
 *     - Haiku turn: input=800000, output=300000, cacheRead=0, cacheCreation=0
 *     Correct cost = (800000*1 + 300000*5)/1M = (800000 + 1500000)/1M = 2.3
 *
 * Cost order: conv-mm-1 (6.75) > conv-mm-3 (2.3) > conv-mm-2 (2.25)
 * InputTokens order: conv-mm-3 (800000) > conv-mm-1 (600000) > conv-mm-2 (50000)
 *
 * If sort=cost used inputTokens as proxy, conv-mm-3 would come first (wrong).
 * Correct sort by cost desc: conv-mm-1 > conv-mm-3 > conv-mm-2.
 */
async function seedMultiModelData() {
  db.insert(conversations).values([
    { id: 'conv-mm-1', agent: 'claude-code', project: 'test-project', title: 'Multi-model conv', createdAt: '2026-02-01T10:00:00Z', updatedAt: '2026-02-01T10:30:00Z', model: 'claude-opus-4-1' },
    { id: 'conv-mm-2', agent: 'claude-code', project: 'test-project', title: 'Opus only conv', createdAt: '2026-02-01T11:00:00Z', updatedAt: '2026-02-01T11:30:00Z', model: 'claude-opus-4-1' },
    { id: 'conv-mm-3', agent: 'claude-code', project: 'test-project', title: 'Haiku only conv', createdAt: '2026-02-01T12:00:00Z', updatedAt: '2026-02-01T12:30:00Z', model: 'claude-haiku-4-5' },
  ]).run();

  db.insert(messages).values([
    { id: 'mm-msg-1a', conversationId: 'conv-mm-1', role: 'user', content: 'Hello', createdAt: '2026-02-01T10:00:00Z', model: null },
    { id: 'mm-msg-1b', conversationId: 'conv-mm-1', role: 'assistant', content: 'Hi (opus)', createdAt: '2026-02-01T10:01:00Z', model: 'claude-opus-4-1' },
    { id: 'mm-msg-1c', conversationId: 'conv-mm-1', role: 'assistant', content: 'Hi (haiku)', createdAt: '2026-02-01T10:02:00Z', model: 'claude-haiku-4-5' },
    { id: 'mm-msg-2a', conversationId: 'conv-mm-2', role: 'user', content: 'Hello', createdAt: '2026-02-01T11:00:00Z', model: null },
    { id: 'mm-msg-2b', conversationId: 'conv-mm-2', role: 'assistant', content: 'Hi (opus)', createdAt: '2026-02-01T11:01:00Z', model: 'claude-opus-4-1' },
    { id: 'mm-msg-3a', conversationId: 'conv-mm-3', role: 'user', content: 'Hello', createdAt: '2026-02-01T12:00:00Z', model: null },
    { id: 'mm-msg-3b', conversationId: 'conv-mm-3', role: 'assistant', content: 'Hi (haiku)', createdAt: '2026-02-01T12:01:00Z', model: 'claude-haiku-4-5' },
  ]).run();

  db.insert(tokenUsage).values([
    // conv-mm-1: opus turn + haiku turn (multi-model)
    { id: 'mm-tu-1a', conversationId: 'conv-mm-1', messageId: 'mm-msg-1b', model: 'claude-opus-4-1', inputTokens: 100000, outputTokens: 50000, cacheReadTokens: 0, cacheCreationTokens: 0, createdAt: '2026-02-01T10:01:00Z' },
    { id: 'mm-tu-1b', conversationId: 'conv-mm-1', messageId: 'mm-msg-1c', model: 'claude-haiku-4-5', inputTokens: 500000, outputTokens: 200000, cacheReadTokens: 0, cacheCreationTokens: 0, createdAt: '2026-02-01T10:02:00Z' },
    // conv-mm-2: opus only
    { id: 'mm-tu-2', conversationId: 'conv-mm-2', messageId: 'mm-msg-2b', model: 'claude-opus-4-1', inputTokens: 50000, outputTokens: 20000, cacheReadTokens: 0, cacheCreationTokens: 0, createdAt: '2026-02-01T11:01:00Z' },
    // conv-mm-3: haiku only (lots of tokens but cheap)
    { id: 'mm-tu-3', conversationId: 'conv-mm-3', messageId: 'mm-msg-3b', model: 'claude-haiku-4-5', inputTokens: 800000, outputTokens: 300000, cacheReadTokens: 0, cacheCreationTokens: 0, createdAt: '2026-02-01T12:01:00Z' },
  ]).run();
}

// Expected costs:
// conv-mm-1: opus=(100000*15 + 50000*75)/1M = 5.25, haiku=(500000*1 + 200000*5)/1M = 1.5, total = 6.75
// conv-mm-2: opus=(50000*15 + 20000*75)/1M = 2.25
// conv-mm-3: haiku=(800000*1 + 300000*5)/1M = 2.3
const EXPECTED_MM1_COST = 6.75;
const EXPECTED_MM2_COST = 2.25;
const EXPECTED_MM3_COST = 2.3;

describe('Multi-model cost calculation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    runMigrations();
    await seedMultiModelData();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    try {
      fs.unlinkSync(testDbPath);
      fs.unlinkSync(testDbPath + '-wal');
      fs.unlinkSync(testDbPath + '-shm');
    } catch {
      // Files may not exist
    }
  });

  it('computePeriodStats prices each model separately in multi-model conversation', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/overview?from=2026-02-01&to=2026-02-01',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // Total cost should be sum of per-model costs: 6.75 + 2.25 + 2.3 = 11.3
    const expectedTotalCost = EXPECTED_MM1_COST + EXPECTED_MM2_COST + EXPECTED_MM3_COST;
    expect(body.estimatedCost).toBeCloseTo(expectedTotalCost, 4);
  });

  it('getConversations sorted by cost returns opus-heavy conversation first', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations?from=2026-02-01&to=2026-02-01&sort=cost&order=desc&limit=20',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const rows = body.rows;

    expect(rows).toHaveLength(3);

    // Correct order by cost desc: conv-mm-1 (6.75) > conv-mm-3 (2.3) > conv-mm-2 (2.25)
    expect(rows[0].id).toBe('conv-mm-1');
    expect(rows[0].cost).toBeCloseTo(EXPECTED_MM1_COST, 4);

    expect(rows[1].id).toBe('conv-mm-3');
    expect(rows[1].cost).toBeCloseTo(EXPECTED_MM3_COST, 4);

    expect(rows[2].id).toBe('conv-mm-2');
    expect(rows[2].cost).toBeCloseTo(EXPECTED_MM2_COST, 4);
  });
});
