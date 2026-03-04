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
