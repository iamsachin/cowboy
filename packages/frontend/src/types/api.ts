// ── Subagent Types ──────────────────────────────────────────────────

export interface SubagentSummary {
  toolBreakdown: Record<string, number>;
  filesTouched: string[];
  totalToolCalls: number;
  status: 'success' | 'error' | 'interrupted';
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  lastError: string | null;
  matchConfidence: 'high' | 'medium' | 'low';
}

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  database: 'connected' | 'disconnected' | 'error';
}

export interface OverviewStats {
  totalTokens: number;
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCacheCreation: number;
  estimatedCost: number;
  totalSavings: number;
  conversationCount: number;
  activeDays: number;
  trends: {
    tokensTrend: number | null;
    costTrend: number | null;
    conversationsTrend: number | null;
    activeDaysTrend: number | null;
  };
}

export interface TimeSeriesPoint {
  period: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cost: number;
  conversationCount: number;
}

export interface ConversationRow {
  id: string;
  date: string;
  agent: string;
  title: string | null;
  project: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cost: number | null;
  savings: number | null;
  isActive?: boolean;
  hasCompaction?: boolean;
  parentConversationId?: string | null;
  parentTitle?: string | null;
  children?: ConversationRow[];
}

export interface ConversationListResponse {
  rows: ConversationRow[];
  total: number;
  page: number;
  limit: number;
}

export interface MessageRow {
  id: string;
  role: string;
  content: string | null;
  thinking: string | null;
  createdAt: string;
  model: string | null;
}

export interface ToolCallRow {
  id: string;
  messageId: string;
  name: string;
  input: unknown;
  output: unknown;
  status: string | null;
  duration: number | null;
  createdAt: string;
  subagentConversationId?: string | null;
  subagentSummary?: SubagentSummary | null;
}

export interface MessageTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cost: number | null;
}

export interface CompactionEvent {
  id: string;
  timestamp: string;
  summary: string | null;
  tokensBefore: number | null;
  tokensAfter: number | null;
}

export interface ConversationDetailResponse {
  conversation: {
    id: string;
    agent: string;
    project: string | null;
    title: string | null;
    createdAt: string;
    updatedAt: string;
    model: string | null;
    firstMessageAt?: string;
    lastMessageAt?: string;
    parentConversationId?: string | null;
    parentTitle?: string | null;
    isActive?: boolean;
  };
  messages: MessageRow[];
  toolCalls: ToolCallRow[];
  tokenSummary: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    cost: number | null;
    savings: number | null;
  };
  tokenUsageByMessage: Record<string, MessageTokenUsage>;
  compactionEvents?: CompactionEvent[];
}

export interface ModelDistributionEntry {
  model: string;
  count: number;
  totalTokens: number;
}

export interface SearchConversationRow extends ConversationRow {
  snippet: string | null;
}

export interface SearchConversationListResponse {
  rows: SearchConversationRow[];
  total: number;
  page: number;
  limit: number;
  query: string;
}

export interface ToolStatsRow {
  name: string;
  total: number;
  success: number;
  failure: number;
  unknown: number;
  rejected: number;
  avgDuration: number | null;
  p95Duration: number | null;
}
export type ToolStatsResponse = ToolStatsRow[];

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface ProjectModelEntry {
  model: string;
  count: number;
}

export interface ProjectStatsRow {
  project: string;
  conversationCount: number;
  lastActive: string;
  totalTokens: number;
  totalCost: number;
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCacheCreation: number;
  topModels: ProjectModelEntry[];
}

// ── Token Rate Types ────────────────────────────────────────────────

export interface TokenRatePoint {
  minute: string;        // e.g. "2026-03-10T14:23"
  inputTokens: number;
  outputTokens: number;
}

