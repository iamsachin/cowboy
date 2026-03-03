import { runMigrations } from './db/migrate.js';
import { buildApp } from './app.js';

async function start() {
  runMigrations();
  const app = await buildApp();
  await app.listen({ port: 3000, host: '0.0.0.0' });
}

start();
