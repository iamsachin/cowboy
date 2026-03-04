import { statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Discover the Cursor state.vscdb database file on disk.
 * Returns the absolute path if found, null otherwise.
 *
 * macOS: ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
 * Linux: ~/.config/Cursor/User/globalStorage/state.vscdb
 */
export function discoverCursorDb(): string | null {
  const home = homedir();
  let dbPath: string;

  if (process.platform === 'darwin') {
    dbPath = join(home, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
  } else if (process.platform === 'linux') {
    dbPath = join(home, '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
  } else {
    // Unsupported platform
    return null;
  }

  try {
    statSync(dbPath);
    return dbPath;
  } catch {
    return null;
  }
}
