import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { settings } from '../../src/db/schema.js';
import * as schema from '../../src/db/schema.js';

/**
 * Seed a settings row with known test values.
 * Useful for tests that need a pre-existing settings row with specific config.
 */
export async function seedSettings(db: BetterSQLite3Database<typeof schema>) {
  db.insert(settings).values({
    id: 1,
    claudeCodePath: '/test/claude/projects',
    claudeCodeEnabled: true,
    cursorPath: '/test/cursor/globalStorage',
    cursorEnabled: false,
    syncEnabled: true,
    syncUrl: 'https://example.com/sync',
    syncFrequency: 300,
    syncCategories: ['conversations', 'messages'],
  }).run();
}
