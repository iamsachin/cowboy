import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index.js';
import path from 'node:path';

export function runMigrations() {
  const migrationsFolder = path.resolve(import.meta.dirname, '../../drizzle');
  migrate(db, { migrationsFolder });
}
