import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database before importing app
const testDbPath = path.join(os.tmpdir(), `cowboy-test-overview-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { buildApp } = await import('../../src/app.js');
const { runMigrations } = await import('../../src/db/migrate.js');
const { db } = await import('../../src/db/index.js');
const { seedAnalyticsData, EXPECTED_TOTAL_INPUT, EXPECTED_TOTAL_OUTPUT, EXPECTED_TOTAL_CACHE_READ, EXPECTED_TOTAL_CACHE_CREATION, EXPECTED_CONVERSATION_COUNT, EXPECTED_ACTIVE_DAYS, EXPECTED_TOTAL_COST, EXPECTED_TOTAL_SAVINGS } = await import('../fixtures/seed-analytics.js');

describe('Analytics Overview API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    runMigrations();
    await seedAnalyticsData(db);
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

  it('GET /api/analytics/overview returns 200 with correct totals', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/overview?from=2026-01-15&to=2026-01-17',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.totalInput).toBe(EXPECTED_TOTAL_INPUT);
    expect(body.totalOutput).toBe(EXPECTED_TOTAL_OUTPUT);
    expect(body.totalCacheRead).toBe(EXPECTED_TOTAL_CACHE_READ);
    expect(body.totalCacheCreation).toBe(EXPECTED_TOTAL_CACHE_CREATION);
    expect(body.totalTokens).toBe(EXPECTED_TOTAL_INPUT + EXPECTED_TOTAL_OUTPUT + EXPECTED_TOTAL_CACHE_READ + EXPECTED_TOTAL_CACHE_CREATION);
    expect(body.conversationCount).toBe(EXPECTED_CONVERSATION_COUNT);
    expect(body.activeDays).toBe(EXPECTED_ACTIVE_DAYS);
  });

  it('returns correct estimated cost and savings', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/overview?from=2026-01-15&to=2026-01-17',
    });

    const body = response.json();
    expect(body.estimatedCost).toBeCloseTo(EXPECTED_TOTAL_COST, 4);
    expect(body.totalSavings).toBeCloseTo(EXPECTED_TOTAL_SAVINGS, 4);
  });

  it('returns null trends when prior period has no data', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/overview?from=2026-01-15&to=2026-01-17',
    });

    const body = response.json();
    expect(body.trends.tokensTrend).toBeNull();
    expect(body.trends.costTrend).toBeNull();
    expect(body.trends.conversationsTrend).toBeNull();
    expect(body.trends.activeDaysTrend).toBeNull();
  });

  it('filters by date range - narrower range returns subset', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/overview?from=2026-01-15&to=2026-01-15',
    });

    const body = response.json();
    // Only conv-1 and conv-2 are on 2026-01-15
    expect(body.conversationCount).toBe(2);
    expect(body.activeDays).toBe(1);
    expect(body.totalInput).toBe(300000); // 100000 + 200000
    expect(body.totalOutput).toBe(150000); // 50000 + 100000
  });

  it('returns sensible defaults when no query params provided', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/overview',
    });

    // Should not error - defaults to last 30 days
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('totalTokens');
    expect(body).toHaveProperty('trends');
  });
});
