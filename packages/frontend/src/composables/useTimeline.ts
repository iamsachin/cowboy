import { ref } from 'vue';
import type { GroupedTurn } from './useGroupedTurns';

export interface TimelineEvent {
  key: string;
  type: 'user' | 'assistant-group' | 'compaction' | 'subagent';
  label: string;
  turnIndex: number;
  /** For subagent events: the key of the parent assistant-group */
  parentKey?: string;
  /** For subagent events only: the derived lifecycle status. Undefined for other event types. */
  status?: 'success' | 'error' | 'interrupted' | 'running' | 'unmatched' | 'missing';
  /** For subagent events only: mirrors ToolCallRow.subagentConversationId for downstream consumers. */
  subagentConversationId?: string | null;
  /** For subagent events only: mirrors ToolCallRow.subagentLinkAttempted. */
  subagentLinkAttempted?: boolean;
}

/**
 * Extract timeline-visible events from grouped turns.
 * Only user messages, assistant groups, and compaction events are shown.
 * Pure function -- no Vue reactivity dependency.
 */
export function extractTimelineEvents(turns: GroupedTurn[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];

    if (turn.type === 'user') {
      const text = turn.message.content || '';
      // Skip entries that only contain image source paths (e.g. "[Image: source: /path/to/file.png]")
      if (/^\s*(\[Image: source: [^\]]+\]\s*)+$/.test(text)) continue;
      events.push({
        key: turn.message.id,
        type: 'user',
        label: text.length > 30 ? text.slice(0, 30) + '...' : text,
        turnIndex: i,
      });
    } else if (turn.type === 'assistant-group') {
      const model = turn.model || 'Assistant';
      const tools = turn.toolCallCount;
      const groupKey = turn.turns[0].message.id;
      events.push({
        key: groupKey,
        type: 'assistant-group',
        label: `${model}${tools > 0 ? ` \u00b7 ${tools} tool${tools === 1 ? '' : 's'}` : ''}`,
        turnIndex: i,
      });
      // Add subagent entries for Agent/Task tool calls
      for (const t of turn.turns) {
        for (const tc of t.toolCalls) {
          if (tc.name === 'Agent' || tc.name === 'Task') {
            const input = tc.input as Record<string, unknown> | null;
            let desc = 'Subagent';
            if (input?.description && typeof input.description === 'string') {
              desc = input.description;
            } else if (input?.prompt && typeof input.prompt === 'string') {
              desc = input.prompt.slice(0, 40) + (input.prompt.length > 40 ? '...' : '');
            }
            const summary = tc.subagentSummary;
            const toolCount = summary?.totalToolCalls ?? 0;
            events.push({
              key: tc.id,
              type: 'subagent',
              label: `${desc}${toolCount > 0 ? ` · ${toolCount} tools` : ''}`,
              turnIndex: i,
              parentKey: groupKey,
            });
          }
        }
      }
    } else if (turn.type === 'compaction') {
      const before = turn.tokensBefore ?? 0;
      const after = turn.tokensAfter ?? 0;
      const delta = before - after;
      events.push({
        key: turn.id,
        type: 'compaction',
        label: delta > 0 ? `-${Math.round(delta / 1000)}k tokens` : 'Compaction',
        turnIndex: i,
      });
    }
    // Skip: system-group, slash-command, clear-divider, agent-prompt
  }

  return events;
}

// Module-level singleton state (follows useTokenRate pattern)
const STORAGE_KEY = 'timeline-panel-open';
const isOpen = ref(true); // default open, hydrated on first useTimeline() call
const activeKey = ref<string | null>(null);
let hydrated = false;

export function useTimeline() {
  if (!hydrated) {
    hydrated = true;
    try {
      isOpen.value = localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
      // localStorage unavailable (SSR, restricted context)
    }
  }

  function toggle() {
    isOpen.value = !isOpen.value;
    localStorage.setItem(STORAGE_KEY, String(isOpen.value));
  }

  function setActiveKey(key: string | null) {
    activeKey.value = key;
  }

  return { isOpen, toggle, activeKey, setActiveKey };
}

/** Reset singleton state -- for testing only */
export function _resetTimelineState() {
  hydrated = false;
  isOpen.value = true;
  activeKey.value = null;
}
