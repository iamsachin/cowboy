import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  agent: text('agent').notNull(),
  project: text('project'),
  title: text('title'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  model: text('model'),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  role: text('role').notNull(),
  content: text('content'),
  createdAt: text('created_at').notNull(),
  model: text('model'),
});

export const toolCalls = sqliteTable('tool_calls', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => messages.id),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  name: text('name').notNull(),
  input: text('input', { mode: 'json' }),
  output: text('output', { mode: 'json' }),
  status: text('status'),
  duration: integer('duration'),
  createdAt: text('created_at').notNull(),
});

export const tokenUsage = sqliteTable('token_usage', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  messageId: text('message_id').references(() => messages.id),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  cacheReadTokens: integer('cache_read_tokens').default(0),
  cacheCreationTokens: integer('cache_creation_tokens').default(0),
  createdAt: text('created_at').notNull(),
});

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  sourceMessageId: text('source_message_id').notNull().references(() => messages.id),
  title: text('title').notNull(),
  totalSteps: integer('total_steps').notNull(),
  completedSteps: integer('completed_steps').notNull().default(0),
  status: text('status').notNull().default('unknown'),
  createdAt: text('created_at').notNull(),
});

export const planSteps = sqliteTable('plan_steps', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull().references(() => plans.id),
  stepNumber: integer('step_number').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull().default('unknown'),
  createdAt: text('created_at').notNull(),
});
