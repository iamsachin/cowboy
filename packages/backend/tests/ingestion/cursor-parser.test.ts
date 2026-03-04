import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { unlinkSync } from 'node:fs';
import { parseCursorDb, getBubblesForConversation } from '../../src/ingestion/cursor-parser.js';

describe('Cursor Parser', () => {
  const dbPath = join(tmpdir(), `cursor-test-parser-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  let setupDb: InstanceType<typeof Database>;

  beforeAll(() => {
    setupDb = new Database(dbPath);
    setupDb.exec(`
      CREATE TABLE IF NOT EXISTS cursorDiskKV (
        key TEXT PRIMARY KEY,
        value BLOB
      )
    `);
  });

  afterAll(() => {
    setupDb.close();
    try { unlinkSync(dbPath); } catch { /* may not exist */ }
  });

  beforeEach(() => {
    setupDb.exec('DELETE FROM cursorDiskKV');
  });

  describe('parseCursorDb', () => {
    it('parses valid composerData entries into CursorConversation[]', () => {
      const conversationData = {
        name: 'Test Conversation',
        createdAt: 1700000000000,
        lastUpdatedAt: 1700000100000,
        status: 'completed',
        isAgentic: true,
        usageData: { 'claude-4.5-sonnet': { costInCents: 50, amount: 5 } },
        modelConfig: { modelName: 'claude-4.5-sonnet' },
        fullConversationHeadersOnly: [
          { bubbleId: 'bubble-1', type: 1 },
          { bubbleId: 'bubble-2', type: 2 },
        ],
      };

      setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        'composerData:conv-abc-123',
        Buffer.from(JSON.stringify(conversationData))
      );

      const conversations = parseCursorDb(dbPath);
      expect(conversations).toHaveLength(1);
      expect(conversations[0].composerId).toBe('conv-abc-123');
      expect(conversations[0].name).toBe('Test Conversation');
      expect(conversations[0].createdAt).toBe(1700000000000);
      expect(conversations[0].lastUpdatedAt).toBe(1700000100000);
      expect(conversations[0].status).toBe('completed');
      expect(conversations[0].isAgentic).toBe(true);
      expect(conversations[0].usageData).toEqual({ 'claude-4.5-sonnet': { costInCents: 50, amount: 5 } });
      expect(conversations[0].modelConfig).toEqual({ modelName: 'claude-4.5-sonnet' });
      expect(conversations[0].fullConversationHeadersOnly).toHaveLength(2);
    });

    it('skips rows with invalid JSON', () => {
      setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        'composerData:valid-conv',
        Buffer.from(JSON.stringify({ name: 'Valid', createdAt: 1700000000000, extraPadding: 'x'.repeat(100) }))
      );
      setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        'composerData:invalid-conv',
        Buffer.from('this is not valid JSON at all but it needs to be long enough to pass the LENGTH filter so here is more text{{{')
      );

      const conversations = parseCursorDb(dbPath);
      expect(conversations).toHaveLength(1);
      expect(conversations[0].composerId).toBe('valid-conv');
    });

    it('handles BLOB values (CAST to TEXT)', () => {
      const data = { name: 'BLOB Test', createdAt: 1700000000000, extra: 'padding to make it long enough for the filter' };
      // Store as raw Buffer (simulating BLOB storage)
      setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        'composerData:blob-conv',
        Buffer.from(JSON.stringify(data))
      );

      const conversations = parseCursorDb(dbPath);
      expect(conversations).toHaveLength(1);
      expect(conversations[0].name).toBe('BLOB Test');
    });

    it('returns empty array for empty database', () => {
      const conversations = parseCursorDb(dbPath);
      expect(conversations).toEqual([]);
    });

    it('skips entries with short values (LENGTH < 100)', () => {
      // Short value should be filtered out by the SQL query
      setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        'composerData:short-conv',
        Buffer.from('{"a":1}')
      );

      const conversations = parseCursorDb(dbPath);
      expect(conversations).toEqual([]);
    });

    it('parses multiple conversations', () => {
      for (let i = 0; i < 3; i++) {
        const data = {
          name: `Conversation ${i}`,
          createdAt: 1700000000000 + i * 100000,
          extraPadding: 'x'.repeat(100), // ensure passes LENGTH filter
        };
        setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
          `composerData:conv-${i}`,
          Buffer.from(JSON.stringify(data))
        );
      }

      const conversations = parseCursorDb(dbPath);
      expect(conversations).toHaveLength(3);
    });

    it('handles missing optional fields gracefully', () => {
      const minimalData = { extraPadding: 'x'.repeat(100) };
      setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        'composerData:minimal-conv',
        Buffer.from(JSON.stringify(minimalData))
      );

      const conversations = parseCursorDb(dbPath);
      expect(conversations).toHaveLength(1);
      expect(conversations[0].name).toBeNull();
      expect(conversations[0].createdAt).toBe(0);
      expect(conversations[0].isAgentic).toBe(false);
      expect(conversations[0].usageData).toBeNull();
      expect(conversations[0].modelConfig).toBeNull();
      expect(conversations[0].fullConversationHeadersOnly).toEqual([]);
    });
  });

  describe('getBubblesForConversation', () => {
    it('returns bubbles for a specific conversation ordered by rowid', () => {
      const bubble1 = {
        type: 1,
        text: 'Hello, can you help me?',
        createdAt: '2026-01-15T10:00:00Z',
        tokenCount: null,
        modelInfo: null,
        timingInfo: null,
      };
      const bubble2 = {
        type: 2,
        text: 'Of course! How can I help?',
        createdAt: '2026-01-15T10:00:01Z',
        tokenCount: { inputTokens: 500, outputTokens: 200 },
        modelInfo: { modelName: 'claude-4.5-sonnet' },
        timingInfo: { clientStartTime: 1705312800000, clientEndTime: 1705312801000 },
      };

      setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        'bubbleId:conv-123:bubble-1',
        Buffer.from(JSON.stringify(bubble1))
      );
      setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        'bubbleId:conv-123:bubble-2',
        Buffer.from(JSON.stringify(bubble2))
      );

      const bubbles = getBubblesForConversation(dbPath, 'conv-123');
      expect(bubbles).toHaveLength(2);

      expect(bubbles[0].bubbleId).toBe('bubble-1');
      expect(bubbles[0].type).toBe(1);
      expect(bubbles[0].text).toBe('Hello, can you help me?');

      expect(bubbles[1].bubbleId).toBe('bubble-2');
      expect(bubbles[1].type).toBe(2);
      expect(bubbles[1].text).toBe('Of course! How can I help?');
      expect(bubbles[1].tokenCount).toEqual({ inputTokens: 500, outputTokens: 200 });
      expect(bubbles[1].modelInfo).toEqual({ modelName: 'claude-4.5-sonnet' });
    });

    it('returns empty array when no bubbles exist for conversation', () => {
      const bubbles = getBubblesForConversation(dbPath, 'nonexistent-conv');
      expect(bubbles).toEqual([]);
    });

    it('does not return bubbles from other conversations', () => {
      setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        'bubbleId:conv-A:bubble-1',
        Buffer.from(JSON.stringify({ type: 1, text: 'From A' }))
      );
      setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        'bubbleId:conv-B:bubble-1',
        Buffer.from(JSON.stringify({ type: 1, text: 'From B' }))
      );

      const bubblesA = getBubblesForConversation(dbPath, 'conv-A');
      expect(bubblesA).toHaveLength(1);
      expect(bubblesA[0].text).toBe('From A');
    });

    it('skips bubbles with invalid JSON', () => {
      setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        'bubbleId:conv-123:bubble-good',
        Buffer.from(JSON.stringify({ type: 1, text: 'Good bubble' }))
      );
      setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        'bubbleId:conv-123:bubble-bad',
        Buffer.from('not valid JSON{{{')
      );

      const bubbles = getBubblesForConversation(dbPath, 'conv-123');
      expect(bubbles).toHaveLength(1);
      expect(bubbles[0].text).toBe('Good bubble');
    });

    it('handles missing optional fields on bubbles', () => {
      setupDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        'bubbleId:conv-123:bubble-minimal',
        Buffer.from(JSON.stringify({}))
      );

      const bubbles = getBubblesForConversation(dbPath, 'conv-123');
      expect(bubbles).toHaveLength(1);
      expect(bubbles[0].type).toBe(0);
      expect(bubbles[0].text).toBe('');
      expect(bubbles[0].createdAt).toBeNull();
      expect(bubbles[0].tokenCount).toBeNull();
      expect(bubbles[0].modelInfo).toBeNull();
    });
  });
});
