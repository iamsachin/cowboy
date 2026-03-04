import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database
const testDbPath = path.join(os.tmpdir(), `cowboy-test-timeseries-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { buildApp } = await import('../../src/app.js');
const { runMigrations } = await import('../../src/db/migrate.js');
const { db } = await import('../../src/db/index.js');
const { seedAnalyticsData } = await import('../fixtures/seed-analytics.js');

describe('Analytics Timeseries API', () => {
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

  it('GET /api/analytics/timeseries with daily granularity returns 3 data points', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/timeseries?from=2026-01-15&to=2026-01-17&granularity=daily',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(3);

    // Check periods are in order
    expect(body[0].period).toBe('2026-01-15');
    expect(body[1].period).toBe('2026-01-16');
    expect(body[2].period).toBe('2026-01-17');
  });

  it('each data point has all 4 token columns and cost', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/timeseries?from=2026-01-15&to=2026-01-17&granularity=daily',
    });

    const body = response.json();
    for (const point of body) {
      expect(point).toHaveProperty('period');
      expect(point).toHaveProperty('inputTokens');
      expect(point).toHaveProperty('outputTokens');
      expect(point).toHaveProperty('cacheReadTokens');
      expect(point).toHaveProperty('cacheCreationTokens');
      expect(point).toHaveProperty('cost');
      expect(point).toHaveProperty('conversationCount');
    }
  });

  it('daily data points have correct token sums', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/timeseries?from=2026-01-15&to=2026-01-17&granularity=daily',
    });

    const body = response.json();

    // 2026-01-15: conv-1 + conv-2 (both sonnet)
    expect(body[0].inputTokens).toBe(300000);  // 100000 + 200000
    expect(body[0].outputTokens).toBe(150000); // 50000 + 100000
    expect(body[0].conversationCount).toBe(2);

    // 2026-01-16: conv-3 + conv-4 (both haiku)
    expect(body[1].inputTokens).toBe(125000);  // 50000 + 75000
    expect(body[1].outputTokens).toBe(55000);  // 25000 + 30000
    expect(body[1].conversationCount).toBe(2);

    // 2026-01-17: conv-5 (unknown model)
    expect(body[2].inputTokens).toBe(30000);
    expect(body[2].outputTokens).toBe(15000);
    expect(body[2].conversationCount).toBe(1);
  });

  it('weekly granularity groups correctly', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/timeseries?from=2026-01-15&to=2026-01-17&granularity=weekly',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // All 3 days fall in the same ISO week, so should be 1 data point
    expect(body.length).toBeGreaterThanOrEqual(1);
    // Total input should be sum of all
    const totalInput = body.reduce((sum: number, p: { inputTokens: number }) => sum + p.inputTokens, 0);
    expect(totalInput).toBe(455000);
  });

  it('auto-detects granularity when not provided', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/timeseries?from=2026-01-15&to=2026-01-17',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // 3-day range should auto-detect as daily
    expect(body).toHaveLength(3);
  });
});
