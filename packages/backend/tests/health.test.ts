import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database before importing app
const testDbPath = path.join(os.tmpdir(), `cowboy-test-health-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

// Dynamic import after env is set so the db module picks up the test path
const { buildApp } = await import('../src/app.js');
const { runMigrations } = await import('../src/db/migrate.js');

describe('Health Check API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    runMigrations();
    app = await buildApp();
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
      // Files may not exist, that is fine
    }
  });

  it('GET /api/health returns 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
  });

  it('GET /api/health returns status ok and database connected', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
  });

  it('GET /api/health returns a valid ISO 8601 timestamp', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    const body = response.json();
    expect(body.timestamp).toBeDefined();
    expect(typeof body.timestamp).toBe('string');

    // Validate ISO 8601 format
    const parsed = new Date(body.timestamp);
    expect(parsed.toISOString()).toBe(body.timestamp);
  });
});
