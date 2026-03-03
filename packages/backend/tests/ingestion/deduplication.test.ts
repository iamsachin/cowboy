import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
import { parseJsonlFile } from '../../src/ingestion/claude-code-parser.js';
import { normalizeConversation } from '../../src/ingestion/normalizer.js';
import { generateId } from '../../src/ingestion/id-generator.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');
const MIGRATIONS = path.resolve(import.meta.dirname, '../../drizzle');

describe('Deduplication', () => {
  describe('database-level deduplication', () => {
    const testDbPath = path.join(
      tmpdir(),
      `cowboy-test-dedup-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
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

    it('same file ingested twice produces zero new rows on second run', async () => {
      const parseResult = await parseJsonlFile(join(FIXTURES, 'sample-conversation.jsonl'));
      const normalizedData = normalizeConversation(parseResult, '-Users-test-Desktop-myproject');
      expect(normalizedData).not.toBeNull();

      // First insert
      testDb.transaction((tx) => {
        tx.insert(schema.conversations)
          .values(normalizedData!.conversation)
          .onConflictDoNothing({ target: schema.conversations.id })
          .run();
        if (normalizedData!.messages.length > 0) {
          tx.insert(schema.messages)
            .values(normalizedData!.messages)
            .onConflictDoNothing({ target: schema.messages.id })
            .run();
        }
        if (normalizedData!.tokenUsage.length > 0) {
          tx.insert(schema.tokenUsage)
            .values(normalizedData!.tokenUsage)
            .onConflictDoNothing({ target: schema.tokenUsage.id })
            .run();
        }
      });

      const countAfterFirst = {
        conversations: testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM conversations`)!.count,
        messages: testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM messages`)!.count,
        tokenUsage: testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM token_usage`)!.count,
      };

      // Second insert (same data)
      testDb.transaction((tx) => {
        tx.insert(schema.conversations)
          .values(normalizedData!.conversation)
          .onConflictDoNothing({ target: schema.conversations.id })
          .run();
        if (normalizedData!.messages.length > 0) {
          tx.insert(schema.messages)
            .values(normalizedData!.messages)
            .onConflictDoNothing({ target: schema.messages.id })
            .run();
        }
        if (normalizedData!.tokenUsage.length > 0) {
          tx.insert(schema.tokenUsage)
            .values(normalizedData!.tokenUsage)
            .onConflictDoNothing({ target: schema.tokenUsage.id })
            .run();
        }
      });

      const countAfterSecond = {
        conversations: testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM conversations`)!.count,
        messages: testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM messages`)!.count,
        tokenUsage: testDb.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM token_usage`)!.count,
      };

      expect(countAfterSecond).toEqual(countAfterFirst);
    });

    it('deterministic IDs across separate parse+normalize runs', async () => {
      const result1 = await parseJsonlFile(join(FIXTURES, 'sample-conversation.jsonl'));
      const data1 = normalizeConversation(result1, '-Users-test-Desktop-myproject');

      const result2 = await parseJsonlFile(join(FIXTURES, 'sample-conversation.jsonl'));
      const data2 = normalizeConversation(result2, '-Users-test-Desktop-myproject');

      expect(data1!.conversation.id).toBe(data2!.conversation.id);
      expect(data1!.messages.map((m) => m.id)).toEqual(data2!.messages.map((m) => m.id));
      expect(data1!.tokenUsage.map((t) => t.id)).toEqual(data2!.tokenUsage.map((t) => t.id));
    });
  });

  describe('API-level deduplication', () => {
    // Use isolated DB for the API test
    const testDbPath = path.join(
      tmpdir(),
      `cowboy-test-dedup-api-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );
    process.env.DATABASE_URL = testDbPath;

    let app: Awaited<ReturnType<typeof import('../../src/app.js')['buildApp']>>;
    let tempFixturesDir: string;

    beforeAll(async () => {
      const { runMigrations } = await import('../../src/db/migrate.js');
      runMigrations();

      // Create temp fixtures directory
      tempFixturesDir = await mkdtemp(join(tmpdir(), 'cowboy-dedup-fixtures-'));
      const projectDir = join(tempFixturesDir, '-Users-test-Desktop-myproject');
      await mkdir(projectDir, { recursive: true });
      await copyFile(
        join(FIXTURES, 'sample-conversation.jsonl'),
        join(projectDir, 'session-abc-123.jsonl'),
      );

      const { buildApp } = await import('../../src/app.js');
      app = await buildApp({
        ingestion: { basePath: tempFixturesDir, autoIngest: false },
      });
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
      await rm(tempFixturesDir, { recursive: true, force: true });
    });

    it('re-ingest via API produces same row counts', async () => {
      // First ingestion
      await app.inject({ method: 'POST', url: '/api/ingest' });
      await pollUntilComplete(app);

      const { db } = await import('../../src/db/index.js');
      const countAfterFirst = {
        conversations: db.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM conversations`)!.count,
        messages: db.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM messages`)!.count,
        tokenUsage: db.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM token_usage`)!.count,
      };

      expect(countAfterFirst.conversations).toBeGreaterThan(0);

      // Second ingestion
      await app.inject({ method: 'POST', url: '/api/ingest' });
      await pollUntilComplete(app);

      const countAfterSecond = {
        conversations: db.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM conversations`)!.count,
        messages: db.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM messages`)!.count,
        tokenUsage: db.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM token_usage`)!.count,
      };

      expect(countAfterSecond).toEqual(countAfterFirst);
    });
  });
});

async function pollUntilComplete(
  app: { inject: (opts: { method: string; url: string }) => Promise<{ json: () => { running: boolean } }> },
  timeoutMs = 10000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await app.inject({ method: 'GET', url: '/api/ingest/status' });
    const status = res.json();
    if (!status.running) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Ingestion did not complete within timeout');
}
