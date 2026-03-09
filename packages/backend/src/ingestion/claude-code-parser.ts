import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type {
  ContentBlock,
  ToolUseBlock,
  ToolResultBlock,
  TokenUsageRaw,
} from './types.js';

// ── Result types ────────────────────────────────────────────────────────

export interface ToolResultData {
  toolUseId: string;
  content: string;
  isError: boolean;
}

export interface UserMessageData {
  uuid: string;
  timestamp: string;
  content: string | null;
  toolResults: ToolResultData[];
}

export interface AssistantMessageData {
  firstUuid: string;
  messageId: string;
  timestamp: string;
  model: string;
  contentBlocks: ContentBlock[];
  toolUseBlocks: ToolUseBlock[];
  usage: TokenUsageRaw | null;
  stopReason: string;
}

export interface CompactionEventData {
  uuid: string;
  timestamp: string;
  summary: string | null;
}

export interface ParseResult {
  sessionId: string | null;
  userMessages: UserMessageData[];
  assistantMessages: AssistantMessageData[];
  compactionEvents: CompactionEventData[];
  skippedLines: number;
  timestamps: string[];
}

// ── Internal chunk accumulator ──────────────────────────────────────────

interface ChunkAccumulator {
  firstUuid: string;
  messageId: string;
  earliestTimestamp: string;
  model: string;
  contentBlocks: ContentBlock[];
  toolUseBlocks: ToolUseBlock[];
  finalUsage: TokenUsageRaw | null;
  stopReason: string;
}

// ── Main parser ─────────────────────────────────────────────────────────

/**
 * Parse a Claude Code JSONL file line-by-line using streaming I/O.
 * Reconstructs multi-chunk assistant messages into single messages,
 * extracting token usage from the final chunk only.
 */
export async function parseJsonlFile(filePath: string): Promise<ParseResult> {
  const result: ParseResult = {
    sessionId: null,
    userMessages: [],
    assistantMessages: [],
    compactionEvents: [],
    skippedLines: 0,
    timestamps: [],
  };

  // Map of message.id -> accumulated chunks for assistant reconstruction
  const chunkMap = new Map<string, ChunkAccumulator>();

  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    // Skip empty lines
    if (line.trim() === '') {
      result.skippedLines++;
      continue;
    }

    // Try to parse JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line);
    } catch {
      result.skippedLines++;
      continue;
    }

    const lineType = parsed.type as string | undefined;

    // Skip lines that are not user or assistant
    if (lineType !== 'user' && lineType !== 'assistant') {
      result.skippedLines++;
      continue;
    }

    const uuid = parsed.uuid as string;
    const sessionId = parsed.sessionId as string;
    const timestamp = parsed.timestamp as string;
    const message = parsed.message as {
      role: string;
      content: string | ContentBlock[];
      id?: string;
      model?: string;
      usage?: TokenUsageRaw;
      stop_reason?: string | null;
    } | undefined;

    // Capture sessionId from first line that has it
    if (!result.sessionId && sessionId) {
      result.sessionId = sessionId;
    }

    // Record timestamp
    result.timestamps.push(timestamp);

    if (lineType === 'user') {
      // Detect compaction summary before normal user processing
      if ((parsed as Record<string, unknown>).isCompactSummary === true) {
        const summaryContent = typeof message?.content === 'string'
          ? message.content
          : null;
        result.compactionEvents.push({
          uuid,
          timestamp,
          summary: summaryContent,
        });
      }
      processUserLine(result, uuid, timestamp, message);
    } else if (lineType === 'assistant') {
      processAssistantChunk(chunkMap, uuid, timestamp, message);
    }
  }

  // Reconstruct assistant messages from accumulated chunks
  reconstructAssistantMessages(result, chunkMap);

  return result;
}

// ── User line processing ────────────────────────────────────────────────

function processUserLine(
  result: ParseResult,
  uuid: string,
  timestamp: string,
  message?: {
    role: string;
    content: string | ContentBlock[];
    id?: string;
    model?: string;
    usage?: TokenUsageRaw;
    stop_reason?: string | null;
  },
): void {
  const userData: UserMessageData = {
    uuid,
    timestamp,
    content: null,
    toolResults: [],
  };

  if (message?.content) {
    if (typeof message.content === 'string') {
      userData.content = message.content;
    } else if (Array.isArray(message.content)) {
      // Extract text blocks for content
      const textParts: string[] = [];
      for (const block of message.content) {
        if (block.type === 'text') {
          textParts.push(block.text);
        } else if (block.type === 'tool_result') {
          const tr = block as ToolResultBlock;
          let contentStr: string;
          if (typeof tr.content === 'string') {
            contentStr = tr.content;
          } else if (Array.isArray(tr.content)) {
            contentStr = tr.content
              .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
              .map((b) => b.text)
              .join('');
          } else {
            contentStr = '';
          }
          userData.toolResults.push({
            toolUseId: tr.tool_use_id,
            content: contentStr,
            isError: tr.is_error === true,
          });
        }
      }
      if (textParts.length > 0) {
        userData.content = textParts.join('');
      }
    }
  }

  result.userMessages.push(userData);
}

// ── Assistant chunk processing ──────────────────────────────────────────

function processAssistantChunk(
  chunkMap: Map<string, ChunkAccumulator>,
  uuid: string,
  timestamp: string,
  message?: {
    role: string;
    content: string | ContentBlock[];
    id?: string;
    model?: string;
    usage?: TokenUsageRaw;
    stop_reason?: string | null;
  },
): void {
  if (!message?.id) return;

  const messageId = message.id;
  const model = message.model ?? 'unknown';
  const contentBlocks: ContentBlock[] = [];
  const toolUseBlocks: ToolUseBlock[] = [];

  if (Array.isArray(message.content)) {
    for (const block of message.content) {
      contentBlocks.push(block);
      if (block.type === 'tool_use') {
        toolUseBlocks.push(block as ToolUseBlock);
      }
    }
  }

  let accumulator = chunkMap.get(messageId);
  if (!accumulator) {
    accumulator = {
      firstUuid: uuid,
      messageId,
      earliestTimestamp: timestamp,
      model,
      contentBlocks: [],
      toolUseBlocks: [],
      finalUsage: null,
      stopReason: '',
    };
    chunkMap.set(messageId, accumulator);
  }

  // Each streaming chunk contains the FULL content up to that point (cumulative, not delta).
  // Replace, don't append — the last chunk has the complete content.
  if (contentBlocks.length > 0) {
    accumulator.contentBlocks = contentBlocks;
  }
  if (toolUseBlocks.length > 0) {
    accumulator.toolUseBlocks = toolUseBlocks;
  }

  // Track earliest timestamp
  if (timestamp < accumulator.earliestTimestamp) {
    accumulator.earliestTimestamp = timestamp;
  }

  // Only capture usage from the FINAL chunk (non-null stop_reason)
  if (message.stop_reason != null) {
    accumulator.finalUsage = message.usage ?? null;
    accumulator.stopReason = message.stop_reason;
  }
}

// ── Reconstruction ──────────────────────────────────────────────────────

function reconstructAssistantMessages(
  result: ParseResult,
  chunkMap: Map<string, ChunkAccumulator>,
): void {
  for (const acc of chunkMap.values()) {
    result.assistantMessages.push({
      firstUuid: acc.firstUuid,
      messageId: acc.messageId,
      timestamp: acc.earliestTimestamp,
      model: acc.model,
      contentBlocks: acc.contentBlocks,
      toolUseBlocks: acc.toolUseBlocks,
      usage: acc.finalUsage,
      stopReason: acc.stopReason,
    });
  }
}
