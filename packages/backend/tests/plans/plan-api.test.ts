import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import * as schema from '../../src/db/schema.js';
import { extractPlans, inferStepCompletion } from '../../src/ingestion/plan-extractor.js';
import { generateId } from '../../src/ingestion/id-generator.js';

// Set up isolated test database before importing app
const testDbPath = path.join(os.tmpdir(), `cowboy-test-plan-api-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { buildApp } = await import('../../src/app.js');
const { runMigrations } = await import('../../src/db/migrate.js');
const { db } = await import('../../src/db/index.js');
const { seedPlanData } = await import('../fixtures/seed-plans.js');

/**
 * Helper: run plan extraction on seeded data.
 */
function runPlanExtraction() {
  const allMessages = db.select().from(schema.messages).all();
  const allToolCalls = db.select().from(schema.toolCalls).all();
  const conversations = db.select().from(schema.conversations).all();

  for (const conv of conversations) {
    const convMessages = allMessages
      .filter(m => m.conversationId === conv.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const convToolCalls = allToolCalls
      .filter(tc => tc.conversationId === conv.id);

    db.transaction((tx) => {
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

describe('Plan API Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    runMigrations();
    await seedPlanData(db);
    runPlanExtraction();
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

  // ── GET /api/plans ──────────────────────────────────────────────────

  describe('GET /api/plans', () => {
    it('returns paginated plan list with default params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans?from=2026-01-01&to=2026-12-31',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.rows).toBeDefined();
      expect(body.total).toBe(5);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(20);
      expect(body.rows.length).toBe(5);
    });

    it('filters by agent', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans?from=2026-01-01&to=2026-12-31&agent=claude-code',
      });

      const body = response.json();
      expect(body.total).toBe(5);

      const cursorResponse = await app.inject({
        method: 'GET',
        url: '/api/plans?from=2026-01-01&to=2026-12-31&agent=cursor',
      });

      const cursorBody = cursorResponse.json();
      expect(cursorBody.total).toBe(0);
    });

    it('filters by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans?from=2026-01-01&to=2026-12-31&status=partial',
      });

      const body = response.json();
      expect(body.total).toBeGreaterThanOrEqual(1);
      for (const row of body.rows) {
        expect(row.status).toBe('partial');
      }
    });

    it('supports pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans?from=2026-01-01&to=2026-12-31&page=1&limit=2',
      });

      const body = response.json();
      expect(body.rows.length).toBe(2);
      expect(body.total).toBe(5);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(2);
    });

    it('defaults to last 30 days when no dates provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('rows');
      expect(body).toHaveProperty('total');
    });
  });

  // ── GET /api/plans/:id ──────────────────────────────────────────────

  describe('GET /api/plans/:id', () => {
    it('returns plan detail with steps', async () => {
      // First, get a plan ID from the list
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/plans?from=2026-01-01&to=2026-12-31',
      });
      const planId = listResponse.json().rows[0].id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/plans/${planId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.plan).toBeDefined();
      expect(body.steps).toBeDefined();
      expect(body.steps.length).toBeGreaterThan(0);
      expect(body.conversationTitle).toBeDefined();
      expect(body.sourceMessageId).toBeDefined();
    });

    it('returns 404 for non-existent plan', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans/non-existent-plan-id',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('Plan not found');
    });
  });

  // ── GET /api/plans/stats ────────────────────────────────────────────

  describe('GET /api/plans/stats', () => {
    it('returns aggregate statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans/stats?from=2026-01-01&to=2026-12-31',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.totalPlans).toBe(5);
      expect(body.totalSteps).toBe(18);
      expect(typeof body.completionRate).toBe('number');
      expect(typeof body.avgStepsPerPlan).toBe('number');
    });

    it('filters by agent', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans/stats?from=2026-01-01&to=2026-12-31&agent=cursor',
      });

      const body = response.json();
      expect(body.totalPlans).toBe(0);
    });
  });

  // ── GET /api/plans/timeseries ───────────────────────────────────────

  describe('GET /api/plans/timeseries', () => {
    it('returns time series chart data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans/timeseries?from=2026-01-01&to=2026-12-31',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0]).toHaveProperty('period');
      expect(body[0]).toHaveProperty('planCount');
      expect(body[0]).toHaveProperty('completionRate');
    });

    it('supports granularity parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans/timeseries?from=2026-01-01&to=2026-12-31&granularity=monthly',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  // ── GET /api/plans/by-conversation/:conversationId ──────────────────

  describe('GET /api/plans/by-conversation/:conversationId', () => {
    it('returns plans for a conversation', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans/by-conversation/plan-conv-1',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].plan).toBeDefined();
      expect(body[0].steps).toBeDefined();
      expect(body[0].steps.length).toBe(5);
    });

    it('returns multiple plans for conversation with multiple plans', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans/by-conversation/plan-conv-6',
      });

      const body = response.json();
      expect(body.length).toBe(2);
    });

    it('returns empty array for conversation with no plans', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans/by-conversation/plan-conv-3',
      });

      const body = response.json();
      expect(body.length).toBe(0);
    });
  });
});
