import Fastify, { FastifyInstance } from 'fastify';
import healthRoutes from './routes/health.js';
import analyticsRoutes from './routes/analytics.js';
import ingestionPlugin from './ingestion/index.js';
import type { IngestionPluginOptions } from './ingestion/index.js';
import websocketPlugin from './plugins/websocket.js';
import fileWatcherPlugin from './plugins/file-watcher.js';
import { registerCors } from './plugins/cors.js';
import { registerStatic } from './plugins/static.js';

export interface AppOptions {
  ingestion?: IngestionPluginOptions;
  fileWatcher?: { basePath?: string };
}

export async function buildApp(opts?: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // Register CORS in development
  if (process.env.NODE_ENV !== 'production') {
    await registerCors(app);
  }

  // Register WebSocket plugin FIRST (before any routes that use websocket: true)
  // Uses fp() to break encapsulation so broadcast decorator is available on root app
  await app.register(websocketPlugin);

  // Register routes under /api prefix
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(analyticsRoutes, { prefix: '/api' });
  await app.register(ingestionPlugin, {
    prefix: '/api',
    ...opts?.ingestion,
    onIngestionComplete: () => {
      app.broadcast({ type: 'data-changed', timestamp: new Date().toISOString() });
    },
  });

  // Register file watcher to trigger ingestion on JSONL changes
  await app.register(fileWatcherPlugin, {
    basePath: opts?.fileWatcher?.basePath ?? opts?.ingestion?.basePath,
    onFilesChanged: async () => {
      await app.inject({ method: 'POST', url: '/api/ingest' });
    },
  });

  // Register static file serving in production
  if (process.env.NODE_ENV === 'production') {
    await registerStatic(app);
  }

  return app;
}
