import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Set up isolated test database
const testDbPath = path.join(os.tmpdir(), `cowboy-test-detail-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

const { buildApp } = await import('../../src/app.js');
const { runMigrations } = await import('../../src/db/migrate.js');
const { db } = await import('../../src/db/index.js');
const { seedAnalyticsData } = await import('../fixtures/seed-analytics.js');

describe('Conversation Detail API', () => {
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

  // Test 1: Detail returns conversation object with all fields
  it('GET /api/analytics/conversations/:id returns conversation object with id, agent, project, title, model, createdAt, updatedAt', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations/conv-1',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.conversation).toBeDefined();
    expect(body.conversation.id).toBe('conv-1');
    expect(body.conversation.agent).toBe('claude-code');
    expect(body.conversation.project).toBe('project-alpha');
    expect(body.conversation.title).toBe('Conv 1');
    expect(body.conversation.model).toBe('claude-sonnet-4-5');
    expect(body.conversation.createdAt).toBe('2026-01-15T10:00:00Z');
    expect(body.conversation.updatedAt).toBe('2026-01-15T10:30:00Z');
  });

  // Test 2: Detail returns messages sorted by createdAt
  it('GET /api/analytics/conversations/:id returns messages array sorted by createdAt', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations/conv-1',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.messages).toBeDefined();
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages.length).toBe(2);

    // Check message fields
    const firstMsg = body.messages[0];
    expect(firstMsg).toHaveProperty('id');
    expect(firstMsg).toHaveProperty('role');
    expect(firstMsg).toHaveProperty('content');
    expect(firstMsg).toHaveProperty('createdAt');

    // Messages should be sorted ascending by createdAt
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[1].role).toBe('assistant');
    expect(body.messages[0].createdAt <= body.messages[1].createdAt).toBe(true);
  });

  // Test 3: Detail returns toolCalls array
  it('GET /api/analytics/conversations/:id returns toolCalls array with name, input, output, status, messageId', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations/conv-1',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.toolCalls).toBeDefined();
    expect(Array.isArray(body.toolCalls)).toBe(true);
    expect(body.toolCalls.length).toBe(2);

    const tc = body.toolCalls[0];
    expect(tc.name).toBe('Read');
    expect(tc.input).toEqual({ path: 'file.ts' });
    expect(tc.output).toEqual({ content: 'code' });
    expect(tc.status).toBe('completed');
    expect(tc.messageId).toBe('msg-1b');

    const tc2 = body.toolCalls[1];
    expect(tc2.name).toBe('Write');
    expect(tc2.status).toBe('completed');
    expect(tc2.messageId).toBe('msg-1b');
  });

  // Test 4: Detail returns tokenSummary with all fields
  it('GET /api/analytics/conversations/:id returns tokenSummary with inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, cost, savings', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations/conv-1',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tokenSummary).toBeDefined();
    expect(body.tokenSummary.inputTokens).toBe(100000);
    expect(body.tokenSummary.outputTokens).toBe(50000);
    expect(body.tokenSummary.cacheReadTokens).toBe(20000);
    expect(body.tokenSummary.cacheCreationTokens).toBe(10000);
    expect(body.tokenSummary.cost).not.toBeNull();
    expect(body.tokenSummary.cost).toBeGreaterThan(0);
    expect(body.tokenSummary.savings).not.toBeNull();
    expect(body.tokenSummary.savings).toBeGreaterThanOrEqual(0);
  });

  // Test 5: Non-existent conversation returns 404
  it('GET /api/analytics/conversations/nonexistent returns 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations/nonexistent',
    });

    expect(response.statusCode).toBe(404);
  });

  // Test 9: Detail response includes agent field (CONV-04)
  it('detail response conversation object includes agent field', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations/conv-1',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.conversation.agent).toBe('claude-code');
  });
});

describe('Conversation List Filters and Search', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Reuse the same DB as already seeded above (module-level env var)
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Test 6: Filter by agent
  it('GET /api/analytics/conversations?agent=claude-code returns only claude-code conversations', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations?from=2026-01-15&to=2026-01-17&agent=claude-code',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.rows.length).toBeGreaterThan(0);
    for (const row of body.rows) {
      expect(row.agent).toBe('claude-code');
    }
  });

  // Test 7: Filter by project
  it('GET /api/analytics/conversations?project=project-alpha returns only project-alpha conversations', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations?from=2026-01-15&to=2026-01-17&project=project-alpha',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.rows.length).toBeGreaterThan(0);
    for (const row of body.rows) {
      expect(row.project).toBe('project-alpha');
    }
  });

  // Test 8: Search by content returns matching conversations with snippet
  it('GET /api/analytics/conversations?search=function returns conversations with snippet field', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/analytics/conversations?from=2026-01-15&to=2026-01-17&search=function',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.rows.length).toBeGreaterThan(0);
    // Search results should have snippet field
    for (const row of body.rows) {
      expect(row).toHaveProperty('snippet');
    }
    // conv-1 has "function buildApp" in message content
    const conv1 = body.rows.find((r: { id: string }) => r.id === 'conv-1');
    expect(conv1).toBeDefined();
    expect(conv1.snippet).toBeTruthy();
    expect(conv1.snippet).toContain('function');
  });
});
