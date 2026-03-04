import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { watch, type FSWatcher } from 'chokidar';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { statSync } from 'node:fs';

const DEFAULT_BASE_DIR = join(homedir(), '.claude', 'projects');

/**
 * Get the Cursor globalStorage directory path by platform.
 * Returns null if the directory does not exist.
 */
function getCursorGlobalStoragePath(cursorBasePath?: string): string | null {
  if (cursorBasePath) {
    try { statSync(cursorBasePath); return cursorBasePath; } catch { return null; }
  }

  const home = homedir();
  let dirPath: string;

  if (process.platform === 'darwin') {
    dirPath = join(home, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage');
  } else if (process.platform === 'linux') {
    dirPath = join(home, '.config', 'Cursor', 'User', 'globalStorage');
  } else {
    return null;
  }

  try { statSync(dirPath); return dirPath; } catch { return null; }
}

declare module 'fastify' {
  interface FastifyInstance {
    fileWatcher: {
      restart: () => Promise<void>;
    };
  }
}

export interface FileWatcherOptions {
  basePath?: string;
  cursorBasePath?: string;
  onFilesChanged: () => Promise<void>;
}

const fileWatcherPluginInner: FastifyPluginAsync<FileWatcherOptions> = async (
  app: FastifyInstance,
  opts: FileWatcherOptions,
) => {
  let watchers: FSWatcher[] = [];
  let claudeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let cursorDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Create watchers for enabled agents based on current settings.
   * Falls back to opts paths or OS defaults when settings paths are empty.
   */
  function createWatchers(
    claudeCodePath: string | undefined,
    cursorPath: string | undefined,
    claudeCodeEnabled: boolean,
    cursorEnabled: boolean,
  ): void {
    // Claude Code watcher: 1s debounce for JSONL file changes
    if (claudeCodeEnabled) {
      const watchDir = claudeCodePath || opts.basePath || DEFAULT_BASE_DIR;

      const claudeWatcher = watch(watchDir, {
        ignoreInitial: true,
        depth: 5,
        persistent: true,
      });
      watchers.push(claudeWatcher);

      function scheduleClaudeIngestion() {
        if (claudeDebounceTimer) clearTimeout(claudeDebounceTimer);
        claudeDebounceTimer = setTimeout(() => {
          claudeDebounceTimer = null;
          opts.onFilesChanged().catch((err) => {
            app.log.error({ err }, 'File watcher ingestion callback failed');
          });
        }, 1000);
      }

      claudeWatcher
        .on('add', (path) => {
          if (path.endsWith('.jsonl')) {
            app.log.info({ path }, 'New JSONL file detected');
            scheduleClaudeIngestion();
          }
        })
        .on('change', (path) => {
          if (path.endsWith('.jsonl')) {
            app.log.info({ path }, 'JSONL file modified');
            scheduleClaudeIngestion();
          }
        });
    }

    // Cursor watcher: 3s debounce for state.vscdb changes (Cursor writes frequently)
    if (cursorEnabled) {
      const cursorDir = getCursorGlobalStoragePath(cursorPath || opts.cursorBasePath);
      if (cursorDir) {
        const cursorWatcher = watch(cursorDir, {
          ignoreInitial: true,
          depth: 0,
          persistent: true,
        });
        watchers.push(cursorWatcher);

        function scheduleCursorIngestion() {
          if (cursorDebounceTimer) clearTimeout(cursorDebounceTimer);
          cursorDebounceTimer = setTimeout(() => {
            cursorDebounceTimer = null;
            opts.onFilesChanged().catch((err) => {
              app.log.error({ err }, 'Cursor file watcher ingestion callback failed');
            });
          }, 3000);
        }

        cursorWatcher
          .on('change', (path) => {
            // Only trigger on state.vscdb changes, ignore WAL and journal files
            if (path.endsWith('state.vscdb')) {
              app.log.info({ path }, 'Cursor state.vscdb modified');
              scheduleCursorIngestion();
            }
          });

        app.log.info({ cursorDir }, 'Watching Cursor globalStorage for state.vscdb changes');
      }
    }
  }

  /**
   * Close all existing watchers and clear debounce timers.
   */
  async function closeWatchers(): Promise<void> {
    if (claudeDebounceTimer) { clearTimeout(claudeDebounceTimer); claudeDebounceTimer = null; }
    if (cursorDebounceTimer) { clearTimeout(cursorDebounceTimer); cursorDebounceTimer = null; }
    for (const w of watchers) {
      await w.close();
    }
    watchers = [];
  }

  /**
   * Restart watchers with fresh settings from DB.
   * Closes old watchers first to avoid race conditions (Pitfall 1).
   * Triggers re-ingestion after restart.
   */
  async function restart(): Promise<void> {
    // 1. Close existing watchers
    await closeWatchers();

    // 2. Read updated settings from DB
    let claudeCodePath: string | undefined;
    let cursorPath: string | undefined;
    let claudeCodeEnabled = true;
    let cursorEnabled = true;

    try {
      const { getSettings } = await import('../db/queries/settings.js');
      const currentSettings = getSettings();
      claudeCodePath = currentSettings.claudeCodePath || undefined;
      cursorPath = currentSettings.cursorPath || undefined;
      claudeCodeEnabled = currentSettings.claudeCodeEnabled;
      cursorEnabled = currentSettings.cursorEnabled;
    } catch {
      // Settings table may not exist (tests); use defaults
    }

    // 3. Create new watchers for enabled agents only
    createWatchers(claudeCodePath, cursorPath, claudeCodeEnabled, cursorEnabled);

    // 4. Trigger re-ingestion via app.inject
    try {
      await app.inject({ method: 'POST', url: '/api/ingest' });
    } catch {
      // Ingestion route may not be registered in all contexts
    }
  }

  // Decorate app with restart capability
  app.decorate('fileWatcher', { restart });

  // Initial setup: determine paths and enabled state
  // When basePath is explicitly provided (tests), use it directly without DB lookup
  // to maintain test isolation. In production, read paths from settings DB.
  if (opts.basePath) {
    // Test/explicit mode: only watch the provided basePath, no Cursor watcher
    createWatchers(opts.basePath, opts.cursorBasePath, true, !!opts.cursorBasePath);
  } else {
    // Production mode: read settings from DB
    let claudeCodePath: string | undefined;
    let cursorPath: string | undefined;
    let claudeCodeEnabled = true;
    let cursorEnabled = true;

    try {
      const { getSettings } = await import('../db/queries/settings.js');
      const currentSettings = getSettings();
      claudeCodePath = currentSettings.claudeCodePath || undefined;
      cursorPath = currentSettings.cursorPath || undefined;
      claudeCodeEnabled = currentSettings.claudeCodeEnabled;
      cursorEnabled = currentSettings.cursorEnabled;
    } catch {
      // Settings table may not exist; use OS defaults
    }

    createWatchers(claudeCodePath, cursorPath, claudeCodeEnabled, cursorEnabled);
  }

  // Clean shutdown
  app.addHook('onClose', async () => {
    await closeWatchers();
  });
};

// Use fp() to break encapsulation so fileWatcher decorator propagates to parent
const fileWatcherPlugin = fp(fileWatcherPluginInner, {
  name: 'cowboy-file-watcher',
});

export default fileWatcherPlugin;
