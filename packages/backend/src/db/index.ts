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

export const db = drizzle({ client: sqlite, schema });
