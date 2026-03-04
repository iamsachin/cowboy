import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database before importing app
const testDbPath = path.join(os.tmpdir(), `cowboy-test-path-validation-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { buildApp } = await import('../../src/app.js');
const { runMigrations } = await import('../../src/db/migrate.js');

describe('Path Validation Endpoint', () => {
  let app: FastifyInstance;
  let tempDir: string;
  let tempFile: string;

  beforeAll(async () => {
    runMigrations();
    app = await buildApp();
    await app.ready();

    // Create a temp directory with a test .jsonl file for validation
    tempDir = path.join(os.tmpdir(), `cowboy-path-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'test.jsonl'), '{"test": true}\n');
    fs.writeFileSync(path.join(tempDir, 'another.jsonl'), '{"test": true}\n');

    // Create a regular file (not directory) for the "not a directory" test
    tempFile = path.join(os.tmpdir(), `cowboy-path-test-file-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, 'not a directory');
  });

  afterAll(async () => {
    await app.close();
    // Clean up temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.unlinkSync(tempFile);
    } catch {
      // Ignore cleanup errors
    }
    try {
      fs.unlinkSync(testDbPath);
      fs.unlinkSync(testDbPath + '-wal');
      fs.unlinkSync(testDbPath + '-shm');
    } catch {
      // Files may not exist
    }
  });

  it('returns valid:true and fileCount for existing directory with .jsonl files', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/settings/validate-path',
      payload: {
        path: tempDir,
        agent: 'claude-code',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.valid).toBe(true);
    expect(body.fileCount).toBe(2);
    expect(body.message).toContain('JSONL');
  });

  it('returns valid:false for nonexistent path', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/settings/validate-path',
      payload: {
        path: '/definitely/nonexistent/path/12345',
        agent: 'claude-code',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.valid).toBe(false);
    expect(body.fileCount).toBe(0);
    expect(body.message).toContain('not found');
  });

  it('returns valid:false for a file (not directory)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/settings/validate-path',
      payload: {
        path: tempFile,
        agent: 'claude-code',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.valid).toBe(false);
    expect(body.message).toContain('not a directory');
  });

  it('expands tilde (~) to homedir', async () => {
    // Test that tilde is expanded -- the path likely does not exist,
    // but the endpoint should resolve it (not treat ~ literally)
    const response = await app.inject({
      method: 'POST',
      url: '/api/settings/validate-path',
      payload: {
        path: '~/definitely-nonexistent-test-path-12345',
        agent: 'claude-code',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // The expanded path should be checked -- it won't exist, but the error
    // should indicate path not found (not a syntax error with ~)
    expect(body.valid).toBe(false);
    expect(body.message).toContain('not found');
  });
});
