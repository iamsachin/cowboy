import { generateId } from './id-generator.js';
import { shouldSkipForTitle } from './title-utils.js';
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
  const includedBubbleIds = new Set<string>();

  // Group consecutive tool-only assistant bubbles and emit summary messages
  let i = 0;
  while (i < bubbles.length) {
    const bubble = bubbles[i];
    const role = bubble.type === 1 ? 'user' : bubble.type === 2 ? 'assistant' : null;
    if (!role) { i++; continue; }

    // Check if this is a tool-only assistant bubble (no text, has capability/tool flags)
    const isToolOnly = role === 'assistant' && !bubble.text?.trim() &&
        (bubble.isCapabilityIteration || bubble.toolFormerData);

    if (isToolOnly) {
      // Collect consecutive tool-only bubbles into a group
      let toolCount = 0;
      const firstToolBubble = bubble;
      while (i < bubbles.length) {
        const b = bubbles[i];
        const r = b.type === 1 ? 'user' : b.type === 2 ? 'assistant' : null;
        if (r === 'assistant' && !b.text?.trim() && (b.isCapabilityIteration || b.toolFormerData)) {
          toolCount++;
          i++;
        } else {
          break;
        }
      }

      // Emit a single summary message for the group
      const summaryContent = `Executed ${toolCount} tool call${toolCount !== 1 ? 's' : ''}`;
      const messageId = generateId(conversationId, firstToolBubble.bubbleId);
      const bubbleTimestamp = deriveBubbleTimestamp(firstToolBubble, conv);
      const rawModel = firstToolBubble.modelInfo?.modelName ?? conv.modelConfig?.modelName ?? null;
      const bubbleModel = rawModel === 'default' ? 'unknown' : rawModel;

      includedBubbleIds.add(firstToolBubble.bubbleId);
      normalizedMessages.push({
        id: messageId,
        conversationId,
        role: 'assistant',
        content: summaryContent,
        thinking: null,
        createdAt: bubbleTimestamp,
        model: bubbleModel,
      });
      continue;
    }

    includedBubbleIds.add(bubble.bubbleId);

    const messageId = generateId(conversationId, bubble.bubbleId);
    const bubbleTimestamp = deriveBubbleTimestamp(bubble, conv);
    const rawModel = bubble.modelInfo?.modelName ?? conv.modelConfig?.modelName ?? null;
    const bubbleModel = role === 'assistant'
      ? (rawModel === 'default' ? 'unknown' : rawModel)
      : null;

    normalizedMessages.push({
      id: messageId,
      conversationId,
      role,
      content: bubble.text || null,
      thinking: null,
      createdAt: bubbleTimestamp,
      model: bubbleModel,
    });
    i++;
  }

  // ── Tool calls ────────────────────────────────────────────────────────
  // Cursor's toolFormerData is inconsistent; extract what we can
  const normalizedToolCalls: NormalizedData['toolCalls'] = [];

  // ── Token usage ────────────────────────────────────────────────────────

  const normalizedTokenUsage: NormalizedData['tokenUsage'] = [];
  let prevCumulativeTokens = 0;

  for (const bubble of bubbles) {
    if (bubble.type !== 2) continue; // Only assistant bubbles have token usage

    // Track cumulative tokens even for filtered bubbles (needed for differential calc)
    const hasMessage = includedBubbleIds.has(bubble.bubbleId);

    const inputTokens = bubble.tokenCount?.inputTokens ?? 0;
    const outputTokens = bubble.tokenCount?.outputTokens ?? 0;

    // Only record if there are actual token counts and the bubble has a corresponding message
    if ((inputTokens > 0 || outputTokens > 0) && hasMessage) {
      const messageId = generateId(conversationId, bubble.bubbleId);
      const rawTokenModel = bubble.modelInfo?.modelName ?? conv.modelConfig?.modelName ?? 'unknown';
      const bubbleModel = rawTokenModel === 'default' ? 'unknown' : rawTokenModel;
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
    } else if (bubble.tokenCountUpUntilHere && bubble.tokenCountUpUntilHere > prevCumulativeTokens && hasMessage) {
      // Use differential of cumulative token count as output token estimate
      const estimatedOutputTokens = bubble.tokenCountUpUntilHere - prevCumulativeTokens;
      const messageId = generateId(conversationId, bubble.bubbleId);
      const rawTokenModel = bubble.modelInfo?.modelName ?? conv.modelConfig?.modelName ?? 'unknown';
      const bubbleModel = rawTokenModel === 'default' ? 'unknown' : rawTokenModel;
      const bubbleTimestamp = deriveBubbleTimestamp(bubble, conv);

      normalizedTokenUsage.push({
        id: generateId(conversationId, `token-${bubble.bubbleId}`),
        conversationId,
        messageId,
        model: bubbleModel,
        inputTokens: 0,  // Cannot distinguish input vs output from cumulative
        outputTokens: estimatedOutputTokens,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        createdAt: bubbleTimestamp,
      });
    }

    // Always update cumulative tracker (even for filtered bubbles)
    if (bubble.tokenCountUpUntilHere) {
      prevCumulativeTokens = bubble.tokenCountUpUntilHere;
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

function stripXmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function deriveTitle(bubbles: CursorBubble[]): string | null {
  // First pass: skip user bubbles matching skip patterns (XML, caveats, slash commands, etc.)
  for (const bubble of bubbles) {
    if (bubble.type === 1 && bubble.text && bubble.text.trim().length > 0) {
      if (shouldSkipForTitle(bubble.text)) continue;
      return bubble.text.length > 100 ? bubble.text.substring(0, 100) : bubble.text;
    }
  }

  // Second pass: strip XML tags from XML user bubbles and use first with >10 chars
  for (const bubble of bubbles) {
    if (bubble.type === 1 && bubble.text && bubble.text.trim().startsWith('<')) {
      const stripped = stripXmlTags(bubble.text);
      if (stripped.length > 10) {
        return stripped.length > 100 ? stripped.substring(0, 100) : stripped;
      }
    }
  }

  // Third pass: fall back to first assistant bubble with text
  for (const bubble of bubbles) {
    if (bubble.type === 2 && bubble.text && bubble.text.trim().length > 0) {
      return bubble.text.length > 100 ? bubble.text.substring(0, 100) : bubble.text;
    }
  }

  return null;
}

function deriveModel(conv: CursorConversation, bubbles: CursorBubble[]): string | null {
  // Try modelConfig first, but skip if it's "default"
  if (conv.modelConfig?.modelName && conv.modelConfig.modelName !== 'default') {
    return conv.modelConfig.modelName;
  }

  // Fall back to most common model across AI bubbles (skip "default")
  const models = new Map<string, number>();
  for (const bubble of bubbles) {
    if (bubble.type === 2 && bubble.modelInfo?.modelName && bubble.modelInfo.modelName !== 'default') {
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

  // If no real model found and we had a "default" config, return "unknown"
  if (best === null && conv.modelConfig?.modelName === 'default') {
    return 'unknown';
  }

  return best;
}

/**
 * Normalize a Cursor timestamp to ISO 8601 string.
 * Handles: number (ms or seconds epoch), string (ISO), null (fallback to now).
 */
function normalizeCursorTimestamp(ts: number | string | null | undefined): string {
  if (ts === null || ts === undefined || ts === 0) return new Date().toISOString();

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
