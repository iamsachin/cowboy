import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database before importing app
const testDbPath = path.join(os.tmpdir(), `cowboy-test-settings-api-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { buildApp } = await import('../../src/app.js');
const { runMigrations } = await import('../../src/db/migrate.js');

describe('Settings API Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    runMigrations();
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

  // -- GET /api/settings ---------------------------------------------------

  describe('GET /api/settings', () => {
    it('returns 200 with default values on empty DB', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/settings',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // Agent defaults
      expect(body.claudeCodeEnabled).toBe(true);
      expect(body.cursorEnabled).toBe(true);

      // Default paths must be pre-filled (NOT empty strings)
      expect(body.claudeCodePath).not.toBe('');
      expect(body.claudeCodePath).toContain('.claude/projects');

      // On macOS/Linux, cursorPath should also be pre-filled
      if (process.platform === 'darwin' || process.platform === 'linux') {
        expect(body.cursorPath).not.toBe('');
        expect(body.cursorPath).toContain('Cursor');
      }

      // Sync defaults
      expect(body.syncEnabled).toBe(false);
      expect(body.syncFrequency).toBe(900);
      expect(body.syncCategories).toEqual(['conversations', 'messages', 'toolCalls', 'tokenUsage', 'plans']);

      // Status fields should be null initially
      expect(body.lastSyncAt).toBeNull();
      expect(body.lastSyncError).toBeNull();
      expect(body.lastSyncSuccess).toBeNull();
    });

    it('returns existing row on subsequent calls (does not overwrite)', async () => {
      // First call seeds, second call returns same row
      const response1 = await app.inject({ method: 'GET', url: '/api/settings' });
      const response2 = await app.inject({ method: 'GET', url: '/api/settings' });

      expect(response1.json()).toEqual(response2.json());
    });
  });

  // -- PUT /api/settings/agent ----------------------------------------------

  describe('PUT /api/settings/agent', () => {
    it('updates agent config and returns updated settings', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/settings/agent',
        payload: {
          claudeCodePath: '/custom/claude/path',
          claudeCodeEnabled: false,
          cursorPath: '/custom/cursor/path',
          cursorEnabled: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.claudeCodePath).toBe('/custom/claude/path');
      expect(body.claudeCodeEnabled).toBe(false);
      expect(body.cursorPath).toBe('/custom/cursor/path');
      expect(body.cursorEnabled).toBe(true);
    });
  });

  // -- PUT /api/settings/sync -----------------------------------------------

  describe('PUT /api/settings/sync', () => {
    it('updates sync config and returns updated settings', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/settings/sync',
        payload: {
          syncEnabled: true,
          syncUrl: 'https://example.com/sync',
          syncFrequency: 300,
          syncCategories: ['conversations', 'messages'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.syncEnabled).toBe(true);
      expect(body.syncUrl).toBe('https://example.com/sync');
      expect(body.syncFrequency).toBe(300);
      expect(body.syncCategories).toEqual(['conversations', 'messages']);
    });
  });

  // -- POST /api/settings/test-sync -----------------------------------------

  describe('POST /api/settings/test-sync', () => {
    it('reports failure for unreachable URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/settings/test-sync',
        payload: {
          url: 'http://127.0.0.1:19999/nonexistent',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });
  });

  // -- GET /api/settings reflects persisted changes -------------------------

  describe('Persistence', () => {
    it('GET /api/settings reflects changes from PUT', async () => {
      // Make agent changes
      await app.inject({
        method: 'PUT',
        url: '/api/settings/agent',
        payload: {
          claudeCodePath: '/persisted/claude',
          claudeCodeEnabled: true,
          cursorPath: '/persisted/cursor',
          cursorEnabled: false,
        },
      });

      // Make sync changes
      await app.inject({
        method: 'PUT',
        url: '/api/settings/sync',
        payload: {
          syncEnabled: true,
          syncUrl: 'https://persisted.example.com/sync',
          syncFrequency: 3600,
          syncCategories: ['plans'],
        },
      });

      // Verify GET reflects all changes
      const response = await app.inject({ method: 'GET', url: '/api/settings' });
      const body = response.json();

      expect(body.claudeCodePath).toBe('/persisted/claude');
      expect(body.claudeCodeEnabled).toBe(true);
      expect(body.cursorPath).toBe('/persisted/cursor');
      expect(body.cursorEnabled).toBe(false);
      expect(body.syncEnabled).toBe(true);
      expect(body.syncUrl).toBe('https://persisted.example.com/sync');
      expect(body.syncFrequency).toBe(3600);
      expect(body.syncCategories).toEqual(['plans']);
    });
  });
});
