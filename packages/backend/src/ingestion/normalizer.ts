import { generateId } from './id-generator.js';
import { deriveProjectName } from './file-discovery.js';
import { shouldSkipForTitle } from './title-utils.js';
import type { ContentBlock, ToolUseBlock } from './types.js';
import type {
  ParseResult,
  AssistantMessageData,
  ToolResultData,
} from './claude-code-parser.js';

// ── Output types ────────────────────────────────────────────────────────

export interface NormalizedData {
  conversation: {
    id: string;
    agent: string;
    project: string | null;
    title: string | null;
    createdAt: string;
    updatedAt: string;
    model: string | null;
  };
  messages: Array<{
    id: string;
    conversationId: string;
    role: string;
    content: string | null;
    thinking: string | null;
    createdAt: string;
    model: string | null;
  }>;
  toolCalls: Array<{
    id: string;
    messageId: string;
    conversationId: string;
    name: string;
    input: unknown;
    output: unknown;
    status: string | null;
    duration: number | null;
    createdAt: string;
  }>;
  tokenUsage: Array<{
    id: string;
    conversationId: string;
    messageId: string | null;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    createdAt: string;
  }>;
}

// ── Main normalizer ─────────────────────────────────────────────────────

/**
 * Map parsed JSONL data into unified schema records ready for database insertion.
 * Returns null if there are no messages to normalize (empty file).
 *
 * Records are returned in insertion order for foreign key compliance:
 * conversation -> messages -> toolCalls -> tokenUsage
 */
export function normalizeConversation(
  parseResult: ParseResult,
  projectDir: string,
): NormalizedData | null {
  // Empty files produce no conversation
  if (
    parseResult.userMessages.length === 0 &&
    parseResult.assistantMessages.length === 0
  ) {
    return null;
  }

  // ── Conversation record ─────────────────────────────────────────────

  const conversationId = generateId('claude-code', parseResult.sessionId ?? '');
  const project = deriveProjectName(projectDir);

  // Title: first non-empty user message content, truncated to 100 chars
  const title = deriveTitle(parseResult);

  // Timestamps: earliest and latest across all messages
  const sortedTimestamps = [...parseResult.timestamps].sort();
  const createdAt = sortedTimestamps[0];
  const updatedAt = sortedTimestamps[sortedTimestamps.length - 1];

  // Model: computed after tokenUsage is built (see below)
  // Placeholder — will be set after tokenUsage array
  let model: string | null = null;

  const conversation = {
    id: conversationId,
    agent: 'claude-code',
    project,
    title,
    createdAt,
    updatedAt,
    model,
  };

  // ── Message records ─────────────────────────────────────────────────

  const messages: NormalizedData['messages'] = [];

  // Build a lookup of toolUseId -> ToolResultData for tool result matching
  const toolResultLookup = buildToolResultLookup(parseResult);

  // User messages
  for (const user of parseResult.userMessages) {
    messages.push({
      id: generateId(conversationId, user.uuid),
      conversationId,
      role: 'user',
      content: user.content,
      thinking: null,
      createdAt: user.timestamp,
      model: null,
    });
  }

  // Assistant messages
  for (const assistant of parseResult.assistantMessages) {
    const { content, thinking } = extractAssistantContent(assistant.contentBlocks);
    messages.push({
      id: generateId(conversationId, assistant.firstUuid),
      conversationId,
      role: 'assistant',
      content,
      thinking,
      createdAt: assistant.timestamp,
      model: assistant.model,
    });
  }

  // ── Tool call records ───────────────────────────────────────────────

  const toolCalls: NormalizedData['toolCalls'] = [];

  for (const assistant of parseResult.assistantMessages) {
    const assistantMessageId = generateId(conversationId, assistant.firstUuid);

    for (const toolUse of assistant.toolUseBlocks) {
      const result = toolResultLookup.get(toolUse.id);
      toolCalls.push({
        id: generateId(conversationId, toolUse.id),
        messageId: assistantMessageId,
        conversationId,
        name: toolUse.name,
        input: toolUse.input,
        output: result?.content ?? null,
        status: result ? (result.isError ? 'error' : 'success') : null,
        duration: null,
        createdAt: assistant.timestamp,
      });
    }
  }

  // ── Token usage records ─────────────────────────────────────────────

  const tokenUsage: NormalizedData['tokenUsage'] = [];

  for (const assistant of parseResult.assistantMessages) {
    if (!assistant.usage) continue;

    const assistantMessageId = generateId(conversationId, assistant.firstUuid);
    tokenUsage.push({
      id: generateId(conversationId, assistant.messageId),
      conversationId,
      messageId: assistantMessageId,
      model: assistant.model,
      inputTokens: assistant.usage.input_tokens,
      outputTokens: assistant.usage.output_tokens,
      cacheReadTokens: assistant.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: assistant.usage.cache_creation_input_tokens ?? 0,
      createdAt: assistant.timestamp,
    });
  }

  // Model: most frequent model from assistant messages, with token_usage fallback
  model = deriveMostCommonModel(parseResult.assistantMessages)
    ?? deriveMostCommonModelFromTokenUsage(tokenUsage);
  conversation.model = model;

  return { conversation, messages, toolCalls, tokenUsage };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function stripXmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function deriveTitle(parseResult: ParseResult): string | null {
  // First pass: skip any user message matching skip patterns (XML, caveats, slash commands, etc.)
  for (const user of parseResult.userMessages) {
    if (user.content && user.content.trim().length > 0) {
      if (shouldSkipForTitle(user.content)) continue;
      return user.content.length > 100
        ? user.content.substring(0, 100)
        : user.content;
    }
  }

  // Second pass: strip XML tags from XML messages and use first with >10 chars of cleaned text
  for (const user of parseResult.userMessages) {
    if (user.content && user.content.trim().startsWith('<')) {
      const stripped = stripXmlTags(user.content);
      if (stripped.length > 10) {
        return stripped.length > 100
          ? stripped.substring(0, 100)
          : stripped;
      }
    }
  }

  // Third pass: fall back to first assistant message text content
  for (const assistant of parseResult.assistantMessages) {
    const { content } = extractAssistantContent(assistant.contentBlocks);
    if (content && content.trim().length > 0) {
      return content.length > 100
        ? content.substring(0, 100)
        : content;
    }
  }

  return null;
}

function deriveMostCommonModel(
  assistantMessages: AssistantMessageData[],
): string | null {
  if (assistantMessages.length === 0) return null;

  const counts = new Map<string, number>();
  for (const msg of assistantMessages) {
    counts.set(msg.model, (counts.get(msg.model) ?? 0) + 1);
  }

  let maxModel: string | null = null;
  let maxCount = 0;
  for (const [model, count] of counts) {
    if (count > maxCount) {
      maxModel = model;
      maxCount = count;
    }
  }
  return maxModel;
}

function deriveMostCommonModelFromTokenUsage(
  tokenUsage: NormalizedData['tokenUsage'],
): string | null {
  if (tokenUsage.length === 0) return null;

  const counts = new Map<string, number>();
  for (const tu of tokenUsage) {
    if (tu.model) {
      counts.set(tu.model, (counts.get(tu.model) ?? 0) + 1);
    }
  }

  let maxModel: string | null = null;
  let maxCount = 0;
  for (const [model, count] of counts) {
    if (count > maxCount) {
      maxModel = model;
      maxCount = count;
    }
  }
  return maxModel;
}

function buildToolResultLookup(
  parseResult: ParseResult,
): Map<string, ToolResultData> {
  const lookup = new Map<string, ToolResultData>();
  for (const user of parseResult.userMessages) {
    for (const tr of user.toolResults) {
      lookup.set(tr.toolUseId, tr);
    }
  }
  return lookup;
}

function extractAssistantContent(blocks: ContentBlock[]): { content: string | null; thinking: string | null } {
  // Separate text blocks from thinking blocks.
  // Consecutive text blocks are concatenated without separator (streaming chunks).
  // Thinking blocks are joined with newlines.
  const textSegments: string[] = [];
  const thinkingSegments: string[] = [];
  let currentText = '';

  for (const block of blocks) {
    if (block.type === 'text') {
      currentText += block.text;
    } else if (block.type === 'thinking') {
      if (currentText) {
        textSegments.push(currentText);
        currentText = '';
      }
      thinkingSegments.push(block.thinking);
    } else {
      // Non-text, non-thinking blocks (tool_use, tool_result) -- skip for content
      if (currentText) {
        textSegments.push(currentText);
        currentText = '';
      }
    }
  }

  if (currentText) {
    textSegments.push(currentText);
  }

  return {
    content: textSegments.length > 0 ? textSegments.join('\n') : null,
    thinking: thinkingSegments.length > 0 ? thinkingSegments.join('\n') : null,
  };
}
