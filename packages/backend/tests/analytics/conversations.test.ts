import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database
const testDbPath = path.join(os.tmpdir(), `cowboy-test-conversations-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { buildApp } = await import('../../src/app.js');
const { runMigrations } = await import('../../src/db/migrate.js');
const { db } = await import('../../src/db/index.js');
const { seedAnalyticsData, EXPECTED_CONVERSATION_COUNT } = await import('../fixtures/seed-analytics.js');

describe('Analytics Conversations API', () => {
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

  it('GET /api/analytics/conversations returns paginated results', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations?from=2026-01-15&to=2026-01-17&page=1&limit=2',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.rows).toHaveLength(2);
    expect(body.total).toBe(EXPECTED_CONVERSATION_COUNT);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(2);
  });

  it('each row has all 4 token columns, cost, and savings', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations?from=2026-01-15&to=2026-01-17&page=1&limit=20',
    });

    const body = response.json();
    for (const row of body.rows) {
      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('date');
      expect(row).toHaveProperty('project');
      expect(row).toHaveProperty('model');
      expect(row).toHaveProperty('inputTokens');
      expect(row).toHaveProperty('outputTokens');
      expect(row).toHaveProperty('cacheReadTokens');
      expect(row).toHaveProperty('cacheCreationTokens');
      expect(row).toHaveProperty('cost');
      expect(row).toHaveProperty('savings');
    }
  });

  it('row with unknown model has null cost and savings', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations?from=2026-01-15&to=2026-01-17&page=1&limit=20',
    });

    const body = response.json();
    const unknownRow = body.rows.find((r: { model: string }) => r.model === 'unknown-model');
    expect(unknownRow).toBeDefined();
    expect(unknownRow.cost).toBeNull();
    expect(unknownRow.savings).toBeNull();
  });

  it('rows with known models have non-null cost and savings', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations?from=2026-01-15&to=2026-01-17&page=1&limit=20',
    });

    const body = response.json();
    const knownRows = body.rows.filter((r: { model: string }) => r.model !== 'unknown-model');
    expect(knownRows.length).toBe(4);
    for (const row of knownRows) {
      expect(row.cost).not.toBeNull();
      expect(row.cost).toBeGreaterThan(0);
      expect(row.savings).not.toBeNull();
      expect(row.savings).toBeGreaterThanOrEqual(0);
    }
  });

  it('default sort is by date descending', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations?from=2026-01-15&to=2026-01-17&page=1&limit=20',
    });

    const body = response.json();
    const dates = body.rows.map((r: { date: string }) => r.date);
    // Should be sorted descending
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i] >= dates[i + 1]).toBe(true);
    }
  });

  it('page 2 returns remaining rows', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations?from=2026-01-15&to=2026-01-17&page=2&limit=2',
    });

    const body = response.json();
    expect(body.rows).toHaveLength(2);
    expect(body.total).toBe(EXPECTED_CONVERSATION_COUNT);
    expect(body.page).toBe(2);
  });

  it('page 3 returns last remaining row', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations?from=2026-01-15&to=2026-01-17&page=3&limit=2',
    });

    const body = response.json();
    expect(body.rows).toHaveLength(1);
    expect(body.total).toBe(EXPECTED_CONVERSATION_COUNT);
    expect(body.page).toBe(3);
  });
});
