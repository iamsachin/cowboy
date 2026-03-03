export interface Conversation {
  id: string;
  agent: string;
  project: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  model: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  role: string;
  content: string | null;
  createdAt: string;
  model: string | null;
}

export interface ToolCall {
  id: string;
  messageId: string;
  conversationId: string;
  name: string;
  input: unknown;
  output: unknown;
  status: string | null;
  duration: number | null;
  createdAt: string;
}

export interface TokenUsage {
  id: string;
  conversationId: string;
  messageId: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  createdAt: string;
}
