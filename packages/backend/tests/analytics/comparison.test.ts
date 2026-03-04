import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database
const testDbPath = path.join(os.tmpdir(), `cowboy-test-comparison-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { runMigrations } = await import('../../src/db/migrate.js');
const { db } = await import('../../src/db/index.js');
const { getOverviewStats, getTimeSeries, getModelDistribution } = await import('../../src/db/queries/analytics.js');
const { conversations, tokenUsage, messages } = await import('../../src/db/schema.js');

/**
 * Seed data with distinct values for claude-code and cursor agents.
 * This enables testing that agent-filtered queries return independent results.
 *
 * Claude Code: 2 conversations on 2026-01-15, model claude-sonnet-4-5
 *   - conv-cc-1: input=100000, output=50000
 *   - conv-cc-2: input=200000, output=80000
 *
 * Cursor: 2 conversations on 2026-01-15, model claude-4.5-sonnet (Cursor alias)
 *   - conv-cur-1: input=30000, output=15000
 *   - conv-cur-2: input=50000, output=25000
 */
async function seedComparisonData() {
  db.insert(conversations).values([
    { id: 'conv-cc-1', agent: 'claude-code', project: 'project-alpha', title: 'CC Conv 1', createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:30:00Z', model: 'claude-sonnet-4-5' },
    { id: 'conv-cc-2', agent: 'claude-code', project: 'project-alpha', title: 'CC Conv 2', createdAt: '2026-01-15T14:00:00Z', updatedAt: '2026-01-15T14:30:00Z', model: 'claude-sonnet-4-5' },
    { id: 'conv-cur-1', agent: 'cursor', project: 'Cursor', title: 'Cursor Conv 1', createdAt: '2026-01-15T11:00:00Z', updatedAt: '2026-01-15T11:30:00Z', model: 'claude-4.5-sonnet' },
    { id: 'conv-cur-2', agent: 'cursor', project: 'Cursor', title: 'Cursor Conv 2', createdAt: '2026-01-15T15:00:00Z', updatedAt: '2026-01-15T15:30:00Z', model: 'claude-4.5-sonnet' },
  ]).run();

  db.insert(tokenUsage).values([
    { id: 'tu-cc-1', conversationId: 'conv-cc-1', model: 'claude-sonnet-4-5', inputTokens: 100000, outputTokens: 50000, cacheReadTokens: 10000, cacheCreationTokens: 5000, createdAt: '2026-01-15T10:00:00Z' },
    { id: 'tu-cc-2', conversationId: 'conv-cc-2', model: 'claude-sonnet-4-5', inputTokens: 200000, outputTokens: 80000, cacheReadTokens: 20000, cacheCreationTokens: 10000, createdAt: '2026-01-15T14:00:00Z' },
    { id: 'tu-cur-1', conversationId: 'conv-cur-1', model: 'claude-4.5-sonnet', inputTokens: 30000, outputTokens: 15000, cacheReadTokens: 3000, cacheCreationTokens: 1500, createdAt: '2026-01-15T11:00:00Z' },
    { id: 'tu-cur-2', conversationId: 'conv-cur-2', model: 'claude-4.5-sonnet', inputTokens: 50000, outputTokens: 25000, cacheReadTokens: 5000, cacheCreationTokens: 2500, createdAt: '2026-01-15T15:00:00Z' },
  ]).run();

  db.insert(messages).values([
    { id: 'msg-cc-1', conversationId: 'conv-cc-1', role: 'user', content: 'CC question 1', createdAt: '2026-01-15T10:00:00Z' },
    { id: 'msg-cc-2', conversationId: 'conv-cc-2', role: 'user', content: 'CC question 2', createdAt: '2026-01-15T14:00:00Z' },
    { id: 'msg-cur-1', conversationId: 'conv-cur-1', role: 'user', content: 'Cursor question 1', createdAt: '2026-01-15T11:00:00Z' },
    { id: 'msg-cur-2', conversationId: 'conv-cur-2', role: 'user', content: 'Cursor question 2', createdAt: '2026-01-15T15:00:00Z' },
  ]).run();
}

describe('Agent Comparison Queries (DASH-05 Backend Validation)', () => {
  beforeAll(async () => {
    runMigrations();
    await seedComparisonData();
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

  describe('getOverviewStats with agent filter', () => {
    it('returns only claude-code stats when agent="claude-code"', () => {
      const stats = getOverviewStats('2026-01-15', '2026-01-15', 'claude-code');
      expect(stats.conversationCount).toBe(2);
      expect(stats.totalInput).toBe(300000);  // 100000 + 200000
      expect(stats.totalOutput).toBe(130000); // 50000 + 80000
    });

    it('returns only cursor stats when agent="cursor"', () => {
      const stats = getOverviewStats('2026-01-15', '2026-01-15', 'cursor');
      expect(stats.conversationCount).toBe(2);
      expect(stats.totalInput).toBe(80000);  // 30000 + 50000
      expect(stats.totalOutput).toBe(40000); // 15000 + 25000
    });

    it('returns combined stats when agent is not specified', () => {
      const stats = getOverviewStats('2026-01-15', '2026-01-15');
      expect(stats.conversationCount).toBe(4);
      expect(stats.totalInput).toBe(380000);  // 300000 + 80000
      expect(stats.totalOutput).toBe(170000); // 130000 + 40000
    });

    it('combined totals equal sum of per-agent totals', () => {
      const ccStats = getOverviewStats('2026-01-15', '2026-01-15', 'claude-code');
      const cursorStats = getOverviewStats('2026-01-15', '2026-01-15', 'cursor');
      const allStats = getOverviewStats('2026-01-15', '2026-01-15');

      expect(allStats.totalInput).toBe(ccStats.totalInput + cursorStats.totalInput);
      expect(allStats.totalOutput).toBe(ccStats.totalOutput + cursorStats.totalOutput);
      expect(allStats.conversationCount).toBe(ccStats.conversationCount + cursorStats.conversationCount);
    });

    it('simultaneous queries via Promise.all return correct independent results', async () => {
      const [ccStats, cursorStats] = await Promise.all([
        Promise.resolve(getOverviewStats('2026-01-15', '2026-01-15', 'claude-code')),
        Promise.resolve(getOverviewStats('2026-01-15', '2026-01-15', 'cursor')),
      ]);

      // Verify no cross-contamination
      expect(ccStats.conversationCount).toBe(2);
      expect(ccStats.totalInput).toBe(300000);
      expect(cursorStats.conversationCount).toBe(2);
      expect(cursorStats.totalInput).toBe(80000);
    });
  });

  describe('getTimeSeries with agent filter', () => {
    it('returns only claude-code data when agent="claude-code"', () => {
      const ts = getTimeSeries('2026-01-15', '2026-01-15', 'daily', 'claude-code');
      expect(ts).toHaveLength(1);
      expect(ts[0].inputTokens).toBe(300000);
      expect(ts[0].conversationCount).toBe(2);
    });

    it('returns only cursor data when agent="cursor"', () => {
      const ts = getTimeSeries('2026-01-15', '2026-01-15', 'daily', 'cursor');
      expect(ts).toHaveLength(1);
      expect(ts[0].inputTokens).toBe(80000);
      expect(ts[0].conversationCount).toBe(2);
    });

    it('returns combined data when agent is not specified', () => {
      const ts = getTimeSeries('2026-01-15', '2026-01-15', 'daily');
      expect(ts).toHaveLength(1);
      expect(ts[0].inputTokens).toBe(380000);
      expect(ts[0].conversationCount).toBe(4);
    });

    it('simultaneous per-agent timeseries return independent data', async () => {
      const [ccTs, cursorTs] = await Promise.all([
        Promise.resolve(getTimeSeries('2026-01-15', '2026-01-15', 'daily', 'claude-code')),
        Promise.resolve(getTimeSeries('2026-01-15', '2026-01-15', 'daily', 'cursor')),
      ]);

      expect(ccTs[0].inputTokens).toBe(300000);
      expect(cursorTs[0].inputTokens).toBe(80000);
    });
  });

  describe('getModelDistribution', () => {
    it('returns model breakdown for all agents', () => {
      const dist = getModelDistribution('2026-01-15', '2026-01-15');
      expect(dist).toHaveLength(2); // claude-sonnet-4-5 + claude-4.5-sonnet

      const sonnet = dist.find(d => d.model === 'claude-sonnet-4-5');
      expect(sonnet).toBeDefined();
      expect(sonnet!.count).toBe(2);

      const cursorSonnet = dist.find(d => d.model === 'claude-4.5-sonnet');
      expect(cursorSonnet).toBeDefined();
      expect(cursorSonnet!.count).toBe(2);
    });

    it('filters by agent', () => {
      const dist = getModelDistribution('2026-01-15', '2026-01-15', 'cursor');
      expect(dist).toHaveLength(1);
      expect(dist[0].model).toBe('claude-4.5-sonnet');
      expect(dist[0].count).toBe(2);
    });
  });
});
