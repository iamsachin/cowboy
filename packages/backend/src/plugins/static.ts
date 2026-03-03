import path from 'node:path';
import fastifyStatic from '@fastify/static';
import { FastifyInstance } from 'fastify';

export async function registerStatic(app: FastifyInstance) {
  const distPath = path.resolve(import.meta.dirname, '../../../frontend/dist');

  await app.register(fastifyStatic, {
    root: distPath,
    prefix: '/',
    wildcard: false,
  });

  // SPA fallback: serve index.html for non-API routes
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.status(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
}
