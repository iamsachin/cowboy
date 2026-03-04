import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { conversations, messages, toolCalls, tokenUsage } from '../../src/db/schema.js';
import * as schema from '../../src/db/schema.js';

/**
 * Seed analytics test data: 5 conversations across 3 days with varied token usage.
 *
 * Conversations:
 *   conv-1: 2026-01-15, project-alpha, claude-sonnet-4-5, input=100000, output=50000, cacheRead=20000, cacheCreation=10000
 *   conv-2: 2026-01-15, project-alpha, claude-sonnet-4-5, input=200000, output=100000, cacheRead=40000, cacheCreation=20000
 *   conv-3: 2026-01-16, project-beta, claude-haiku-4-5, input=50000, output=25000, cacheRead=10000, cacheCreation=5000
 *   conv-4: 2026-01-16, project-beta, claude-haiku-4-5, input=75000, output=30000, cacheRead=15000, cacheCreation=8000
 *   conv-5: 2026-01-17, project-alpha, unknown-model, input=30000, output=15000, cacheRead=5000, cacheCreation=3000
 */
export async function seedAnalyticsData(db: BetterSQLite3Database<typeof schema>) {
  // Insert conversations
  db.insert(conversations).values([
    { id: 'conv-1', agent: 'claude-code', project: 'project-alpha', title: 'Conv 1', createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-01-15T10:30:00Z', model: 'claude-sonnet-4-5' },
    { id: 'conv-2', agent: 'claude-code', project: 'project-alpha', title: 'Conv 2', createdAt: '2026-01-15T14:00:00Z', updatedAt: '2026-01-15T14:30:00Z', model: 'claude-sonnet-4-5' },
    { id: 'conv-3', agent: 'claude-code', project: 'project-beta', title: 'Conv 3', createdAt: '2026-01-16T09:00:00Z', updatedAt: '2026-01-16T09:30:00Z', model: 'claude-haiku-4-5' },
    { id: 'conv-4', agent: 'claude-code', project: 'project-beta', title: 'Conv 4', createdAt: '2026-01-16T15:00:00Z', updatedAt: '2026-01-16T15:30:00Z', model: 'claude-haiku-4-5' },
    { id: 'conv-5', agent: 'claude-code', project: 'project-alpha', title: 'Conv 5', createdAt: '2026-01-17T11:00:00Z', updatedAt: '2026-01-17T11:30:00Z', model: 'unknown-model' },
  ]).run();

  // Insert token usage (one record per conversation for simplicity)
  db.insert(tokenUsage).values([
    { id: 'tu-1', conversationId: 'conv-1', model: 'claude-sonnet-4-5', inputTokens: 100000, outputTokens: 50000, cacheReadTokens: 20000, cacheCreationTokens: 10000, createdAt: '2026-01-15T10:00:00Z' },
    { id: 'tu-2', conversationId: 'conv-2', model: 'claude-sonnet-4-5', inputTokens: 200000, outputTokens: 100000, cacheReadTokens: 40000, cacheCreationTokens: 20000, createdAt: '2026-01-15T14:00:00Z' },
    { id: 'tu-3', conversationId: 'conv-3', model: 'claude-haiku-4-5', inputTokens: 50000, outputTokens: 25000, cacheReadTokens: 10000, cacheCreationTokens: 5000, createdAt: '2026-01-16T09:00:00Z' },
    { id: 'tu-4', conversationId: 'conv-4', model: 'claude-haiku-4-5', inputTokens: 75000, outputTokens: 30000, cacheReadTokens: 15000, cacheCreationTokens: 8000, createdAt: '2026-01-16T15:00:00Z' },
    { id: 'tu-5', conversationId: 'conv-5', model: 'unknown-model', inputTokens: 30000, outputTokens: 15000, cacheReadTokens: 5000, cacheCreationTokens: 3000, createdAt: '2026-01-17T11:00:00Z' },
  ]).run();

  // Insert messages for conversations
  db.insert(messages).values([
    // conv-1: user message + assistant message with code block content
    { id: 'msg-1a', conversationId: 'conv-1', role: 'user', content: 'How do I build the app?', createdAt: '2026-01-15T10:00:00Z', model: null },
    { id: 'msg-1b', conversationId: 'conv-1', role: 'assistant', content: 'Here is how you build the app:\n\n```typescript\nfunction buildApp() {\n  return new App();\n}\n```\n\nThis function buildApp initializes and returns a new App instance.', createdAt: '2026-01-15T10:01:00Z', model: 'claude-sonnet-4-5' },
    // conv-2: user + assistant
    { id: 'msg-2a', conversationId: 'conv-2', role: 'user', content: 'What is the project structure?', createdAt: '2026-01-15T14:00:00Z', model: null },
    { id: 'msg-2b', conversationId: 'conv-2', role: 'assistant', content: 'The project uses a monorepo structure with packages for frontend and backend.', createdAt: '2026-01-15T14:01:00Z', model: 'claude-sonnet-4-5' },
    // conv-3: user + assistant
    { id: 'msg-3a', conversationId: 'conv-3', role: 'user', content: 'Explain database migrations.', createdAt: '2026-01-16T09:00:00Z', model: null },
    { id: 'msg-3b', conversationId: 'conv-3', role: 'assistant', content: 'Database migrations are handled by Drizzle Kit. Run pnpm db:migrate to apply pending migrations.', createdAt: '2026-01-16T09:01:00Z', model: 'claude-haiku-4-5' },
    // conv-4: user + assistant (needed for tool call references)
    { id: 'msg-4a', conversationId: 'conv-4', role: 'user', content: 'Fix the build.', createdAt: '2026-01-16T15:00:00Z', model: null },
    { id: 'msg-4b', conversationId: 'conv-4', role: 'assistant', content: 'I fixed the build issue.', createdAt: '2026-01-16T15:01:00Z', model: 'claude-haiku-4-5' },
    // conv-5: user + assistant
    { id: 'msg-5a', conversationId: 'conv-5', role: 'user', content: 'Run tests.', createdAt: '2026-01-17T11:00:00Z', model: null },
    { id: 'msg-5b', conversationId: 'conv-5', role: 'assistant', content: 'All tests pass.', createdAt: '2026-01-17T11:01:00Z', model: 'unknown-model' },
  ]).run();

  // Insert tool calls across conversations with varied tools, statuses, and durations
  // Tools: Read, Write, Bash
  // Statuses: completed (success), error (failure)
  // Durations: varied for P95 testing
  db.insert(toolCalls).values([
    // conv-1: Read (completed, 150ms) + Write (completed, 200ms)
    { id: 'tc-1', messageId: 'msg-1b', conversationId: 'conv-1', name: 'Read', input: { path: 'file.ts' }, output: { content: 'code' }, status: 'completed', duration: 150, createdAt: '2026-01-15T10:00:30Z' },
    { id: 'tc-2', messageId: 'msg-1b', conversationId: 'conv-1', name: 'Write', input: { path: 'out.ts' }, output: { success: true }, status: 'completed', duration: 200, createdAt: '2026-01-15T10:00:45Z' },
    // conv-2: Read (completed, 80ms) + Bash (error, 5000ms) + Read (completed, 120ms)
    { id: 'tc-3', messageId: 'msg-2b', conversationId: 'conv-2', name: 'Read', input: { path: 'pkg.json' }, output: { content: '{}' }, status: 'completed', duration: 80, createdAt: '2026-01-15T14:00:30Z' },
    { id: 'tc-4', messageId: 'msg-2b', conversationId: 'conv-2', name: 'Bash', input: { command: 'npm build' }, output: { error: 'failed' }, status: 'error', duration: 5000, createdAt: '2026-01-15T14:00:45Z' },
    { id: 'tc-5', messageId: 'msg-2b', conversationId: 'conv-2', name: 'Read', input: { path: 'tsconfig.json' }, output: { content: '{}' }, status: 'completed', duration: 120, createdAt: '2026-01-15T14:01:00Z' },
    // conv-3: Bash (completed, 3000ms) + Write (error, 100ms)
    { id: 'tc-6', messageId: 'msg-3b', conversationId: 'conv-3', name: 'Bash', input: { command: 'pnpm migrate' }, output: { stdout: 'ok' }, status: 'completed', duration: 3000, createdAt: '2026-01-16T09:00:30Z' },
    { id: 'tc-7', messageId: 'msg-3b', conversationId: 'conv-3', name: 'Write', input: { path: 'schema.ts' }, output: { error: 'permission denied' }, status: 'error', duration: 100, createdAt: '2026-01-16T09:00:45Z' },
    // conv-4: Read (completed, 90ms)
    { id: 'tc-8', messageId: 'msg-4b', conversationId: 'conv-4', name: 'Read', input: { path: 'build.ts' }, output: { content: 'code' }, status: 'completed', duration: 90, createdAt: '2026-01-16T15:00:30Z' },
    // conv-5: Bash (completed, 1500ms) + Read (completed, 200ms)
    { id: 'tc-9', messageId: 'msg-5b', conversationId: 'conv-5', name: 'Bash', input: { command: 'vitest run' }, output: { stdout: 'pass' }, status: 'completed', duration: 1500, createdAt: '2026-01-17T11:00:30Z' },
    { id: 'tc-10', messageId: 'msg-5b', conversationId: 'conv-5', name: 'Read', input: { path: 'test.ts' }, output: { content: 'test' }, status: 'completed', duration: 200, createdAt: '2026-01-17T11:00:45Z' },
  ]).run();

}

// Expected totals for all 5 conversations (2026-01-15 to 2026-01-17)
export const EXPECTED_TOTAL_INPUT = 455000;    // 100000 + 200000 + 50000 + 75000 + 30000
export const EXPECTED_TOTAL_OUTPUT = 220000;   // 50000 + 100000 + 25000 + 30000 + 15000
export const EXPECTED_TOTAL_CACHE_READ = 90000;  // 20000 + 40000 + 10000 + 15000 + 5000
export const EXPECTED_TOTAL_CACHE_CREATION = 46000; // 10000 + 20000 + 5000 + 8000 + 3000
export const EXPECTED_CONVERSATION_COUNT = 5;
export const EXPECTED_ACTIVE_DAYS = 3;

// Expected costs for known-model conversations only
// Sonnet conv-1: (100000*3 + 50000*15 + 20000*0.30 + 10000*3.75) / 1_000_000 = (300000 + 750000 + 6000 + 37500) / 1_000_000 = 1.0935
// Sonnet conv-2: (200000*3 + 100000*15 + 40000*0.30 + 20000*3.75) / 1_000_000 = (600000 + 1500000 + 12000 + 75000) / 1_000_000 = 2.187
// Haiku conv-3: (50000*1 + 25000*5 + 10000*0.10 + 5000*1.25) / 1_000_000 = (50000 + 125000 + 1000 + 6250) / 1_000_000 = 0.18225
// Haiku conv-4: (75000*1 + 30000*5 + 15000*0.10 + 8000*1.25) / 1_000_000 = (75000 + 150000 + 1500 + 10000) / 1_000_000 = 0.2365
// conv-5: unknown-model, cost = null (excluded from total)
// Total cost = 1.0935 + 2.187 + 0.18225 + 0.2365 = 3.69925
export const EXPECTED_TOTAL_COST = 3.69925;

// Expected savings for known-model conversations only
// Sonnet conv-1 savings: 20000 * (3 - 0.30) / 1_000_000 = 20000 * 2.70 / 1_000_000 = 0.054
// Sonnet conv-2 savings: 40000 * (3 - 0.30) / 1_000_000 = 40000 * 2.70 / 1_000_000 = 0.108
// Haiku conv-3 savings: 10000 * (1 - 0.10) / 1_000_000 = 10000 * 0.90 / 1_000_000 = 0.009
// Haiku conv-4 savings: 15000 * (1 - 0.10) / 1_000_000 = 15000 * 0.90 / 1_000_000 = 0.0135
// conv-5: unknown-model, savings = null (excluded from total)
// Total savings = 0.054 + 0.108 + 0.009 + 0.0135 = 0.1845
export const EXPECTED_TOTAL_SAVINGS = 0.1845;
