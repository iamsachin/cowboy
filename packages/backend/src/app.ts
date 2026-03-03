import Fastify, { FastifyInstance } from 'fastify';
import healthRoutes from './routes/health.js';
import { registerCors } from './plugins/cors.js';
import { registerStatic } from './plugins/static.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // Register CORS in development
  if (process.env.NODE_ENV !== 'production') {
    await registerCors(app);
  }

  // Register routes under /api prefix
  await app.register(healthRoutes, { prefix: '/api' });

  // Register static file serving in production
  if (process.env.NODE_ENV === 'production') {
    await registerStatic(app);
  }

  return app;
}
