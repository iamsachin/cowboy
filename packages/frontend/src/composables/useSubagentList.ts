import { computed, type Ref, type ComputedRef } from 'vue';
import type { ToolCallRow } from '../types';
import { classifyGhostState, type GhostCardState } from '../utils/ghost-card-state';

/**
 * A single sub-agent (Task/Agent) tool call, flattened for chip-strip rendering.
 * Mirrors the derivation rules already in use by SubagentSummaryCard + useTimeline,
 * so that the strip and the inline card never disagree.
 */
export interface SubagentListEntry {
  /** tc.id — matches the `[data-tool-call-id]` attribute on SubagentSummaryCard's wrapper. */
  toolCallId: string;
  ghostState: GhostCardState;
  /**
   * When `ghostState === 'summary'`, mirrors `subagentSummary.status` so chip UI can render
   * success (green check), error/interrupted (red X). Undefined otherwise.
   */
  summaryStatus?: 'success' | 'error' | 'interrupted';
  /**
   * Short label, derived in the same priority order as useTimeline.ts:
   *   1. input.description (string) — used as-is
   *   2. input.prompt.slice(0, 40) + '...' when prompt > 40 chars, else raw prompt
   *   3. 'Subagent' fallback
   */
  description: string;
}

export interface SubagentListAggregate {
  total: number;
  /** summary && status === 'success' */
  success: number;
  /** summary && status === 'error' || 'interrupted' (merged bucket) */
  error: number;
  /** ghostState === 'running' */
  running: number;
  /** ghostState === 'unmatched' */
  unmatched: number;
  /** ghostState === 'missing' */
  missing: number;
}

/** Same predicate as ToolCallRow.vue:79-80 and useTimeline.ts:47 — do NOT change. */
function isSubagentCall(tc: ToolCallRow): boolean {
  return tc.name === 'Task' || tc.name === 'Agent';
}

/**
 * Derive the chip-strip entries + aggregate counts from the tool_calls stream.
 *
 * Pure derivation — no side effects, no fetches, no localStorage. Both outputs are
 * `computed` refs that re-evaluate when either input ref changes, so IMPR-1's
 * tool_call:changed refetch flips chip state without re-mount.
 *
 * @param toolCalls Reactive source of tool_calls. Undefined is treated as empty
 *   (supports the initial loading state of useConversationDetail).
 * @param isActive  Conversation.isActive — passed through to classifyGhostState.
 *   Note: the classifier itself ignores this flag for state selection (see
 *   ghost-card-state.ts:18-25); it is forwarded to preserve the documented contract
 *   and to match how SubagentSummaryCard invokes the classifier.
 */
export function useSubagentList(
  toolCalls: Ref<ToolCallRow[] | undefined>,
  isActive: Ref<boolean>,
): {
  subagents: ComputedRef<SubagentListEntry[]>;
  aggregate: ComputedRef<SubagentListAggregate>;
} {
  const subagents = computed<SubagentListEntry[]>(() => {
    const list = toolCalls.value ?? [];
    const active = isActive.value;
    const entries: SubagentListEntry[] = [];

    for (const tc of list) {
      if (!isSubagentCall(tc)) continue;

      const ghostState = classifyGhostState({
        subagentSummary: tc.subagentSummary,
        subagentLinkAttempted: tc.subagentLinkAttempted,
        subagentConversationId: tc.subagentConversationId,
        isActive: active,
      });

      // description priority mirrors useTimeline.ts:48-54 (ASCII '...' for visual parity)
      const input = tc.input as Record<string, unknown> | null;
      let description = 'Subagent';
      if (input?.description && typeof input.description === 'string') {
        description = input.description;
      } else if (input?.prompt && typeof input.prompt === 'string') {
        description =
          input.prompt.length > 40
            ? input.prompt.slice(0, 40) + '...'
            : input.prompt;
      }

      const entry: SubagentListEntry = {
        toolCallId: tc.id,
        ghostState,
        description,
      };
      if (ghostState === 'summary' && tc.subagentSummary) {
        entry.summaryStatus = tc.subagentSummary.status;
      }

      entries.push(entry);
    }

    return entries;
  });

  const aggregate = computed<SubagentListAggregate>(() => {
    const counts: SubagentListAggregate = {
      total: 0,
      success: 0,
      error: 0,
      running: 0,
      unmatched: 0,
      missing: 0,
    };
    for (const e of subagents.value) {
      counts.total += 1;
      switch (e.ghostState) {
        case 'summary':
          if (e.summaryStatus === 'success') counts.success += 1;
          else counts.error += 1; // error + interrupted merge
          break;
        case 'running':
          counts.running += 1;
          break;
        case 'unmatched':
          counts.unmatched += 1;
          break;
        case 'missing':
          counts.missing += 1;
          break;
      }
    }
    return counts;
  });

  return { subagents, aggregate };
}
