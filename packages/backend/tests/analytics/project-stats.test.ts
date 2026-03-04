import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database before importing app
const testDbPath = path.join(os.tmpdir(), `cowboy-test-project-stats-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { buildApp } = await import('../../src/app.js');
const { runMigrations } = await import('../../src/db/migrate.js');
const { db } = await import('../../src/db/index.js');
const { seedAnalyticsData } = await import('../fixtures/seed-analytics.js');

describe('Analytics Project Stats API', () => {
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

  it('GET /api/analytics/project-stats returns per-project grouped analytics', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/project-stats?from=2026-01-15&to=2026-01-17',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // 2 projects: project-alpha (3 convs), project-beta (2 convs)
    expect(body).toHaveLength(2);

    const alpha = body.find((p: any) => p.project === 'project-alpha');
    expect(alpha).toBeDefined();
    expect(alpha.conversationCount).toBe(3);
    // Token totals for project-alpha (conv-1 + conv-2 + conv-5):
    // input: 100000 + 200000 + 30000 = 330000
    expect(alpha.totalInput).toBe(330000);
    // output: 50000 + 100000 + 15000 = 165000
    expect(alpha.totalOutput).toBe(165000);
    // cacheRead: 20000 + 40000 + 5000 = 65000
    expect(alpha.totalCacheRead).toBe(65000);
    // cacheCreation: 10000 + 20000 + 3000 = 33000
    expect(alpha.totalCacheCreation).toBe(33000);
    // totalTokens = sum of all 4
    expect(alpha.totalTokens).toBe(330000 + 165000 + 65000 + 33000);
    // lastActive: max createdAt among conv-1/2/5 = 2026-01-17T11:00:00Z
    expect(alpha.lastActive).toBe('2026-01-17T11:00:00Z');

    const beta = body.find((p: any) => p.project === 'project-beta');
    expect(beta).toBeDefined();
    expect(beta.conversationCount).toBe(2);
    expect(beta.totalInput).toBe(125000);
    expect(beta.totalOutput).toBe(55000);
    expect(beta.totalCacheRead).toBe(25000);
    expect(beta.totalCacheCreation).toBe(13000);
  });

  it('project-stats rows include token breakdown and cost fields', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/project-stats?from=2026-01-15&to=2026-01-17',
    });

    const body = response.json();
    const alpha = body.find((p: any) => p.project === 'project-alpha');

    expect(alpha).toHaveProperty('totalTokens');
    expect(alpha).toHaveProperty('totalCost');
    expect(alpha).toHaveProperty('totalInput');
    expect(alpha).toHaveProperty('totalOutput');
    expect(alpha).toHaveProperty('totalCacheRead');
    expect(alpha).toHaveProperty('totalCacheCreation');
    expect(alpha).toHaveProperty('lastActive');

    // Cost should be > 0 (sonnet conversations have known pricing)
    expect(alpha.totalCost).toBeGreaterThan(0);
  });

  it('project-stats rows include topModels array', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/project-stats?from=2026-01-15&to=2026-01-17',
    });

    const body = response.json();

    const alpha = body.find((p: any) => p.project === 'project-alpha');
    expect(alpha.topModels).toBeDefined();
    expect(Array.isArray(alpha.topModels)).toBe(true);
    // project-alpha: 2 convs with claude-sonnet-4-5 (conv-1, conv-2), 1 conv with unknown-model (conv-5)
    expect(alpha.topModels).toHaveLength(2);
    expect(alpha.topModels[0]).toEqual({ model: 'claude-sonnet-4-5', count: 2 });
    expect(alpha.topModels[1]).toEqual({ model: 'unknown-model', count: 1 });

    const beta = body.find((p: any) => p.project === 'project-beta');
    expect(beta.topModels).toBeDefined();
    // project-beta: 2 convs with claude-haiku-4-5
    expect(beta.topModels).toHaveLength(1);
    expect(beta.topModels[0]).toEqual({ model: 'claude-haiku-4-5', count: 2 });
  });

  it('project-stats with agent=cursor returns empty array', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/project-stats?from=2026-01-15&to=2026-01-17&agent=cursor',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toEqual([]);
  });
});
