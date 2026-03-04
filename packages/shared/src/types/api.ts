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
