import { ref } from 'vue';
import type { GroupedTurn } from './useGroupedTurns';

export interface TimelineEvent {
  key: string;
  type: 'user' | 'assistant-group' | 'compaction';
  label: string;
  turnIndex: number;
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
      events.push({
        key: turn.message.id,
        type: 'user',
        label: text.length > 30 ? text.slice(0, 30) + '...' : text,
        turnIndex: i,
      });
    } else if (turn.type === 'assistant-group') {
      const model = turn.model || 'Assistant';
      const tools = turn.toolCallCount;
      events.push({
        key: turn.turns[0].message.id,
        type: 'assistant-group',
        label: `${model}${tools > 0 ? ` \u00b7 ${tools} tool${tools === 1 ? '' : 's'}` : ''}`,
        turnIndex: i,
      });
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
