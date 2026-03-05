/**
 * One-time data quality migration for existing conversations.
 *
 * Fixes:
 * - Conversations with bad titles (system caveats, interruption notices, slash commands, NULL)
 * - Claude Code conversations with NULL model (derives from token_usage)
 * - Cursor conversations with "default" model (resolves to actual model or "unknown")
 *
 * Idempotent: safe to run on every ingestion cycle.
 */

import { eq, isNull, and, sql } from 'drizzle-orm';
import { conversations, messages, tokenUsage } from '../db/schema.js';
import { shouldSkipForTitle } from './title-utils.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema.js';

type Database = BetterSQLite3Database<typeof schema>;

// ── Title fix helpers ──────────────────────────────────────────────────

/**
 * Returns true if the title needs to be recomputed.
 */
export function needsTitleFix(title: string | null): boolean {
  if (title === null) return true;
  const trimmed = title.trim();
  if (trimmed.length === 0) return true;
  return shouldSkipForTitle(trimmed);
}

function stripXmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.substring(0, maxLen) : text;
}

// ── Title migration ────────────────────────────────────────────────────

/**
 * Fix conversations with bad or missing titles.
 * Returns the number of conversations updated.
 */
export function fixConversationTitles(database: Database): number {
  // Get all conversations
  const allConversations = database
    .select({ id: conversations.id, title: conversations.title })
    .from(conversations)
    .all();

  let fixedCount = 0;

  for (const conv of allConversations) {
    if (!needsTitleFix(conv.title)) continue;

    // Query user messages ordered by createdAt
    const userMessages = database
      .select({ content: messages.content })
      .from(messages)
      .where(and(eq(messages.conversationId, conv.id), eq(messages.role, 'user')))
      .orderBy(messages.createdAt)
      .all();

    let newTitle: string | null = null;

    // First pass: find first non-skippable user message
    for (const msg of userMessages) {
      if (msg.content && msg.content.trim().length > 0) {
        if (shouldSkipForTitle(msg.content)) continue;
        newTitle = truncate(msg.content, 100);
        break;
      }
    }

    // Second pass: XML fallback
    if (newTitle === null) {
      for (const msg of userMessages) {
        if (msg.content && msg.content.trim().startsWith('<')) {
          const stripped = stripXmlTags(msg.content);
          if (stripped.length > 10) {
            newTitle = truncate(stripped, 100);
            break;
          }
        }
      }
    }

    // Third pass: assistant text fallback
    if (newTitle === null) {
      const assistantMessages = database
        .select({ content: messages.content })
        .from(messages)
        .where(and(eq(messages.conversationId, conv.id), eq(messages.role, 'assistant')))
        .orderBy(messages.createdAt)
        .all();

      for (const msg of assistantMessages) {
        if (msg.content && msg.content.trim().length > 0) {
          newTitle = truncate(msg.content, 100);
          break;
        }
      }
    }

    // Only update if we found a better title
    if (newTitle !== null) {
      database
        .update(conversations)
        .set({ title: newTitle })
        .where(eq(conversations.id, conv.id))
        .run();
      fixedCount++;
    }
  }

  return fixedCount;
}

// ── Model migration ────────────────────────────────────────────────────

/**
 * Fix conversations with NULL or "default" models.
 * Returns the number of conversations updated.
 */
export function fixConversationModels(database: Database): number {
  let fixedCount = 0;

  // Fix Claude Code conversations with NULL model using token_usage
  const nullModelConvs = database
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(isNull(conversations.model), eq(conversations.agent, 'claude-code')))
    .all();

  for (const conv of nullModelConvs) {
    // Count model frequency from token_usage
    const modelCounts = database
      .select({
        model: tokenUsage.model,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(tokenUsage)
      .where(eq(tokenUsage.conversationId, conv.id))
      .groupBy(tokenUsage.model)
      .orderBy(sql`count(*) DESC`)
      .all();

    if (modelCounts.length > 0) {
      database
        .update(conversations)
        .set({ model: modelCounts[0].model })
        .where(eq(conversations.id, conv.id))
        .run();
      fixedCount++;
    }
  }

  // Fix Cursor conversations with "default" model
  const defaultModelConvs = database
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.model, 'default'), eq(conversations.agent, 'cursor')))
    .all();

  for (const conv of defaultModelConvs) {
    // Find most common non-default model from assistant messages
    const modelCounts = database
      .select({
        model: messages.model,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conv.id),
          eq(messages.role, 'assistant'),
          sql`${messages.model} IS NOT NULL AND ${messages.model} != 'default'`,
        ),
      )
      .groupBy(messages.model)
      .orderBy(sql`count(*) DESC`)
      .all();

    const resolvedModel = modelCounts.length > 0 ? modelCounts[0].model : 'unknown';

    database
      .update(conversations)
      .set({ model: resolvedModel })
      .where(eq(conversations.id, conv.id))
      .run();
    fixedCount++;

    // Also fix per-message "default" model for this cursor conversation
    database
      .update(messages)
      .set({ model: 'unknown' })
      .where(
        and(
          eq(messages.conversationId, conv.id),
          eq(messages.model, 'default'),
        ),
      )
      .run();
  }

  return fixedCount;
}

// ── Main migration runner ──────────────────────────────────────────────

/**
 * Run all data quality migrations.
 * Idempotent: safe to call on every startup.
 */
export function runDataQualityMigration(
  database: Database,
): { titlesFixed: number; modelsFixed: number } {
  const titlesFixed = fixConversationTitles(database);
  const modelsFixed = fixConversationModels(database);
  return { titlesFixed, modelsFixed };
}
