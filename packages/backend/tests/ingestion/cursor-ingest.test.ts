import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sql } from 'drizzle-orm';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as schema from '../../src/db/schema.js';
import { parseCursorDb, getBubblesForConversation } from '../../src/ingestion/cursor-parser.js';
import { normalizeCursorConversation } from '../../src/ingestion/cursor-normalizer.js';

const MIGRATIONS = path.resolve(import.meta.dirname, '../../drizzle');

/**
 * Create a temporary vscdb file with cursorDiskKV table and mock data.
 */
function createMockVscdb(dbPath: string): void {
  const vscdb = new Database(dbPath);
  vscdb.exec(`
    CREATE TABLE IF NOT EXISTS cursorDiskKV (
      key TEXT PRIMARY KEY,
      value BLOB
    )
  `);

  // Insert two conversations
  const conv1Data = {
    name: 'Fix login bug',
    createdAt: 1706000000000, // 2024-01-23
    lastUpdatedAt: 1706000100000,
    status: 'completed',
    isAgentic: true,
    usageData: null,
    modelConfig: { modelName: 'claude-4.5-sonnet' },
    fullConversationHeadersOnly: [
      { bubbleId: 'b1', type: 1 },
      { bubbleId: 'b1-tool', type: 2 },
      { bubbleId: 'b2', type: 2 },
    ],
  };

  const conv2Data = {
    name: 'Refactor API',
    createdAt: 1706100000000,
    lastUpdatedAt: 1706100200000,
    status: 'completed',
    isAgentic: false,
    usageData: null,
    modelConfig: { modelName: 'gpt-4o' },
    fullConversationHeadersOnly: [
      { bubbleId: 'b3', type: 1 },
      { bubbleId: 'b4', type: 2 },
    ],
  };

  vscdb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
    'composerData:conv-001',
    Buffer.from(JSON.stringify(conv1Data))
  );
  vscdb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
    'composerData:conv-002',
    Buffer.from(JSON.stringify(conv2Data))
  );

  // Insert bubbles for conv-001
  vscdb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
    'bubbleId:conv-001:b1',
    Buffer.from(JSON.stringify({
      type: 1,
      text: 'Please fix the login bug where users get 401 errors',
      createdAt: '2024-01-23T10:00:00Z',
      tokenCount: null,
      modelInfo: null,
      timingInfo: null,
    }))
  );
  // Tool-call bubble with no text (should be filtered out during normalization)
  vscdb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
    'bubbleId:conv-001:b1-tool',
    Buffer.from(JSON.stringify({
      type: 2,
      text: '',
      isCapabilityIteration: true,
      capabilityType: 1,
      createdAt: '2024-01-23T10:00:02Z',
      tokenCount: { inputTokens: 0, outputTokens: 0 },
      tokenCountUpUntilHere: 300,
      modelInfo: { modelName: 'claude-4.5-sonnet' },
      timingInfo: null,
    }))
  );
  vscdb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
    'bubbleId:conv-001:b2',
    Buffer.from(JSON.stringify({
      type: 2,
      text: 'I found the issue in the auth middleware. Here is the fix...',
      createdAt: '2024-01-23T10:00:05Z',
      tokenCount: { inputTokens: 1500, outputTokens: 800 },
      modelInfo: { modelName: 'claude-4.5-sonnet' },
      timingInfo: { clientStartTime: 1706000005000 },
    }))
  );

  // Insert bubbles for conv-002
  vscdb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
    'bubbleId:conv-002:b3',
    Buffer.from(JSON.stringify({
      type: 1,
      text: 'Refactor the API routes to use controllers',
      createdAt: '2024-01-24T08:00:00Z',
      tokenCount: null,
      modelInfo: null,
      timingInfo: null,
    }))
  );
  vscdb.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(
    'bubbleId:conv-002:b4',
    Buffer.from(JSON.stringify({
      type: 2,
      text: 'Here is the refactored controller pattern...',
      createdAt: '2024-01-24T08:00:10Z',
      tokenCount: { inputTokens: 2000, outputTokens: 1200 },
      modelInfo: { modelName: 'gpt-4o' },
      timingInfo: { clientStartTime: 1706100010000 },
    }))
  );

  vscdb.close();
}

describe('Cursor Ingestion Integration', () => {
  const appDbPath = join(tmpdir(), `cowboy-test-cursor-ingest-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const vscdbPath = join(tmpdir(), `cursor-test-state-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  let sqlite: InstanceType<typeof Database>;
  let testDb: BetterSQLite3Database<typeof schema>;

  beforeAll(() => {
    sqlite = new Database(appDbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    testDb = drizzle({ client: sqlite, schema });
    migrate(testDb, { migrationsFolder: MIGRATIONS });

    createMockVscdb(vscdbPath);
  });

  afterAll(() => {
    sqlite.close();
    for (const p of [appDbPath, appDbPath + '-wal', appDbPath + '-shm', vscdbPath]) {
      try { unlinkSync(p); } catch { /* may not exist */ }
    }
  });

  beforeEach(() => {
    sqlite.exec('DELETE FROM token_usage');
    sqlite.exec('DELETE FROM tool_calls');
    sqlite.exec('DELETE FROM messages');
    sqlite.exec('DELETE FROM conversations');
  });

  /**
   * Run the Cursor ingestion pipeline manually (same logic as what the plugin does).
   */
  function runCursorIngestion(): { conversationsFound: number; messagesParsed: number; tokensRecorded: number } {
    const stats = { conversationsFound: 0, messagesParsed: 0, tokensRecorded: 0 };
    const cursorConversations = parseCursorDb(vscdbPath);

    for (const conv of cursorConversations) {
      const bubbles = getBubblesForConversation(vscdbPath, conv.composerId);
      const normalizedData = normalizeCursorConversation(conv, bubbles, 'Cursor');
      if (!normalizedData) continue;

      testDb.transaction((tx) => {
        tx.insert(schema.conversations)
          .values(normalizedData.conversation)
          .onConflictDoNothing({ target: schema.conversations.id })
          .run();

        if (normalizedData.messages.length > 0) {
          tx.insert(schema.messages)
            .values(normalizedData.messages)
            .onConflictDoNothing({ target: schema.messages.id })
            .run();
        }

        if (normalizedData.toolCalls.length > 0) {
          tx.insert(schema.toolCalls)
            .values(normalizedData.toolCalls)
            .onConflictDoNothing({ target: schema.toolCalls.id })
            .run();
        }

        if (normalizedData.tokenUsage.length > 0) {
          tx.insert(schema.tokenUsage)
            .values(normalizedData.tokenUsage)
            .onConflictDoNothing({ target: schema.tokenUsage.id })
            .run();
        }
      });

      stats.conversationsFound++;
      stats.messagesParsed += normalizedData.messages.length;
      stats.tokensRecorded += normalizedData.tokenUsage.length;
    }

    return stats;
  }

  it('ingests Cursor conversations from vscdb into the database', () => {
    const stats = runCursorIngestion();
    expect(stats.conversationsFound).toBe(2);
    expect(stats.messagesParsed).toBe(4); // 2 convs x 2 bubbles each

    const convCount = testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM conversations`)!.count;
    expect(convCount).toBe(2);

    const msgCount = testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM messages`)!.count;
    expect(msgCount).toBe(4);
  });

  it('sets agent to "cursor" for all ingested conversations', () => {
    runCursorIngestion();

    const agents = sqlite.prepare('SELECT DISTINCT agent FROM conversations').all() as Array<{ agent: string }>;
    expect(agents).toHaveLength(1);
    expect(agents[0].agent).toBe('cursor');
  });

  it('re-running ingestion produces zero duplicates (deterministic IDs)', () => {
    runCursorIngestion();
    const countBefore = testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM conversations`)!.count;

    runCursorIngestion();
    const countAfter = testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM conversations`)!.count;

    expect(countAfter).toBe(countBefore);
  });

  it('token usage is recorded for assistant bubbles with non-zero token counts', () => {
    runCursorIngestion();

    const tuCount = testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM token_usage`)!.count;
    // 2 from real tokenCount (b2 claude, b4 gpt-4o)
    // Tool-call bubble (b1-tool) is filtered from messages so its cumulative tokens are not recorded
    expect(tuCount).toBe(2);

    const tuRows = sqlite.prepare('SELECT model, input_tokens, output_tokens FROM token_usage ORDER BY model').all() as Array<{
      model: string;
      input_tokens: number;
      output_tokens: number;
    }>;

    // claude-4.5-sonnet conversation
    const claudeRow = tuRows.find(r => r.model === 'claude-4.5-sonnet');
    expect(claudeRow).toBeDefined();
    expect(claudeRow!.input_tokens).toBe(1500);
    expect(claudeRow!.output_tokens).toBe(800);

    // gpt-4o conversation
    const gptRow = tuRows.find(r => r.model === 'gpt-4o');
    expect(gptRow).toBeDefined();
    expect(gptRow!.input_tokens).toBe(2000);
    expect(gptRow!.output_tokens).toBe(1200);
  });

  it('parser extracts isCapabilityIteration, capabilityType, and tokenCountUpUntilHere fields', () => {
    const bubbles = getBubblesForConversation(vscdbPath, 'conv-001');
    // All bubbles should have the new fields with defaults when not present in raw data
    for (const bubble of bubbles) {
      expect(bubble).toHaveProperty('isCapabilityIteration');
      expect(bubble).toHaveProperty('capabilityType');
      expect(bubble).toHaveProperty('tokenCountUpUntilHere');
    }
    // Regular bubbles without these fields in raw data should default appropriately
    const userBubble = bubbles.find(b => b.type === 1)!;
    expect(userBubble.isCapabilityIteration).toBe(false);
    expect(userBubble.capabilityType).toBeNull();
    expect(userBubble.tokenCountUpUntilHere).toBeNull();
  });

  it('conversations have correct titles derived from first user bubble', () => {
    runCursorIngestion();

    const titles = sqlite.prepare('SELECT title FROM conversations ORDER BY created_at').all() as Array<{ title: string }>;
    expect(titles[0].title).toBe('Please fix the login bug where users get 401 errors');
    expect(titles[1].title).toBe('Refactor the API routes to use controllers');
  });

  it('filters out tool-call bubbles with no text content', () => {
    runCursorIngestion();

    // No message should have null/empty content from a tool-call bubble
    const emptyMessages = sqlite.prepare(
      "SELECT COUNT(*) as count FROM messages WHERE (content IS NULL OR content = '') AND role = 'assistant'"
    ).get() as { count: number };
    expect(emptyMessages.count).toBe(0);

    // Conv-001 should have 2 messages (user + assistant with text), not 3
    const conv1Messages = sqlite.prepare(
      "SELECT COUNT(*) as count FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.title LIKE '%login bug%'"
    ).get() as { count: number };
    expect(conv1Messages.count).toBe(2);
  });

  it('foreign key integrity is maintained', () => {
    runCursorIngestion();

    const orphanMessages = sqlite.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id NOT IN (SELECT id FROM conversations)'
    ).get() as { count: number };
    expect(orphanMessages.count).toBe(0);

    const orphanTokenUsage = sqlite.prepare(
      'SELECT COUNT(*) as count FROM token_usage WHERE conversation_id NOT IN (SELECT id FROM conversations)'
    ).get() as { count: number };
    expect(orphanTokenUsage.count).toBe(0);
  });
});
