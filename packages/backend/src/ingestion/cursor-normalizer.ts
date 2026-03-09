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
  const normalizedToolCalls: NormalizedData['toolCalls'] = [];
  const includedBubbleIds = new Set<string>();
  // Map from individual bubbleId to the merged message's bubbleId (for token usage)
  const bubbleToMergedId = new Map<string, string>();

  // Merge consecutive assistant bubbles into logical turns.
  // For each user message, emit it directly. Then collect all subsequent assistant
  // bubbles until the next user message and merge them into a single rich message.
  let i = 0;
  while (i < bubbles.length) {
    const bubble = bubbles[i];
    const role = bubble.type === 1 ? 'user' : bubble.type === 2 ? 'assistant' : null;
    if (!role) { i++; continue; }

    // User bubbles are emitted directly
    if (role === 'user') {
      includedBubbleIds.add(bubble.bubbleId);
      const messageId = generateId(conversationId, bubble.bubbleId);
      const bubbleTimestamp = deriveBubbleTimestamp(bubble, conv);
      normalizedMessages.push({
        id: messageId,
        conversationId,
        role: 'user',
        content: bubble.text || null,
        thinking: null,
        createdAt: bubbleTimestamp,
        model: null,
      });
      i++;
      continue;
    }

    // Collect consecutive assistant bubbles into a logical turn
    const assistantGroup: CursorBubble[] = [];
    while (i < bubbles.length) {
      const b = bubbles[i];
      const r = b.type === 1 ? 'user' : b.type === 2 ? 'assistant' : null;
      if (r !== 'assistant') break;
      assistantGroup.push(b);
      i++;
    }

    // Merge the assistant group into a single message
    const thinkingSegments: string[] = [];
    const textSegments: string[] = [];
    let toolCount = 0;
    let firstBubble = assistantGroup[0];
    // Collect tool call data from bubbles with toolFormerData
    const pendingToolCalls: Array<{ bubble: CursorBubble }> = [];

    for (const b of assistantGroup) {
      // Extract thinking content
      if (b.thinking?.text?.trim()) {
        thinkingSegments.push(b.thinking.text);
      }

      // Check if this is a tool-only bubble:
      // No text AND no thinking AND has capabilityType or toolFormerData
      const hasText = !!b.text?.trim();
      const hasThinking = !!b.thinking?.text?.trim();
      const isToolOnly = !hasText && !hasThinking &&
        (b.capabilityType !== null || !!b.toolFormerData);

      if (isToolOnly) {
        toolCount++;
        // Collect tool call data if toolFormerData has a name
        if (b.toolFormerData?.name) {
          pendingToolCalls.push({ bubble: b });
        }
      } else if (hasText) {
        textSegments.push(b.text.trim());
      }
      // Thinking-only bubbles (hasThinking but !hasText and !isToolOnly) contribute
      // their thinking but no text content — that's fine
    }

    // Build merged content
    let mergedContent: string | null = null;
    if (textSegments.length > 0) {
      mergedContent = textSegments.join('\n\n');
      if (toolCount > 0) {
        mergedContent = `Executed ${toolCount} tool call${toolCount !== 1 ? 's' : ''}\n\n${mergedContent}`;
      }
    } else if (toolCount > 0) {
      mergedContent = `Executed ${toolCount} tool call${toolCount !== 1 ? 's' : ''}`;
    }

    const mergedThinking = thinkingSegments.length > 0 ? thinkingSegments.join('\n\n') : null;

    // Derive model from first bubble with modelInfo
    const modelBubble = assistantGroup.find(b => b.modelInfo?.modelName) ?? firstBubble;
    const rawModel = modelBubble.modelInfo?.modelName ?? conv.modelConfig?.modelName ?? null;
    const bubbleModel = rawModel === 'default' ? 'unknown' : rawModel;

    const messageId = generateId(conversationId, firstBubble.bubbleId);
    const bubbleTimestamp = deriveBubbleTimestamp(firstBubble, conv);

    // Track all bubble IDs in the group for token usage matching
    for (const b of assistantGroup) {
      includedBubbleIds.add(b.bubbleId);
      bubbleToMergedId.set(b.bubbleId, firstBubble.bubbleId);
    }

    normalizedMessages.push({
      id: messageId,
      conversationId,
      role: 'assistant',
      content: mergedContent,
      thinking: mergedThinking,
      createdAt: bubbleTimestamp,
      model: bubbleModel,
    });

    // Extract tool calls from pending bubbles, now that messageId is known
    for (const { bubble: tb } of pendingToolCalls) {
      const tfd = tb.toolFormerData!;
      normalizedToolCalls.push({
        id: generateId(conversationId, tfd.toolCallId || tb.bubbleId),
        messageId,
        conversationId,
        name: tfd.name!,
        input: safeJsonParse(tfd.params ?? tfd.rawArgs ?? null),
        output: safeJsonParseWithFallback(tfd.result ?? null),
        status: mapToolStatus(tfd.status ?? null),
        duration: null,
        createdAt: deriveBubbleTimestamp(tb, conv),
      });
    }
  }

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
      const mergedBubbleId = bubbleToMergedId.get(bubble.bubbleId) ?? bubble.bubbleId;
      const messageId = generateId(conversationId, mergedBubbleId);
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
      const mergedBubbleId2 = bubbleToMergedId.get(bubble.bubbleId) ?? bubble.bubbleId;
      const messageId = generateId(conversationId, mergedBubbleId2);
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
    compactionEvents: [],
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

/**
 * Safely parse a JSON string, returning null if parsing fails or input is null.
 */
function safeJsonParse(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Safely parse a JSON string, falling back to the raw string if not valid JSON.
 * Returns null if input is null/undefined.
 */
function safeJsonParseWithFallback(value: string | null | undefined): unknown {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value; // Return the raw string as fallback
  }
}

/**
 * Map Cursor toolFormerData.status to normalized status values.
 * "completed" -> "success", "error" -> "error", others pass through, null -> null.
 */
function mapToolStatus(status: string | null): string | null {
  if (status === null) return null;
  if (status === 'completed') return 'success';
  if (status === 'error') return 'error';
  return status;
}
