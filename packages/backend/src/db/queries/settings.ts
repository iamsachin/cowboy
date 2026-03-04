import { db } from '../index.js';
import { settings } from '../schema.js';
import { eq } from 'drizzle-orm';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Returns the default Claude Code log directory path.
 * Resolves to ~/.claude/projects using the OS home directory.
 */
export function getDefaultClaudeCodePath(): string {
  return join(homedir(), '.claude', 'projects');
}

/**
 * Returns the default Cursor globalStorage path for the current platform.
 * macOS: ~/Library/Application Support/Cursor/User/globalStorage
 * Linux: ~/.config/Cursor/User/globalStorage
 * Other: empty string (unsupported)
 */
export function getDefaultCursorPath(): string {
  const home = homedir();
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage');
  } else if (process.platform === 'linux') {
    return join(home, '.config', 'Cursor', 'User', 'globalStorage');
  }
  return '';
}

const DEFAULT_SYNC_CATEGORIES = ['conversations', 'messages', 'toolCalls', 'tokenUsage', 'plans'];

/**
 * Get the singleton settings row (id=1).
 * Auto-seeds with OS-resolved default paths on first call.
 * Returns the existing row on subsequent calls (does not overwrite user edits).
 */
export function getSettings() {
  const row = db.select().from(settings).where(eq(settings.id, 1)).get();
  if (!row) {
    // Seed defaults with resolved OS paths
    db.insert(settings).values({
      id: 1,
      claudeCodePath: getDefaultClaudeCodePath(),
      claudeCodeEnabled: true,
      cursorPath: getDefaultCursorPath(),
      cursorEnabled: true,
      syncEnabled: false,
      syncUrl: '',
      syncFrequency: 900,
      syncCategories: DEFAULT_SYNC_CATEGORIES,
    }).run();
    return db.select().from(settings).where(eq(settings.id, 1)).get()!;
  }
  return row;
}

/**
 * Update agent configuration fields and return the updated settings.
 */
export function updateAgentSettings(data: {
  claudeCodePath: string;
  claudeCodeEnabled: boolean;
  cursorPath: string;
  cursorEnabled: boolean;
}) {
  db.update(settings).set({
    claudeCodePath: data.claudeCodePath,
    claudeCodeEnabled: data.claudeCodeEnabled,
    cursorPath: data.cursorPath,
    cursorEnabled: data.cursorEnabled,
  }).where(eq(settings.id, 1)).run();
  return getSettings();
}

/**
 * Update sync configuration fields and return the updated settings.
 */
export function updateSyncSettings(data: {
  syncEnabled: boolean;
  syncUrl: string;
  syncFrequency: number;
  syncCategories: string[];
}) {
  db.update(settings).set({
    syncEnabled: data.syncEnabled,
    syncUrl: data.syncUrl,
    syncFrequency: data.syncFrequency,
    syncCategories: data.syncCategories,
  }).where(eq(settings.id, 1)).run();
  return getSettings();
}

/**
 * Update sync status fields (used by sync scheduler after each sync attempt).
 */
export function updateSyncStatus(data: {
  lastSyncAt?: string;
  lastSyncError?: string | null;
  lastSyncSuccess?: boolean;
}) {
  db.update(settings).set(data).where(eq(settings.id, 1)).run();
  return getSettings();
}
