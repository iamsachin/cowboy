export const AGENT_COLORS = {
  'claude-code': {
    border: 'rgba(56, 189, 248, 0.8)',
    background: 'rgba(56, 189, 248, 0.2)',
    solid: 'rgba(56, 189, 248, 1)',
  },
} as const;

export const AGENT_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
};

export const AGENT_THEME_CLASSES = {
  'claude-code': 'text-primary',
} as const;

export const AGENTS = ['claude-code'] as const;

export type AgentId = (typeof AGENTS)[number];
