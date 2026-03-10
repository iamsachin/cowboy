// JSONL Line Types
// Based on verified analysis of Claude Code JSONL format

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

export interface TokenUsageRaw {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface ParsedLine {
  type:
    | 'user'
    | 'assistant'
    | 'system'
    | 'progress'
    | 'file-history-snapshot'
    | 'queue-operation'
    | 'pr-link';
  uuid: string;
  sessionId: string;
  timestamp: string;
  message?: {
    role: string;
    content: string | ContentBlock[];
    id?: string;
    model?: string;
    usage?: TokenUsageRaw;
    stop_reason?: string | null;
  };
}

export interface AssistantChunk {
  uuid: string;
  timestamp: string;
  messageId: string;
  contentBlock: ContentBlock;
  stopReason: string | null;
  usage: TokenUsageRaw | null;
  model: string;
}

export interface DiscoveredFile {
  filePath: string;
  projectDir: string;
  isSubagent: boolean;
  sessionId: string;
}

export interface IngestionStats {
  filesScanned: number;
  filesSkipped: number;
  conversationsFound: number;
  messagesParsed: number;
  toolCallsExtracted: number;
  tokensRecorded: number;
  skippedLines: number;
  duration: number;
}

export interface IngestionStatus {
  running: boolean;
  progress: { filesProcessed: number; totalFiles: number } | null;
  lastRun: { completedAt: string; stats: IngestionStats } | null;
}
