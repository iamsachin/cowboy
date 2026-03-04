import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { watch } from 'chokidar';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_BASE_DIR = join(homedir(), '.claude', 'projects');

export interface FileWatcherOptions {
  basePath?: string;
  onFilesChanged: () => Promise<void>;
}

const fileWatcherPlugin: FastifyPluginAsync<FileWatcherOptions> = async (
  app: FastifyInstance,
  opts: FileWatcherOptions,
) => {
  const watchDir = opts.basePath || DEFAULT_BASE_DIR;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const watcher = watch(watchDir, {
    ignoreInitial: true,
    depth: 5,
    persistent: true,
  });

  // Global debounce: wait 1s after last change before triggering
  function scheduleIngestion() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      opts.onFilesChanged().catch((err) => {
        app.log.error({ err }, 'File watcher ingestion callback failed');
      });
    }, 1000);
  }

  watcher
    .on('add', (path) => {
      if (path.endsWith('.jsonl')) {
        app.log.info({ path }, 'New JSONL file detected');
        scheduleIngestion();
      }
    })
    .on('change', (path) => {
      if (path.endsWith('.jsonl')) {
        app.log.info({ path }, 'JSONL file modified');
        scheduleIngestion();
      }
    });

  // Clean shutdown
  app.addHook('onClose', async () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    await watcher.close();
  });
};

export default fileWatcherPlugin;
