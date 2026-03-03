import { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

export default async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    try {
      const result = db.get<{ ok: number }>(sql`SELECT 1 as ok`);
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: result?.ok === 1 ? 'connected' : 'error',
      };
    } catch {
      reply.status(503);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      };
    }
  });
}
