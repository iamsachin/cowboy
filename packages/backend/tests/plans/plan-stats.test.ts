import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import * as schema from '../../src/db/schema.js';

// Set up isolated test database before importing query functions (they use module-level db singleton)
const testDbPath = path.join(
  tmpdir(),
  `cowboy-test-plan-stats-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
);
process.env.DATABASE_URL = testDbPath;

const { seedPlanData } = await import('../fixtures/seed-plans.js');
const { extractPlans, inferStepCompletion } = await import('../../src/ingestion/plan-extractor.js');
const { generateId } = await import('../../src/ingestion/id-generator.js');
const { db } = await import('../../src/db/index.js');
const { runMigrations } = await import('../../src/db/migrate.js');

/**
 * Helper: run plan extraction on seeded data.
 */
function runPlanExtraction(testDb: BetterSQLite3Database<typeof schema>) {
  const allMessages = testDb.select().from(schema.messages).all();
  const allToolCalls = testDb.select().from(schema.toolCalls).all();
  const conversations = testDb.select().from(schema.conversations).all();

  for (const conv of conversations) {
    const convMessages = allMessages
      .filter(m => m.conversationId === conv.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const convToolCalls = allToolCalls
      .filter(tc => tc.conversationId === conv.id);

    testDb.transaction((tx) => {
      for (const msg of convMessages) {
        if (msg.role === 'assistant' && msg.content) {
          const extracted = extractPlans(msg.content, msg.id);

          const laterMessages = convMessages
            .filter(m => m.createdAt > msg.createdAt)
            .map(m => ({ role: m.role, content: m.content }));
          const toolCallsForContext = convToolCalls
            .map(tc => ({ name: tc.name, input: tc.input, status: tc.status }));
          const completionContext = { laterMessages, toolCalls: toolCallsForContext };

          for (const plan of extracted) {
            const stepsWithStatus = plan.steps.map(s => ({
              ...s,
              status: inferStepCompletion(s, completionContext),
            }));
            const completedCount = stepsWithStatus.filter(s => s.status === 'complete').length;
            const planStatus = completedCount === plan.steps.length ? 'complete'
              : completedCount === 0 ? (stepsWithStatus.some(s => s.status === 'incomplete') ? 'not-started' : 'unknown')
              : 'partial';

            const planId = generateId(conv.id, 'plan', msg.id, plan.title);
            tx.insert(schema.plans).values({
              id: planId,
              conversationId: conv.id,
              sourceMessageId: msg.id,
              title: plan.title,
              totalSteps: plan.steps.length,
              completedSteps: completedCount,
              status: planStatus,
              createdAt: msg.createdAt,
            }).onConflictDoNothing({ target: schema.plans.id }).run();

            for (const step of stepsWithStatus) {
              tx.insert(schema.planSteps).values({
                id: generateId(planId, String(step.stepNumber)),
                planId,
                stepNumber: step.stepNumber,
                content: step.content,
                status: step.status,
                createdAt: msg.createdAt,
              }).onConflictDoNothing({ target: schema.planSteps.id }).run();
            }
          }
        }
      }
    });
  }
}

describe('Plan Query Layer', () => {
  beforeAll(async () => {
    runMigrations();
    await seedPlanData(db);
    runPlanExtraction(db);
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

  // ── getPlanList ─────────────────────────────────────────────────────

  describe('getPlanList', () => {
    it('returns all plans paginated with default params', async () => {
      const { getPlanList } = await import('../../src/db/queries/plans.js');
      const result = getPlanList('2026-01-01', '2026-12-31');

      expect(result.rows.length).toBe(5);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      // Desc by date: latest first
      expect(result.rows[0].createdAt >= result.rows[result.rows.length - 1].createdAt).toBe(true);
    });

    it('returns plans filtered by agent', async () => {
      const { getPlanList } = await import('../../src/db/queries/plans.js');
      const result = getPlanList('2026-01-01', '2026-12-31', 1, 20, 'date', 'desc', 'claude-code');
      expect(result.total).toBe(5);

      const cursorResult = getPlanList('2026-01-01', '2026-12-31', 1, 20, 'date', 'desc', 'cursor');
      expect(cursorResult.total).toBe(0);
    });

    it('returns plans filtered by status', async () => {
      const { getPlanList } = await import('../../src/db/queries/plans.js');
      const partialResult = getPlanList('2026-01-01', '2026-12-31', 1, 20, 'date', 'desc', undefined, undefined, 'partial');
      expect(partialResult.total).toBeGreaterThanOrEqual(1);
      for (const row of partialResult.rows) {
        expect(row.status).toBe('partial');
      }
    });

    it('returns plans filtered by project', async () => {
      const { getPlanList } = await import('../../src/db/queries/plans.js');
      const alphaResult = getPlanList('2026-01-01', '2026-12-31', 1, 20, 'date', 'desc', undefined, 'project-alpha');
      expect(alphaResult.total).toBe(5);

      const betaResult = getPlanList('2026-01-01', '2026-12-31', 1, 20, 'date', 'desc', undefined, 'project-beta');
      expect(betaResult.total).toBe(0);
    });

    it('paginates correctly', async () => {
      const { getPlanList } = await import('../../src/db/queries/plans.js');
      const page1 = getPlanList('2026-01-01', '2026-12-31', 1, 2);
      expect(page1.rows.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.page).toBe(1);
      expect(page1.limit).toBe(2);

      const page2 = getPlanList('2026-01-01', '2026-12-31', 2, 2);
      expect(page2.rows.length).toBe(2);
      expect(page2.page).toBe(2);

      const page3 = getPlanList('2026-01-01', '2026-12-31', 3, 2);
      expect(page3.rows.length).toBe(1);
    });

    it('includes agent and project fields from conversation join', async () => {
      const { getPlanList } = await import('../../src/db/queries/plans.js');
      const result = getPlanList('2026-01-01', '2026-12-31');
      for (const row of result.rows) {
        expect(row).toHaveProperty('agent');
        expect(row).toHaveProperty('project');
        expect(row.agent).toBeTruthy();
      }
    });
  });

  // ── getPlanDetail ───────────────────────────────────────────────────

  describe('getPlanDetail', () => {
    it('returns plan with steps and conversation title', async () => {
      const { getPlanList, getPlanDetail } = await import('../../src/db/queries/plans.js');
      const list = getPlanList('2026-01-01', '2026-12-31');
      const planId = list.rows[0].id;

      const detail = getPlanDetail(planId);
      expect(detail).not.toBeNull();
      expect(detail!.plan).toBeDefined();
      expect(detail!.steps).toBeDefined();
      expect(detail!.steps.length).toBeGreaterThan(0);
      expect(detail!.conversationTitle).toBeDefined();
      expect(detail!.sourceMessageId).toBeDefined();
    });

    it('returns null for non-existent plan', async () => {
      const { getPlanDetail } = await import('../../src/db/queries/plans.js');
      const result = getPlanDetail('non-existent-plan-id');
      expect(result).toBeNull();
    });

    it('returns steps ordered by stepNumber', async () => {
      const { getPlanList, getPlanDetail } = await import('../../src/db/queries/plans.js');
      const list = getPlanList('2026-01-01', '2026-12-31');
      const planId = list.rows[0].id;

      const detail = getPlanDetail(planId);
      expect(detail).not.toBeNull();
      for (let i = 1; i < detail!.steps.length; i++) {
        expect(detail!.steps[i].stepNumber).toBeGreaterThan(detail!.steps[i - 1].stepNumber);
      }
    });
  });

  // ── getPlanStats ────────────────────────────────────────────────────

  describe('getPlanStats', () => {
    it('returns correct aggregate statistics', async () => {
      const { getPlanStats } = await import('../../src/db/queries/plans.js');
      const stats = getPlanStats('2026-01-01', '2026-12-31');

      expect(stats.totalPlans).toBe(5);
      // 5 + 4 + 3 + 3 + 3 = 18 total steps
      expect(stats.totalSteps).toBe(18);
      expect(stats.avgStepsPerPlan).toBeCloseTo(3.6, 1);
      expect(typeof stats.completionRate).toBe('number');
      expect(stats.completionRate).toBeGreaterThanOrEqual(0);
      expect(stats.completionRate).toBeLessThanOrEqual(100);
    });

    it('returns zeros when no plans exist in date range', async () => {
      const { getPlanStats } = await import('../../src/db/queries/plans.js');
      const stats = getPlanStats('2020-01-01', '2020-01-02');

      expect(stats.totalPlans).toBe(0);
      expect(stats.totalSteps).toBe(0);
      expect(stats.completionRate).toBe(0);
      expect(stats.avgStepsPerPlan).toBe(0);
    });

    it('filters by agent', async () => {
      const { getPlanStats } = await import('../../src/db/queries/plans.js');
      const claudeStats = getPlanStats('2026-01-01', '2026-12-31', 'claude-code');
      expect(claudeStats.totalPlans).toBe(5);

      const cursorStats = getPlanStats('2026-01-01', '2026-12-31', 'cursor');
      expect(cursorStats.totalPlans).toBe(0);
    });
  });

  // ── getPlanTimeSeries ───────────────────────────────────────────────

  describe('getPlanTimeSeries', () => {
    it('returns time series data with plan counts', async () => {
      const { getPlanTimeSeries } = await import('../../src/db/queries/plans.js');
      const series = getPlanTimeSeries('2026-01-01', '2026-12-31', 'daily');

      expect(Array.isArray(series)).toBe(true);
      expect(series.length).toBeGreaterThan(0);
      for (const point of series) {
        expect(point).toHaveProperty('period');
        expect(point).toHaveProperty('planCount');
        expect(point).toHaveProperty('completionRate');
        expect(typeof point.planCount).toBe('number');
        expect(typeof point.completionRate).toBe('number');
      }
    });

    it('returns data ordered by period ascending', async () => {
      const { getPlanTimeSeries } = await import('../../src/db/queries/plans.js');
      const series = getPlanTimeSeries('2026-01-01', '2026-12-31', 'daily');

      for (let i = 1; i < series.length; i++) {
        expect(series[i].period >= series[i - 1].period).toBe(true);
      }
    });

    it('supports weekly and monthly granularity', async () => {
      const { getPlanTimeSeries } = await import('../../src/db/queries/plans.js');
      const weekly = getPlanTimeSeries('2026-01-01', '2026-12-31', 'weekly');
      expect(Array.isArray(weekly)).toBe(true);

      const monthly = getPlanTimeSeries('2026-01-01', '2026-12-31', 'monthly');
      expect(Array.isArray(monthly)).toBe(true);
    });
  });

  // ── getPlansByConversation ──────────────────────────────────────────

  describe('getPlansByConversation', () => {
    it('returns plans for a conversation with steps', async () => {
      const { getPlansByConversation } = await import('../../src/db/queries/plans.js');
      const result = getPlansByConversation('plan-conv-1');

      expect(result.length).toBe(1);
      expect(result[0].plan).toBeDefined();
      expect(result[0].steps).toBeDefined();
      expect(result[0].steps.length).toBe(5);
    });

    it('returns multiple plans for a conversation', async () => {
      const { getPlansByConversation } = await import('../../src/db/queries/plans.js');
      const result = getPlansByConversation('plan-conv-6');
      expect(result.length).toBe(2);
    });

    it('returns empty array for conversation with no plans', async () => {
      const { getPlansByConversation } = await import('../../src/db/queries/plans.js');
      const result = getPlansByConversation('plan-conv-3');
      expect(result.length).toBe(0);
    });

    it('returns empty array for non-existent conversation', async () => {
      const { getPlansByConversation } = await import('../../src/db/queries/plans.js');
      const result = getPlansByConversation('non-existent-conv');
      expect(result.length).toBe(0);
    });
  });
});
