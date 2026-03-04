import { generateId } from './id-generator.js';
import type { NormalizedData } from './normalizer.js';
import type { CursorConversation, CursorBubble } from './cursor-parser.js';

/**
 * Normalize a Cursor conversation and its bubbles into the unified schema.
 * Returns null if there are no bubbles (empty conversation).
 *
 * Uses deterministic IDs based on composerId so re-ingestion produces no duplicates.
 */
export function normalizeCursorConversation(
  conv: CursorConversation,
  bubbles: CursorBubble[],
  project: string,
): NormalizedData | null {
  if (bubbles.length === 0) return null;

  const conversationId = generateId('cursor', conv.composerId);

  // Title: first user bubble's text, truncated to 100 chars
  const title = deriveTitle(bubbles);

  // Timestamps
  const createdAt = normalizeCursorTimestamp(conv.createdAt);
  const updatedAt = normalizeCursorTimestamp(conv.lastUpdatedAt || conv.createdAt);

  // Model: from modelConfig or most common model across AI bubbles
  const model = deriveModel(conv, bubbles);

  const conversation = {
    id: conversationId,
    agent: 'cursor',
    project,
    title,
    createdAt,
    updatedAt,
    model,
  };

  // ── Messages ──────────────────────────────────────────────────────────

  const normalizedMessages: NormalizedData['messages'] = [];

  for (const bubble of bubbles) {
    const role = bubble.type === 1 ? 'user' : bubble.type === 2 ? 'assistant' : null;
    if (!role) continue;

    const messageId = generateId(conversationId, bubble.bubbleId);
    const bubbleTimestamp = deriveBubbleTimestamp(bubble, conv);
    const bubbleModel = role === 'assistant'
      ? (bubble.modelInfo?.modelName ?? conv.modelConfig?.modelName ?? null)
      : null;

    normalizedMessages.push({
      id: messageId,
      conversationId,
      role,
      content: bubble.text || null,
      createdAt: bubbleTimestamp,
      model: bubbleModel,
    });
  }

  // ── Tool calls ────────────────────────────────────────────────────────
  // Cursor's toolFormerData is inconsistent; extract what we can
  const normalizedToolCalls: NormalizedData['toolCalls'] = [];

  // ── Token usage ────────────────────────────────────────────────────────

  const normalizedTokenUsage: NormalizedData['tokenUsage'] = [];

  for (const bubble of bubbles) {
    if (bubble.type !== 2) continue; // Only assistant bubbles have token usage

    const inputTokens = bubble.tokenCount?.inputTokens ?? 0;
    const outputTokens = bubble.tokenCount?.outputTokens ?? 0;

    // Only record if there are actual token counts
    if (inputTokens > 0 || outputTokens > 0) {
      const messageId = generateId(conversationId, bubble.bubbleId);
      const bubbleModel = bubble.modelInfo?.modelName ?? conv.modelConfig?.modelName ?? 'unknown';
      const bubbleTimestamp = deriveBubbleTimestamp(bubble, conv);

      normalizedTokenUsage.push({
        id: generateId(conversationId, `token-${bubble.bubbleId}`),
        conversationId,
        messageId,
        model: bubbleModel,
        inputTokens,
        outputTokens,
        cacheReadTokens: 0,  // Cursor does not expose cache token data
        cacheCreationTokens: 0,
        createdAt: bubbleTimestamp,
      });
    }
  }

  return {
    conversation,
    messages: normalizedMessages,
    toolCalls: normalizedToolCalls,
    tokenUsage: normalizedTokenUsage,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function deriveTitle(bubbles: CursorBubble[]): string | null {
  for (const bubble of bubbles) {
    if (bubble.type === 1 && bubble.text && bubble.text.trim().length > 0) {
      return bubble.text.length > 100 ? bubble.text.substring(0, 100) : bubble.text;
    }
  }
  return null;
}

function deriveModel(conv: CursorConversation, bubbles: CursorBubble[]): string | null {
  // Try modelConfig first
  if (conv.modelConfig?.modelName) return conv.modelConfig.modelName;

  // Fall back to most common model across AI bubbles
  const models = new Map<string, number>();
  for (const bubble of bubbles) {
    if (bubble.type === 2 && bubble.modelInfo?.modelName) {
      const m = bubble.modelInfo.modelName;
      models.set(m, (models.get(m) ?? 0) + 1);
    }
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [m, c] of models) {
    if (c > bestCount) {
      best = m;
      bestCount = c;
    }
  }
  return best;
}

/**
 * Normalize a Cursor timestamp to ISO 8601 string.
 * Handles: number (ms or seconds epoch), string (ISO), null (fallback to now).
 */
function normalizeCursorTimestamp(ts: number | string | null | undefined): string {
  if (ts === null || ts === undefined) return new Date().toISOString();

  if (typeof ts === 'string') {
    return new Date(ts).toISOString();
  }

  // Numeric: if < 1e12, treat as seconds; otherwise milliseconds
  if (ts < 1e12) {
    return new Date(ts * 1000).toISOString();
  }
  return new Date(ts).toISOString();
}

/**
 * Derive a bubble's timestamp, falling back through available sources.
 */
function deriveBubbleTimestamp(bubble: CursorBubble, conv: CursorConversation): string {
  // 1. Try bubble's own createdAt
  if (bubble.createdAt) {
    return normalizeCursorTimestamp(bubble.createdAt as unknown as number | string);
  }

  // 2. Try timingInfo.clientStartTime (epoch ms)
  if (bubble.timingInfo?.clientStartTime) {
    return normalizeCursorTimestamp(bubble.timingInfo.clientStartTime);
  }

  // 3. Fall back to conversation createdAt
  return normalizeCursorTimestamp(conv.createdAt);
}
