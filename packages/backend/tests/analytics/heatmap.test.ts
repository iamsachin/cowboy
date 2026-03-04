import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database before importing app
const testDbPath = path.join(os.tmpdir(), `cowboy-test-heatmap-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { buildApp } = await import('../../src/app.js');
const { runMigrations } = await import('../../src/db/migrate.js');
const { db } = await import('../../src/db/index.js');
const { seedAnalyticsData } = await import('../fixtures/seed-analytics.js');

describe('Analytics Heatmap API', () => {
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

  it('GET /api/analytics/heatmap returns daily conversation counts', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/heatmap?from=2026-01-15&to=2026-01-17',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // 3 active days: 2026-01-15 (2 convs), 2026-01-16 (2 convs), 2026-01-17 (1 conv)
    expect(body).toHaveLength(3);
    expect(body[0]).toEqual({ date: '2026-01-15', count: 2 });
    expect(body[1]).toEqual({ date: '2026-01-16', count: 2 });
    expect(body[2]).toEqual({ date: '2026-01-17', count: 1 });
  });

  it('GET /api/analytics/heatmap with single day returns 1 entry', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/heatmap?from=2026-01-15&to=2026-01-15',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual({ date: '2026-01-15', count: 2 });
  });

  it('GET /api/analytics/heatmap with agent filter works', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/heatmap?from=2026-01-15&to=2026-01-17&agent=cursor',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toEqual([]);
  });

  it('GET /api/analytics/heatmap with no params defaults to 30d range', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/heatmap',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // Should not error, returns array
    expect(Array.isArray(body)).toBe(true);
  });
});
