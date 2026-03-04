import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database before importing app
const testDbPath = path.join(os.tmpdir(), `cowboy-test-tool-stats-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { buildApp } = await import('../../src/app.js');
const { runMigrations } = await import('../../src/db/migrate.js');
const { db } = await import('../../src/db/index.js');
const { seedAnalyticsData } = await import('../fixtures/seed-analytics.js');

describe('Analytics Tool Stats API', () => {
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

  it('GET /api/analytics/tool-stats returns correct per-tool aggregates', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/tool-stats?from=2026-01-15&to=2026-01-17',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // Should return 3 tools ordered by total DESC: Read(5), Bash(3), Write(2)
    expect(body).toHaveLength(3);

    // Read tool: 5 calls (tc-1, tc-3, tc-5, tc-8, tc-10), all completed
    const readTool = body.find((t: any) => t.name === 'Read');
    expect(readTool).toBeDefined();
    expect(readTool.total).toBe(5);
    expect(readTool.success).toBe(5);
    expect(readTool.failure).toBe(0);
    // avgDuration = (150+80+120+90+200)/5 = 128
    expect(readTool.avgDuration).toBe(128);
    // p95: sorted=[80,90,120,150,200], idx=floor(5*0.95)=4, p95=200
    expect(readTool.p95Duration).toBe(200);

    // Bash tool: 3 calls (tc-4 error, tc-6 completed, tc-9 completed)
    const bashTool = body.find((t: any) => t.name === 'Bash');
    expect(bashTool).toBeDefined();
    expect(bashTool.total).toBe(3);
    expect(bashTool.success).toBe(2);
    expect(bashTool.failure).toBe(1);
    // avgDuration = (5000+3000+1500)/3 = 3166.67 rounded to 3167
    expect(bashTool.avgDuration).toBe(3167);
    // p95: sorted=[1500,3000,5000], idx=floor(3*0.95)=2, p95=5000
    expect(bashTool.p95Duration).toBe(5000);

    // Write tool: 2 calls (tc-2 completed, tc-7 error)
    const writeTool = body.find((t: any) => t.name === 'Write');
    expect(writeTool).toBeDefined();
    expect(writeTool.total).toBe(2);
    expect(writeTool.success).toBe(1);
    expect(writeTool.failure).toBe(1);
    // avgDuration = (200+100)/2 = 150
    expect(writeTool.avgDuration).toBe(150);
    // p95: sorted=[100,200], idx=floor(2*0.95)=1, p95=200
    expect(writeTool.p95Duration).toBe(200);
  });

  it('GET /api/analytics/tool-stats with agent=cursor returns empty array', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/tool-stats?from=2026-01-15&to=2026-01-17&agent=cursor',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toEqual([]);
  });

  it('GET /api/analytics/tool-stats with narrow date range filters correctly', async () => {
    // Only 2026-01-15: conv-1 (tc-1 Read, tc-2 Write) + conv-2 (tc-3 Read, tc-4 Bash, tc-5 Read)
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/tool-stats?from=2026-01-15&to=2026-01-15',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // Read: 3 (tc-1, tc-3, tc-5), Bash: 1 (tc-4), Write: 1 (tc-2)
    expect(body).toHaveLength(3);

    const readTool = body.find((t: any) => t.name === 'Read');
    expect(readTool.total).toBe(3);
  });
});
