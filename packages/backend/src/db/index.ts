import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DATABASE_URL || './data/cowboy.db';

// Ensure the data directory exists
const dbDir = path.dirname(DB_PATH);
if (dbDir !== '.' && dbDir !== '') {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Performance indexes — critical for query speed with large datasets.
// CREATE INDEX IF NOT EXISTS is idempotent so safe to run on every startup.
sqlite.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_role ON messages(conversation_id, role);
  CREATE INDEX IF NOT EXISTS idx_token_usage_conversation_id ON token_usage(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_token_usage_conv_model ON token_usage(conversation_id, model);
  CREATE INDEX IF NOT EXISTS idx_tool_calls_conversation_id ON tool_calls(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_compaction_events_conversation_id ON compaction_events(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
  CREATE INDEX IF NOT EXISTS idx_conversations_parent_id ON conversations(parent_conversation_id);
`);

export const db = drizzle({ client: sqlite, schema });
