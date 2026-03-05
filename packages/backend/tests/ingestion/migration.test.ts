import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import * as schema from '../../src/db/schema.js';
import {
  needsTitleFix,
  fixConversationTitles,
  fixConversationModels,
  fixCursorProjects,
  fixCursorMessageContent,
  runDataQualityMigration,
} from '../../src/ingestion/migration.js';
import { generateId } from '../../src/ingestion/id-generator.js';

const MIGRATIONS = path.resolve(import.meta.dirname, '../../drizzle');

describe('migration', () => {
  const testDbPath = path.join(
    tmpdir(),
    `cowboy-test-migration-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
  let sqlite: InstanceType<typeof Database>;
  let testDb: BetterSQLite3Database<typeof schema>;

  beforeAll(() => {
    sqlite = new Database(testDbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    testDb = drizzle({ client: sqlite, schema });
    migrate(testDb, { migrationsFolder: MIGRATIONS });
  });

  afterAll(() => {
    sqlite.close();
    try {
      fs.unlinkSync(testDbPath);
      fs.unlinkSync(testDbPath + '-wal');
      fs.unlinkSync(testDbPath + '-shm');
    } catch {
      // Files may not exist
    }
  });

  // Clear tables before each test
  beforeEach(() => {
    testDb.delete(schema.tokenUsage).run();
    testDb.delete(schema.toolCalls).run();
    testDb.delete(schema.planSteps).run();
    testDb.delete(schema.plans).run();
    testDb.delete(schema.messages).run();
    testDb.delete(schema.conversations).run();
  });

  // ── needsTitleFix ────────────────────────────────────────────────────

  describe('needsTitleFix', () => {
    it('returns true for null title', () => {
      expect(needsTitleFix(null)).toBe(true);
    });

    it('returns true for empty title', () => {
      expect(needsTitleFix('')).toBe(true);
      expect(needsTitleFix('   ')).toBe(true);
    });

    it('returns true for "Caveat:" titles', () => {
      expect(needsTitleFix('Caveat: The messages below were sent during a previous conversation.')).toBe(true);
    });

    it('returns true for "[Request interrupted" titles', () => {
      expect(needsTitleFix('[Request interrupted by user for tool use]')).toBe(true);
    });

    it('returns true for slash command titles', () => {
      expect(needsTitleFix('/clear')).toBe(true);
      expect(needsTitleFix('/gsd:plan-phase')).toBe(true);
    });

    it('returns true for XML titles', () => {
      expect(needsTitleFix('<system-reminder>Today is March 5</system-reminder>')).toBe(true);
    });

    it('returns false for normal titles', () => {
      expect(needsTitleFix('How do I fix this bug?')).toBe(false);
      expect(needsTitleFix('Configure ESLint')).toBe(false);
    });
  });

  // ── fixConversationTitles ────────────────────────────────────────────

  describe('fixConversationTitles', () => {
    it('fixes conversation with "Caveat:" title using first real user message', () => {
      testDb.insert(schema.conversations).values({
        id: 'conv-caveat',
        agent: 'claude-code',
        title: 'Caveat: The messages below were sent during a previous conversation.',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-1',
        conversationId: 'conv-caveat',
        role: 'user',
        content: 'Fix the login bug',
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      const count = fixConversationTitles(testDb);
      expect(count).toBe(1);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-caveat')).get();
      expect(conv!.title).toBe('Fix the login bug');
    });

    it('fixes conversation with "[Request interrupted" title', () => {
      testDb.insert(schema.conversations).values({
        id: 'conv-interrupted',
        agent: 'claude-code',
        title: '[Request interrupted by user for tool use]',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-2',
        conversationId: 'conv-interrupted',
        role: 'user',
        content: 'How do I deploy?',
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      const count = fixConversationTitles(testDb);
      expect(count).toBe(1);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-interrupted')).get();
      expect(conv!.title).toBe('How do I deploy?');
    });

    it('fixes conversation with "/clear" title', () => {
      testDb.insert(schema.conversations).values({
        id: 'conv-slash',
        agent: 'claude-code',
        title: '/clear',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-3',
        conversationId: 'conv-slash',
        role: 'user',
        content: 'Add unit tests for auth module',
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      const count = fixConversationTitles(testDb);
      expect(count).toBe(1);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-slash')).get();
      expect(conv!.title).toBe('Add unit tests for auth module');
    });

    it('fixes conversation with NULL title from its messages', () => {
      testDb.insert(schema.conversations).values({
        id: 'conv-null',
        agent: 'claude-code',
        title: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-4',
        conversationId: 'conv-null',
        role: 'user',
        content: 'What is TypeScript?',
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      const count = fixConversationTitles(testDb);
      expect(count).toBe(1);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-null')).get();
      expect(conv!.title).toBe('What is TypeScript?');
    });

    it('does NOT modify conversation with already correct title', () => {
      testDb.insert(schema.conversations).values({
        id: 'conv-good',
        agent: 'claude-code',
        title: 'How do I fix this bug?',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();

      const count = fixConversationTitles(testDb);
      expect(count).toBe(0);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-good')).get();
      expect(conv!.title).toBe('How do I fix this bug?');
    });

    it('skips system messages when finding title and uses first valid user message', () => {
      testDb.insert(schema.conversations).values({
        id: 'conv-skip-sys',
        agent: 'claude-code',
        title: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values([
        {
          id: 'msg-5a',
          conversationId: 'conv-skip-sys',
          role: 'user',
          content: 'Caveat: The messages below were sent during a previous conversation.',
          createdAt: '2026-01-01T00:00:01Z',
        },
        {
          id: 'msg-5b',
          conversationId: 'conv-skip-sys',
          role: 'user',
          content: '/clear',
          createdAt: '2026-01-01T00:00:02Z',
        },
        {
          id: 'msg-5c',
          conversationId: 'conv-skip-sys',
          role: 'user',
          content: 'The real question here',
          createdAt: '2026-01-01T00:00:03Z',
        },
      ]).run();

      const count = fixConversationTitles(testDb);
      expect(count).toBe(1);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-skip-sys')).get();
      expect(conv!.title).toBe('The real question here');
    });

    it('falls back to assistant message text when all user messages are skippable', () => {
      testDb.insert(schema.conversations).values({
        id: 'conv-assistant-fallback',
        agent: 'claude-code',
        title: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values([
        {
          id: 'msg-6a',
          conversationId: 'conv-assistant-fallback',
          role: 'user',
          content: '/clear',
          createdAt: '2026-01-01T00:00:01Z',
        },
        {
          id: 'msg-6b',
          conversationId: 'conv-assistant-fallback',
          role: 'assistant',
          content: 'I can help you with that task',
          createdAt: '2026-01-01T00:00:02Z',
        },
      ]).run();

      const count = fixConversationTitles(testDb);
      expect(count).toBe(1);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-assistant-fallback')).get();
      expect(conv!.title).toBe('I can help you with that task');
    });
  });

  // ── fixConversationModels ────────────────────────────────────────────

  describe('fixConversationModels', () => {
    it('fixes claude-code conversation with NULL model using most common token_usage model', () => {
      testDb.insert(schema.conversations).values({
        id: 'conv-cc-null',
        agent: 'claude-code',
        model: null,
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-cc-1',
        conversationId: 'conv-cc-null',
        role: 'assistant',
        content: 'response',
        createdAt: '2026-01-01T00:00:01Z',
        model: 'claude-sonnet-4-20250514',
      }).run();
      testDb.insert(schema.tokenUsage).values([
        {
          id: 'tu-1',
          conversationId: 'conv-cc-null',
          messageId: 'msg-cc-1',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 100,
          outputTokens: 50,
          createdAt: '2026-01-01T00:00:01Z',
        },
        {
          id: 'tu-2',
          conversationId: 'conv-cc-null',
          messageId: 'msg-cc-1',
          model: 'claude-sonnet-4-20250514',
          inputTokens: 200,
          outputTokens: 100,
          createdAt: '2026-01-01T00:00:02Z',
        },
        {
          id: 'tu-3',
          conversationId: 'conv-cc-null',
          messageId: 'msg-cc-1',
          model: 'claude-haiku-3.5',
          inputTokens: 50,
          outputTokens: 25,
          createdAt: '2026-01-01T00:00:03Z',
        },
      ]).run();

      const count = fixConversationModels(testDb);
      expect(count).toBe(1);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-cc-null')).get();
      expect(conv!.model).toBe('claude-sonnet-4-20250514');
    });

    it('fixes cursor conversation with "default" model using actual model from messages', () => {
      testDb.insert(schema.conversations).values({
        id: 'conv-cursor-default',
        agent: 'cursor',
        model: 'default',
        title: 'Test Cursor',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values([
        {
          id: 'msg-cur-1',
          conversationId: 'conv-cursor-default',
          role: 'assistant',
          content: 'response 1',
          model: 'gpt-4o',
          createdAt: '2026-01-01T00:00:01Z',
        },
        {
          id: 'msg-cur-2',
          conversationId: 'conv-cursor-default',
          role: 'assistant',
          content: 'response 2',
          model: 'gpt-4o',
          createdAt: '2026-01-01T00:00:02Z',
        },
        {
          id: 'msg-cur-3',
          conversationId: 'conv-cursor-default',
          role: 'assistant',
          content: 'response 3',
          model: 'default',
          createdAt: '2026-01-01T00:00:03Z',
        },
      ]).run();

      const count = fixConversationModels(testDb);
      expect(count).toBe(1);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-cursor-default')).get();
      expect(conv!.model).toBe('gpt-4o');
    });

    it('sets cursor conversation model to "unknown" when no real model found in messages', () => {
      testDb.insert(schema.conversations).values({
        id: 'conv-cursor-nomodel',
        agent: 'cursor',
        model: 'default',
        title: 'Test Cursor Unknown',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-cur-nope',
        conversationId: 'conv-cursor-nomodel',
        role: 'assistant',
        content: 'response',
        model: 'default',
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      const count = fixConversationModels(testDb);
      expect(count).toBe(1);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-cursor-nomodel')).get();
      expect(conv!.model).toBe('unknown');
    });

    it('does NOT modify conversation with existing valid model', () => {
      testDb.insert(schema.conversations).values({
        id: 'conv-good-model',
        agent: 'claude-code',
        model: 'claude-sonnet-4-6',
        title: 'Good Model',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();

      const count = fixConversationModels(testDb);
      expect(count).toBe(0);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-good-model')).get();
      expect(conv!.model).toBe('claude-sonnet-4-6');
    });

    it('updates cursor per-message "default" model to "unknown"', () => {
      testDb.insert(schema.conversations).values({
        id: 'conv-cursor-msgfix',
        agent: 'cursor',
        model: 'default',
        title: 'Test Cursor Msg Fix',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-cur-def',
        conversationId: 'conv-cursor-msgfix',
        role: 'assistant',
        content: 'response',
        model: 'default',
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      fixConversationModels(testDb);

      const msg = testDb.select().from(schema.messages).where(eq(schema.messages.id, 'msg-cur-def')).get();
      expect(msg!.model).toBe('unknown');
    });
  });

  // ── fixCursorProjects ──────────────────────────────────────────────

  describe('fixCursorProjects', () => {
    it('updates conversations with project="Cursor" to workspace-derived name', () => {
      const composerId = 'abc-123';
      const convId = generateId('cursor', composerId);

      testDb.insert(schema.conversations).values({
        id: convId,
        agent: 'cursor',
        project: 'Cursor',
        title: 'Test Cursor Project',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();

      // Create a mock Cursor DB with workspace path
      const mockCursorDbPath = path.join(
        tmpdir(),
        `mock-cursor-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
      );
      const mockDb = new Database(mockCursorDbPath);
      mockDb.exec('CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value TEXT)');
      mockDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        `composerData:${composerId}`,
        JSON.stringify({
          composerId,
          createdAt: Date.now(),
          lastUpdatedAt: Date.now(),
          workspacePath: '/Users/sachin/Desktop/myapp',
        }),
      );
      mockDb.close();

      try {
        const count = fixCursorProjects(testDb, mockCursorDbPath);
        expect(count).toBe(1);

        const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, convId)).get();
        expect(conv!.project).toBe('myapp');
      } finally {
        try { fs.unlinkSync(mockCursorDbPath); } catch { /* ignore */ }
      }
    });

    it('leaves conversations with project != "Cursor" unchanged', () => {
      const convId = generateId('cursor', 'def-456');

      testDb.insert(schema.conversations).values({
        id: convId,
        agent: 'cursor',
        project: 'my-project',
        title: 'Already Named',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();

      const count = fixCursorProjects(testDb);
      expect(count).toBe(0);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, convId)).get();
      expect(conv!.project).toBe('my-project');
    });

    it('falls back to Cursor when no Cursor DB provided', () => {
      const convId = generateId('cursor', 'ghi-789');

      testDb.insert(schema.conversations).values({
        id: convId,
        agent: 'cursor',
        project: 'Cursor',
        title: 'No DB Available',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();

      const count = fixCursorProjects(testDb);
      expect(count).toBe(0);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, convId)).get();
      expect(conv!.project).toBe('Cursor');
    });

    it('falls back to Cursor when workspace path not available for a conversation', () => {
      const composerId = 'no-workspace-123';
      const convId = generateId('cursor', composerId);

      testDb.insert(schema.conversations).values({
        id: convId,
        agent: 'cursor',
        project: 'Cursor',
        title: 'No Workspace',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();

      // Cursor DB with no workspace path for this conversation
      const mockCursorDbPath = path.join(
        tmpdir(),
        `mock-cursor-nowp-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
      );
      const mockDb = new Database(mockCursorDbPath);
      mockDb.exec('CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value TEXT)');
      mockDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        `composerData:${composerId}`,
        JSON.stringify({
          composerId,
          createdAt: Date.now(),
          lastUpdatedAt: Date.now(),
          name: 'Test conversation with enough padding to exceed the 100 character length filter requirement',
          // No workspacePath field
        }),
      );
      mockDb.close();

      try {
        const count = fixCursorProjects(testDb, mockCursorDbPath);
        expect(count).toBe(0);

        const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, convId)).get();
        expect(conv!.project).toBe('Cursor');
      } finally {
        try { fs.unlinkSync(mockCursorDbPath); } catch { /* ignore */ }
      }
    });
  });

  // ── fixCursorMessageContent ───────────────────────────────────────────

  describe('fixCursorMessageContent', () => {
    it('updates assistant messages with null content to "Executed tool call" when no Cursor DB', () => {
      const convId = generateId('cursor', 'msg-test-1');

      testDb.insert(schema.conversations).values({
        id: convId,
        agent: 'cursor',
        project: 'Cursor',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-null-content',
        conversationId: convId,
        role: 'assistant',
        content: null,
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      const count = fixCursorMessageContent(testDb);
      expect(count).toBe(1);

      const msg = testDb.select().from(schema.messages).where(eq(schema.messages.id, 'msg-null-content')).get();
      expect(msg!.content).toBe('Executed tool call');
    });

    it('updates assistant messages with empty string content', () => {
      const convId = generateId('cursor', 'msg-test-2');

      testDb.insert(schema.conversations).values({
        id: convId,
        agent: 'cursor',
        project: 'Cursor',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-empty-content',
        conversationId: convId,
        role: 'assistant',
        content: '',
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      const count = fixCursorMessageContent(testDb);
      expect(count).toBe(1);

      const msg = testDb.select().from(schema.messages).where(eq(schema.messages.id, 'msg-empty-content')).get();
      expect(msg!.content).toBe('Executed tool call');
    });

    it('does not update messages with existing content', () => {
      const convId = generateId('cursor', 'msg-test-3');

      testDb.insert(schema.conversations).values({
        id: convId,
        agent: 'cursor',
        project: 'Cursor',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-has-content',
        conversationId: convId,
        role: 'assistant',
        content: 'I can help with that',
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      const count = fixCursorMessageContent(testDb);
      expect(count).toBe(0);

      const msg = testDb.select().from(schema.messages).where(eq(schema.messages.id, 'msg-has-content')).get();
      expect(msg!.content).toBe('I can help with that');
    });

    it('does not update user messages with null content (only assistant)', () => {
      const convId = generateId('cursor', 'msg-test-4');

      testDb.insert(schema.conversations).values({
        id: convId,
        agent: 'cursor',
        project: 'Cursor',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-user-null',
        conversationId: convId,
        role: 'user',
        content: null,
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      const count = fixCursorMessageContent(testDb);
      expect(count).toBe(0);

      const msg = testDb.select().from(schema.messages).where(eq(schema.messages.id, 'msg-user-null')).get();
      expect(msg!.content).toBeNull();
    });

    it('re-derives content from Cursor DB when available', () => {
      const composerId = 'content-reread-1';
      const convId = generateId('cursor', composerId);
      const bubbleId = 'bubble-42';
      const messageId = generateId(convId, bubbleId);

      testDb.insert(schema.conversations).values({
        id: convId,
        agent: 'cursor',
        project: 'Cursor',
        title: 'Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: messageId,
        conversationId: convId,
        role: 'assistant',
        content: null,
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      // Create mock Cursor DB with bubble data containing text
      const mockCursorDbPath = path.join(
        tmpdir(),
        `mock-cursor-content-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
      );
      const mockDb = new Database(mockCursorDbPath);
      mockDb.exec('CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value TEXT)');
      mockDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        `composerData:${composerId}`,
        JSON.stringify({
          composerId,
          createdAt: Date.now(),
          lastUpdatedAt: Date.now(),
          name: 'Test conversation with enough data to exceed the 100 character length filter in parseCursorDb',
        }),
      );
      mockDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        `bubbleId:${composerId}:${bubbleId}`,
        JSON.stringify({
          type: 2,
          text: 'Here is the actual response from the AI',
          createdAt: '2026-01-01T00:00:01Z',
        }),
      );
      mockDb.close();

      try {
        const count = fixCursorMessageContent(testDb, mockCursorDbPath);
        expect(count).toBe(1);

        const msg = testDb.select().from(schema.messages).where(eq(schema.messages.id, messageId)).get();
        expect(msg!.content).toBe('Here is the actual response from the AI');
      } finally {
        try { fs.unlinkSync(mockCursorDbPath); } catch { /* ignore */ }
      }
    });
  });

  // ── Migration idempotency (Cursor) ───────────────────────────────────

  describe('Cursor migration idempotency', () => {
    it('fixCursorProjects is idempotent -- running twice produces same result', () => {
      const composerId = 'idemp-proj-1';
      const convId = generateId('cursor', composerId);

      testDb.insert(schema.conversations).values({
        id: convId,
        agent: 'cursor',
        project: 'Cursor',
        title: 'Idempotent Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();

      const mockCursorDbPath = path.join(
        tmpdir(),
        `mock-cursor-idemp-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
      );
      const mockDb = new Database(mockCursorDbPath);
      mockDb.exec('CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value TEXT)');
      mockDb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
        `composerData:${composerId}`,
        JSON.stringify({
          composerId,
          createdAt: Date.now(),
          lastUpdatedAt: Date.now(),
          workspacePath: '/Users/sachin/Desktop/myapp',
        }),
      );
      mockDb.close();

      try {
        // First run
        const count1 = fixCursorProjects(testDb, mockCursorDbPath);
        expect(count1).toBe(1);

        // Second run -- project is now 'myapp', not 'Cursor', so no match
        const count2 = fixCursorProjects(testDb, mockCursorDbPath);
        expect(count2).toBe(0);

        const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, convId)).get();
        expect(conv!.project).toBe('myapp');
      } finally {
        try { fs.unlinkSync(mockCursorDbPath); } catch { /* ignore */ }
      }
    });

    it('fixCursorMessageContent is idempotent -- running twice produces same result', () => {
      const convId = generateId('cursor', 'idemp-msg-1');

      testDb.insert(schema.conversations).values({
        id: convId,
        agent: 'cursor',
        project: 'Cursor',
        title: 'Idempotent Msg Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-idemp-null',
        conversationId: convId,
        role: 'assistant',
        content: null,
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      // First run
      const count1 = fixCursorMessageContent(testDb);
      expect(count1).toBe(1);

      // Second run -- content is now set, no match
      const count2 = fixCursorMessageContent(testDb);
      expect(count2).toBe(0);
    });
  });

  // ── runDataQualityMigration ──────────────────────────────────────────

  describe('runDataQualityMigration', () => {
    it('runs both title and model fixes and returns counts', () => {
      // Bad title
      testDb.insert(schema.conversations).values({
        id: 'conv-both-1',
        agent: 'claude-code',
        title: '/clear',
        model: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-both-1',
        conversationId: 'conv-both-1',
        role: 'user',
        content: 'Fix the build',
        createdAt: '2026-01-01T00:00:01Z',
      }).run();
      testDb.insert(schema.tokenUsage).values({
        id: 'tu-both-1',
        conversationId: 'conv-both-1',
        messageId: 'msg-both-1',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 50,
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      const result = runDataQualityMigration(testDb);

      expect(result.titlesFixed).toBe(1);
      expect(result.modelsFixed).toBe(1);

      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-both-1')).get();
      expect(conv!.title).toBe('Fix the build');
      expect(conv!.model).toBe('claude-sonnet-4-20250514');
    });

    it('returns cursorProjectsFixed and cursorMessagesFixed counts', () => {
      const convId = generateId('cursor', 'runner-test-1');

      testDb.insert(schema.conversations).values({
        id: convId,
        agent: 'cursor',
        project: 'Cursor',
        title: 'Runner Test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-runner-null',
        conversationId: convId,
        role: 'assistant',
        content: null,
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      const result = runDataQualityMigration(testDb);

      expect(result).toHaveProperty('cursorProjectsFixed');
      expect(result).toHaveProperty('cursorMessagesFixed');
      expect(result.cursorMessagesFixed).toBe(1);
    });

    it('is idempotent -- running twice produces same result', () => {
      testDb.insert(schema.conversations).values({
        id: 'conv-idemp',
        agent: 'claude-code',
        title: 'Caveat: Old conversation',
        model: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      }).run();
      testDb.insert(schema.messages).values({
        id: 'msg-idemp',
        conversationId: 'conv-idemp',
        role: 'user',
        content: 'Implement feature X',
        createdAt: '2026-01-01T00:00:01Z',
      }).run();
      testDb.insert(schema.tokenUsage).values({
        id: 'tu-idemp',
        conversationId: 'conv-idemp',
        messageId: 'msg-idemp',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 50,
        createdAt: '2026-01-01T00:00:01Z',
      }).run();

      // First run
      const result1 = runDataQualityMigration(testDb);
      expect(result1.titlesFixed).toBe(1);
      expect(result1.modelsFixed).toBe(1);

      // Second run -- should be no-op
      const result2 = runDataQualityMigration(testDb);
      expect(result2.titlesFixed).toBe(0);
      expect(result2.modelsFixed).toBe(0);

      // Data unchanged
      const conv = testDb.select().from(schema.conversations).where(eq(schema.conversations.id, 'conv-idemp')).get();
      expect(conv!.title).toBe('Implement feature X');
      expect(conv!.model).toBe('claude-sonnet-4-20250514');
    });
  });
});
