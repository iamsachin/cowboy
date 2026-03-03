import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle } from 'drizzle-orm/better-sqlite3';

describe('Database Migration', () => {
  const testDbPath = path.join(os.tmpdir(), `cowboy-test-migration-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  let sqlite: InstanceType<typeof Database>;

  beforeAll(() => {
    sqlite = new Database(testDbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    const db = drizzle({ client: sqlite });

    // Resolve migrations folder relative to this test file
    const migrationsFolder = path.resolve(import.meta.dirname, '../drizzle');
    migrate(db, { migrationsFolder });
  });

  afterAll(() => {
    sqlite.close();
    try {
      fs.unlinkSync(testDbPath);
      fs.unlinkSync(testDbPath + '-wal');
      fs.unlinkSync(testDbPath + '-shm');
    } catch {
      // Files may not exist, that is fine
    }
  });

  it('creates the database file after running migrations', () => {
    expect(fs.existsSync(testDbPath)).toBe(true);
  });

  it('creates all 4 tables', () => {
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name).sort();
    expect(tableNames).toEqual(['conversations', 'messages', 'token_usage', 'tool_calls']);
  });

  it('conversations table has expected columns', () => {
    const columns = sqlite
      .prepare('PRAGMA table_info(conversations)')
      .all() as { name: string; type: string }[];

    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('agent');
    expect(columnNames).toContain('project');
    expect(columnNames).toContain('title');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
    expect(columnNames).toContain('model');
  });

  it('messages table has foreign key to conversations', () => {
    const fks = sqlite
      .prepare('PRAGMA foreign_key_list(messages)')
      .all() as { table: string; from: string; to: string }[];

    const conversationFk = fks.find((fk) => fk.table === 'conversations');
    expect(conversationFk).toBeDefined();
    expect(conversationFk!.from).toBe('conversation_id');
    expect(conversationFk!.to).toBe('id');
  });
});
