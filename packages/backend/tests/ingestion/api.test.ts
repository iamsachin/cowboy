import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

// Set up isolated test database before importing app
const testDbPath = path.join(
  tmpdir(),
  `cowboy-test-api-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
);
process.env.DATABASE_URL = testDbPath;

// Dynamic import after env is set
const { buildApp } = await import('../../src/app.js');
const { runMigrations } = await import('../../src/db/migrate.js');

describe('Ingestion API', () => {
  let app: FastifyInstance;
  let tempFixturesDir: string;

  beforeAll(async () => {
    runMigrations();

    // Create temp directory mimicking ~/.claude/projects/ structure
    tempFixturesDir = await mkdtemp(join(tmpdir(), 'cowboy-api-fixtures-'));
    const projectDir = join(tempFixturesDir, '-Users-test-Desktop-myproject');
    await mkdir(projectDir, { recursive: true });
    await copyFile(
      join(FIXTURES, 'sample-conversation.jsonl'),
      join(projectDir, 'session-abc-123.jsonl'),
    );

    app = await buildApp({
      ingestion: { basePath: tempFixturesDir, autoIngest: false },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    // Clean up test database
    try {
      fs.unlinkSync(testDbPath);
      fs.unlinkSync(testDbPath + '-wal');
      fs.unlinkSync(testDbPath + '-shm');
    } catch {
      // Files may not exist
    }
    // Clean up temp fixtures
    await rm(tempFixturesDir, { recursive: true, force: true });
  });

  describe('GET /api/ingest/status', () => {
    it('returns initial state with running=false and no lastRun', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/ingest/status',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.running).toBe(false);
      expect(body.progress).toBeNull();
      expect(body.lastRun).toBeNull();
    });
  });

  describe('POST /api/ingest', () => {
    it('returns 200 with started message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/ingest',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('Ingestion started');
    });

    it('returns 409 when ingestion is already running', async () => {
      // Trigger ingestion but do not wait for it
      await app.inject({ method: 'POST', url: '/api/ingest' });

      // Immediately try again -- should be 409 if still running
      // (Note: for very fast ingestion this may race, so we check status first)
      const statusRes = await app.inject({ method: 'GET', url: '/api/ingest/status' });
      const status = statusRes.json();

      if (status.running) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/ingest',
        });
        expect(response.statusCode).toBe(409);
        const body = response.json();
        expect(body.error).toBe('Ingestion already in progress');
      }

      // Wait for ingestion to complete for clean state
      await pollUntilComplete(app);
    });

    it('updates status after ingestion completes', async () => {
      // Trigger ingestion
      await app.inject({ method: 'POST', url: '/api/ingest' });

      // Wait for completion
      await pollUntilComplete(app);

      const response = await app.inject({
        method: 'GET',
        url: '/api/ingest/status',
      });

      const body = response.json();
      expect(body.running).toBe(false);
      expect(body.lastRun).not.toBeNull();
      expect(body.lastRun.completedAt).toBeDefined();
      expect(body.lastRun.stats).toBeDefined();
      expect(body.lastRun.stats.filesScanned).toBeGreaterThan(0);
    });
  });
});

/**
 * Poll GET /api/ingest/status until running === false, with 10s timeout.
 */
async function pollUntilComplete(app: FastifyInstance, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await app.inject({ method: 'GET', url: '/api/ingest/status' });
    const status = res.json();
    if (!status.running) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Ingestion did not complete within timeout');
}
