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

export interface FileWatcherOptions {
  basePath?: string;
  cursorBasePath?: string;
  onFilesChanged: () => Promise<void>;
}

const fileWatcherPlugin: FastifyPluginAsync<FileWatcherOptions> = async (
  app: FastifyInstance,
  opts: FileWatcherOptions,
) => {
  const watchDir = opts.basePath || DEFAULT_BASE_DIR;
  const watchers: FSWatcher[] = [];
  let claudeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let cursorDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Claude Code watcher: 1s debounce for JSONL file changes
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

  // Cursor watcher: 3s debounce for state.vscdb changes (Cursor writes frequently)
  const cursorDir = getCursorGlobalStoragePath(opts.cursorBasePath);
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

  // Clean shutdown
  app.addHook('onClose', async () => {
    if (claudeDebounceTimer) clearTimeout(claudeDebounceTimer);
    if (cursorDebounceTimer) clearTimeout(cursorDebounceTimer);
    for (const w of watchers) {
      await w.close();
    }
  });
};

export default fileWatcherPlugin;
