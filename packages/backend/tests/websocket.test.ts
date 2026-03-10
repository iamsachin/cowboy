import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { WebSocket } from 'ws';

// Set up isolated test database before importing app
const testDbPath = path.join(os.tmpdir(), `cowboy-test-ws-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = testDbPath;

// Dynamic import after env is set
const { buildApp } = await import('../src/app.js');
const { runMigrations } = await import('../src/db/migrate.js');
const { _resetSeqForTest } = await import('../src/plugins/websocket.js');

describe('WebSocket Plugin', () => {
  let app: FastifyInstance;
  let baseUrl: string;

  beforeAll(async () => {
    runMigrations();
    app = await buildApp({ ingestion: { autoIngest: false } });
    // Listen on a random port for real WebSocket connections
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    baseUrl = address.replace('http', 'ws');
  });

  beforeEach(() => {
    _resetSeqForTest();
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

  it('sends { type: "connected" } on WebSocket connection', async () => {
    const ws = new WebSocket(`${baseUrl}/api/ws`);

    const message = await new Promise<string>((resolve, reject) => {
      ws.on('message', (data) => {
        resolve(data.toString());
      });
      ws.on('error', reject);
    });

    const parsed = JSON.parse(message);
    expect(parsed).toEqual({ type: 'connected' });

    ws.close();
    // Wait for close to complete
    await new Promise((resolve) => ws.on('close', resolve));
  });

  it('broadcastEvent delivers typed conversation:changed event with seq', async () => {
    const ws = new WebSocket(`${baseUrl}/api/ws`);

    // Wait for connection and initial "connected" message
    await new Promise<void>((resolve, reject) => {
      ws.on('message', () => resolve());
      ws.on('error', reject);
    });

    // Set up listener for broadcast message
    const broadcastPromise = new Promise<string>((resolve) => {
      ws.on('message', (data) => {
        resolve(data.toString());
      });
    });

    // Broadcast a typed event
    app.broadcastEvent({
      type: 'conversation:changed',
      conversationId: 'test-conv-123',
      changes: ['messages-added', 'tokens-updated'],
      timestamp: '2026-03-04T10:00:00Z',
    });

    const received = JSON.parse(await broadcastPromise);
    expect(received.type).toBe('conversation:changed');
    expect(received.conversationId).toBe('test-conv-123');
    expect(received.changes).toEqual(['messages-added', 'tokens-updated']);
    expect(received.timestamp).toBe('2026-03-04T10:00:00Z');
    expect(received.seq).toBe(1);

    ws.close();
    await new Promise((resolve) => ws.on('close', resolve));
  });

  it('broadcastEvent delivers typed conversation:created event with summary', async () => {
    const ws = new WebSocket(`${baseUrl}/api/ws`);

    await new Promise<void>((resolve, reject) => {
      ws.on('message', () => resolve());
      ws.on('error', reject);
    });

    const broadcastPromise = new Promise<string>((resolve) => {
      ws.on('message', (data) => {
        resolve(data.toString());
      });
    });

    app.broadcastEvent({
      type: 'conversation:created',
      conversationId: 'new-conv-456',
      summary: {
        title: 'Test conversation',
        agent: 'claude-code',
        project: 'cowboy',
        createdAt: '2026-03-04T10:00:00Z',
      },
      timestamp: '2026-03-04T10:00:00Z',
    });

    const received = JSON.parse(await broadcastPromise);
    expect(received.type).toBe('conversation:created');
    expect(received.conversationId).toBe('new-conv-456');
    expect(received.summary).toEqual({
      title: 'Test conversation',
      agent: 'claude-code',
      project: 'cowboy',
      createdAt: '2026-03-04T10:00:00Z',
    });
    expect(received.seq).toBe(1);

    ws.close();
    await new Promise((resolve) => ws.on('close', resolve));
  });

  it('broadcastEvent delivers system:full-refresh event', async () => {
    const ws = new WebSocket(`${baseUrl}/api/ws`);

    await new Promise<void>((resolve, reject) => {
      ws.on('message', () => resolve());
      ws.on('error', reject);
    });

    const broadcastPromise = new Promise<string>((resolve) => {
      ws.on('message', (data) => {
        resolve(data.toString());
      });
    });

    app.broadcastEvent({
      type: 'system:full-refresh',
      timestamp: '2026-03-04T10:00:00Z',
    });

    const received = JSON.parse(await broadcastPromise);
    expect(received.type).toBe('system:full-refresh');
    expect(received.timestamp).toBe('2026-03-04T10:00:00Z');
    expect(received.seq).toBe(1);

    ws.close();
    await new Promise((resolve) => ws.on('close', resolve));
  });

  it('sequence numbers are monotonically increasing across events', async () => {
    const ws = new WebSocket(`${baseUrl}/api/ws`);

    await new Promise<void>((resolve, reject) => {
      ws.on('message', () => resolve());
      ws.on('error', reject);
    });

    const receivedMessages: string[] = [];
    const threeMessages = new Promise<void>((resolve) => {
      ws.on('message', (data) => {
        receivedMessages.push(data.toString());
        if (receivedMessages.length === 3) resolve();
      });
    });

    // Broadcast three different events
    app.broadcastEvent({ type: 'system:full-refresh', timestamp: '2026-03-04T10:00:00Z' });
    app.broadcastEvent({
      type: 'conversation:changed',
      conversationId: 'c1',
      changes: ['messages-added'],
      timestamp: '2026-03-04T10:00:01Z',
    });
    app.broadcastEvent({
      type: 'conversation:created',
      conversationId: 'c2',
      summary: { title: null, agent: 'cursor', project: null, createdAt: '2026-03-04T10:00:02Z' },
      timestamp: '2026-03-04T10:00:02Z',
    });

    await threeMessages;

    const seqs = receivedMessages.map(m => JSON.parse(m).seq);
    expect(seqs).toEqual([1, 2, 3]);

    ws.close();
    await new Promise((resolve) => ws.on('close', resolve));
  });

  it('broadcastEvent handles closed clients without error', async () => {
    const ws1 = new WebSocket(`${baseUrl}/api/ws`);
    const ws2 = new WebSocket(`${baseUrl}/api/ws`);

    // Wait for both to connect and receive initial messages
    await Promise.all([
      new Promise<void>((resolve, reject) => { ws1.on('message', () => resolve()); ws1.on('error', reject); }),
      new Promise<void>((resolve, reject) => { ws2.on('message', () => resolve()); ws2.on('error', reject); }),
    ]);

    // Close one client and wait for it
    ws1.close();
    await new Promise((resolve) => ws1.on('close', resolve));

    // Wait a moment for the server to process the close
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Set up listener on the still-open client
    const broadcastPromise = new Promise<string>((resolve) => {
      ws2.on('message', (data) => {
        resolve(data.toString());
      });
    });

    // Broadcast should not throw even with a closed client
    expect(() => {
      app.broadcastEvent({ type: 'system:full-refresh', timestamp: '2026-03-04T10:00:00Z' });
    }).not.toThrow();

    const received = JSON.parse(await broadcastPromise);
    expect(received.type).toBe('system:full-refresh');
    expect(received.seq).toBeGreaterThan(0);

    ws2.close();
    await new Promise((resolve) => ws2.on('close', resolve));
  });
});
