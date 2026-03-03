import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sql } from 'drizzle-orm';
import { mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from '../../src/db/schema.js';
import { discoverJsonlFiles } from '../../src/ingestion/file-discovery.js';
import { parseJsonlFile } from '../../src/ingestion/claude-code-parser.js';
import { normalizeConversation } from '../../src/ingestion/normalizer.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');
const MIGRATIONS = path.resolve(import.meta.dirname, '../../drizzle');

/**
 * Run the full pipeline: discover -> parse -> normalize -> insert for all files in a directory.
 * Returns stats about what was inserted.
 */
async function runFullPipeline(
  testDb: BetterSQLite3Database<typeof schema>,
  baseDir: string,
): Promise<{ filesProcessed: number; skippedLines: number }> {
  const files = await discoverJsonlFiles(baseDir);
  let skippedLines = 0;

  for (const file of files) {
    const parseResult = await parseJsonlFile(file.filePath);
    skippedLines += parseResult.skippedLines;

    const normalizedData = normalizeConversation(parseResult, file.projectDir);
    if (normalizedData === null) continue;

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
  }

  return { filesProcessed: files.length, skippedLines };
}

describe('Full Ingestion Pipeline', () => {
  const testDbPath = path.join(
    tmpdir(),
    `cowboy-test-full-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
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

  // Clean tables between tests for isolation
  beforeEach(() => {
    sqlite.exec('DELETE FROM token_usage');
    sqlite.exec('DELETE FROM tool_calls');
    sqlite.exec('DELETE FROM messages');
    sqlite.exec('DELETE FROM conversations');
  });

  describe('sample conversation', () => {
    it('ingests sample conversation with correct record counts', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'cowboy-full-sample-'));
      const projectDir = join(tempDir, '-Users-test-Desktop-myproject');
      await mkdir(projectDir, { recursive: true });
      await copyFile(
        join(FIXTURES, 'sample-conversation.jsonl'),
        join(projectDir, 'session-abc-123.jsonl'),
      );

      await runFullPipeline(testDb, tempDir);

      const convCount = testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM conversations`)!.count;
      const msgCount = testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM messages`)!.count;
      const tcCount = testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM tool_calls`)!.count;
      const tuCount = testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM token_usage`)!.count;

      expect(convCount).toBe(1);
      expect(msgCount).toBe(2); // 1 user + 1 assistant
      expect(tcCount).toBe(0);
      expect(tuCount).toBe(1);

      // Verify conversation fields
      const conv = testDb.get<{ agent: string; project: string }>(
        sql`SELECT agent, project FROM conversations LIMIT 1`,
      )!;
      expect(conv.agent).toBe('claude-code');
      expect(conv.project).toBe('myproject');

      await rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('streaming assistant', () => {
    it('reconstructs streaming assistant correctly with correct token counts', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'cowboy-full-stream-'));
      const projectDir = join(tempDir, '-Users-test-Desktop-myproject');
      await mkdir(projectDir, { recursive: true });
      await copyFile(
        join(FIXTURES, 'streaming-assistant.jsonl'),
        join(projectDir, 'session-stream-001.jsonl'),
      );

      await runFullPipeline(testDb, tempDir);

      const convCount = testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM conversations`)!.count;
      const msgCount = testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM messages`)!.count;

      expect(convCount).toBe(1);
      expect(msgCount).toBe(2); // 1 user + 1 reconstructed assistant

      // Token usage should come from final chunk
      const tu = testDb.get<{ output_tokens: number }>(
        sql`SELECT output_tokens FROM token_usage LIMIT 1`,
      )!;
      expect(tu.output_tokens).toBe(45);

      await rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('tool use flow', () => {
    it('extracts tool calls with results', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'cowboy-full-tool-'));
      const projectDir = join(tempDir, '-Users-test-Desktop-myproject');
      await mkdir(projectDir, { recursive: true });
      await copyFile(
        join(FIXTURES, 'tool-use-flow.jsonl'),
        join(projectDir, 'session-tool-001.jsonl'),
      );

      await runFullPipeline(testDb, tempDir);

      const toolCalls = sqlite.prepare('SELECT * FROM tool_calls').all() as Array<{
        name: string;
        input: string;
        output: string;
        status: string;
      }>;

      expect(toolCalls.length).toBeGreaterThan(0);
      const readCall = toolCalls.find((tc) => tc.name === 'Read');
      expect(readCall).toBeDefined();

      // input and output are stored as JSON
      const input = JSON.parse(readCall!.input);
      expect(input.file_path).toBe('/tmp/test.txt');

      const output = JSON.parse(readCall!.output);
      expect(output).toBe('file contents here');

      expect(readCall!.status).toBe('success');

      await rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('malformed lines', () => {
    it('handles malformed lines gracefully', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'cowboy-full-malformed-'));
      const projectDir = join(tempDir, '-Users-test-Desktop-myproject');
      await mkdir(projectDir, { recursive: true });
      await copyFile(
        join(FIXTURES, 'malformed-lines.jsonl'),
        join(projectDir, 'session-malformed-001.jsonl'),
      );

      const { skippedLines } = await runFullPipeline(testDb, tempDir);

      // malformed-lines.jsonl has: valid user, invalid JSON, empty object, valid assistant, empty line
      // Skipped: invalid JSON line, empty object (type not user/assistant), empty line = 3 skipped
      expect(skippedLines).toBeGreaterThan(0);

      // Should still have valid records
      const msgCount = testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM messages`)!.count;
      expect(msgCount).toBe(2); // 1 user + 1 assistant from valid lines

      await rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('empty files', () => {
    it('handles empty files without errors', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'cowboy-full-empty-'));
      const projectDir = join(tempDir, '-Users-test-Desktop-myproject');
      await mkdir(projectDir, { recursive: true });
      await copyFile(
        join(FIXTURES, 'empty.jsonl'),
        join(projectDir, 'session-empty.jsonl'),
      );

      const { filesProcessed } = await runFullPipeline(testDb, tempDir);

      expect(filesProcessed).toBe(1); // File was discovered
      const convCount = testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM conversations`)!.count;
      expect(convCount).toBe(0); // But no records created

      await rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('foreign key integrity', () => {
    it('maintains foreign key integrity across all tables', async () => {
      // Ingest multiple fixture files together
      const tempDir = await mkdtemp(join(tmpdir(), 'cowboy-full-fk-'));
      const projectDir = join(tempDir, '-Users-test-Desktop-myproject');
      await mkdir(projectDir, { recursive: true });

      await copyFile(
        join(FIXTURES, 'sample-conversation.jsonl'),
        join(projectDir, 'session-abc-123.jsonl'),
      );
      await copyFile(
        join(FIXTURES, 'tool-use-flow.jsonl'),
        join(projectDir, 'session-tool-001.jsonl'),
      );
      await copyFile(
        join(FIXTURES, 'streaming-assistant.jsonl'),
        join(projectDir, 'session-stream-001.jsonl'),
      );

      await runFullPipeline(testDb, tempDir);

      // All messages must reference existing conversations
      const orphanMessages = sqlite
        .prepare(
          'SELECT COUNT(*) as count FROM messages WHERE conversation_id NOT IN (SELECT id FROM conversations)',
        )
        .get() as { count: number };
      expect(orphanMessages.count).toBe(0);

      // All tool_calls must reference existing messages
      const orphanToolCalls = sqlite
        .prepare(
          'SELECT COUNT(*) as count FROM tool_calls WHERE message_id NOT IN (SELECT id FROM messages)',
        )
        .get() as { count: number };
      expect(orphanToolCalls.count).toBe(0);

      // All token_usage must reference existing conversations
      const orphanTokenUsage = sqlite
        .prepare(
          'SELECT COUNT(*) as count FROM token_usage WHERE conversation_id NOT IN (SELECT id FROM conversations)',
        )
        .get() as { count: number };
      expect(orphanTokenUsage.count).toBe(0);

      // All token_usage must reference existing messages (where messageId is set)
      const orphanTokenUsageMsg = sqlite
        .prepare(
          'SELECT COUNT(*) as count FROM token_usage WHERE message_id IS NOT NULL AND message_id NOT IN (SELECT id FROM messages)',
        )
        .get() as { count: number };
      expect(orphanTokenUsageMsg.count).toBe(0);

      await rm(tempDir, { recursive: true, force: true });
    });
  });
});
