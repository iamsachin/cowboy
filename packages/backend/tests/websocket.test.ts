import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

  it('broadcast delivers message to connected client', async () => {
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

    // Broadcast a message
    app.broadcast({ type: 'data-changed', timestamp: '2026-03-04T10:00:00Z' });

    const received = JSON.parse(await broadcastPromise);
    expect(received).toEqual({ type: 'data-changed', timestamp: '2026-03-04T10:00:00Z' });

    ws.close();
    await new Promise((resolve) => ws.on('close', resolve));
  });

  it('broadcast handles closed clients without error', async () => {
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
      app.broadcast({ type: 'data-changed' });
    }).not.toThrow();

    const received = JSON.parse(await broadcastPromise);
    expect(received).toEqual({ type: 'data-changed' });

    ws2.close();
    await new Promise((resolve) => ws2.on('close', resolve));
  });
});
