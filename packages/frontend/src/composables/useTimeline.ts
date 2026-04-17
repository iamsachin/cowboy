import { ref } from 'vue';
import type { GroupedTurn } from './useGroupedTurns';
import { classifyGhostState } from '../utils/ghost-card-state';

export interface BatchAggregate {
  total: number;
  success: number;
  error: number;
  running: number;
  unmatched: number;
  missing: number;
}

export interface TimelineEvent {
  key: string;
  type: 'user' | 'assistant-group' | 'compaction' | 'subagent' | 'subagent-batch';
  label: string;
  turnIndex: number;
  /** For subagent / subagent-batch events: the key of the parent assistant-group */
  parentKey?: string;
  /** For subagent events only: the derived lifecycle status. Undefined for other event types. */
  status?: 'success' | 'error' | 'interrupted' | 'running' | 'unmatched' | 'missing';
  /** For subagent events only: mirrors ToolCallRow.subagentConversationId for downstream consumers. */
  subagentConversationId?: string | null;
  /** For subagent events only: mirrors ToolCallRow.subagentLinkAttempted. */
  subagentLinkAttempted?: boolean;
  /** For subagent-batch events only: per-status counts within the batch. */
  batchAggregate?: BatchAggregate;
  /** For subagent-batch events only: tool_call ids of all siblings in source order. */
  batchToolCallIds?: string[];
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
      // Add subagent / subagent-batch entries for Agent/Task tool calls.
      // Contiguous runs of 2+ Task/Agent calls within a single inner turn collapse
      // into a `subagent-batch` event; solo Task/Agent calls remain as `subagent`.
      for (const t of turn.turns) {
        const calls = t.toolCalls;
        let runStart = -1;
        for (let j = 0; j <= calls.length; j++) {
          const tc = j < calls.length ? calls[j] : null;
          const isSub = tc !== null && (tc.name === 'Agent' || tc.name === 'Task');
          if (isSub) {
            if (runStart === -1) runStart = j;
            continue;
          }
          // Non-subagent (or end-of-array): close any open run.
          if (runStart !== -1) {
            const runLen = j - runStart;
            if (runLen >= 2) {
              const siblings = calls.slice(runStart, j);
              const aggregate: BatchAggregate = {
                total: siblings.length,
                success: 0, error: 0, running: 0, unmatched: 0, missing: 0,
              };
              for (const sib of siblings) {
                const sibSummary = sib.subagentSummary;
                if (sibSummary) {
                  // 'success' / 'error' / 'interrupted' — interrupted merges into error
                  // (matches useSubagentList convention).
                  if (sibSummary.status === 'success') aggregate.success += 1;
                  else aggregate.error += 1;
                } else {
                  const ghost = classifyGhostState({
                    subagentSummary: null,
                    subagentLinkAttempted: sib.subagentLinkAttempted,
                    subagentConversationId: sib.subagentConversationId ?? null,
                    isActive: false,
                  });
                  if (ghost === 'unmatched') aggregate.unmatched += 1;
                  else if (ghost === 'missing') aggregate.missing += 1;
                  else aggregate.running += 1;
                }
              }
              const labelParts: string[] = [];
              if (aggregate.success > 0) labelParts.push(`${aggregate.success}\u2713`);
              if (aggregate.error > 0) labelParts.push(`${aggregate.error}\u2717`);
              if (aggregate.running > 0) labelParts.push(`${aggregate.running}\u27F3`);
              if (aggregate.unmatched > 0) labelParts.push(`${aggregate.unmatched}?`);
              if (aggregate.missing > 0) labelParts.push(`${aggregate.missing}\u26A0`);
              const label = `${siblings.length} sub-agents \u00b7 ${labelParts.join(' ')}`;
              events.push({
                key: siblings[0].id,
                type: 'subagent-batch',
                label,
                turnIndex: i,
                parentKey: groupKey,
                batchAggregate: aggregate,
                batchToolCallIds: siblings.map(s => s.id),
              });
            } else {
              // runLen === 1 — emit solo subagent event (existing logic).
              const tcSolo = calls[runStart];
              const input = tcSolo.input as Record<string, unknown> | null;
              let desc = 'Subagent';
              if (input?.description && typeof input.description === 'string') {
                desc = input.description;
              } else if (input?.prompt && typeof input.prompt === 'string') {
                desc = input.prompt.slice(0, 40) + (input.prompt.length > 40 ? '...' : '');
              }
              const summary = tcSolo.subagentSummary;
              const toolCount = summary?.totalToolCalls ?? 0;
              let status: TimelineEvent['status'];
              if (summary) {
                status = summary.status;
              } else {
                const ghost = classifyGhostState({
                  subagentSummary: null,
                  subagentLinkAttempted: tcSolo.subagentLinkAttempted,
                  subagentConversationId: tcSolo.subagentConversationId ?? null,
                  isActive: false,
                });
                status = ghost === 'summary' ? undefined : ghost;
              }
              events.push({
                key: tcSolo.id,
                type: 'subagent',
                label: `${desc}${toolCount > 0 ? ` \u00b7 ${toolCount} tools` : ''}`,
                turnIndex: i,
                parentKey: groupKey,
                status,
                subagentConversationId: tcSolo.subagentConversationId ?? null,
                subagentLinkAttempted: tcSolo.subagentLinkAttempted,
              });
            }
            runStart = -1;
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
