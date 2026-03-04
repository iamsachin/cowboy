export const AGENT_COLORS = {
  'claude-code': {
    border: 'rgba(56, 189, 248, 0.8)',
    background: 'rgba(56, 189, 248, 0.2)',
    solid: 'rgba(56, 189, 248, 1)',
  },
  'cursor': {
    border: 'rgba(168, 85, 247, 0.8)',
    background: 'rgba(168, 85, 247, 0.2)',
    solid: 'rgba(168, 85, 247, 1)',
  },
} as const;

export const AGENT_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  'cursor': 'Cursor',
};

export const AGENTS = ['claude-code', 'cursor'] as const;

export type AgentId = (typeof AGENTS)[number];
