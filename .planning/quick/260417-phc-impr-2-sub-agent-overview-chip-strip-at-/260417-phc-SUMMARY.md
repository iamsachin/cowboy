---
phase: quick-260417-phc
plan: 01
subsystem: frontend-rendering
tags: [subagent, overview-strip, discovery, impr-2, frontend-only, tdd]
requires:
  - packages/frontend/src/utils/ghost-card-state.ts (classifyGhostState from IMPR-7)
  - packages/frontend/src/types/api.ts (ToolCallRow, SubagentSummary)
  - packages/frontend/src/pages/ConversationDetailPage.vue handleTimelineNavigate (pagination + group expand + scrollIntoView)
provides:
  - useSubagentList composable (pure derivation over tool_calls stream)
  - SubagentListEntry / SubagentListAggregate interfaces
  - SubagentOverviewStrip.vue presentational chip component
  - conversation-level sub-agent visibility + one-click jump-to-card
affects:
  - packages/frontend/src/pages/ConversationDetailPage.vue (new import, composable invocation, template slot, jump handler)
tech-stack:
  added: []
  patterns:
    - "Pure composable returning ComputedRef pair (subagents + aggregate)"
    - "Presentational component: props in, events out, self-hides on empty"
    - "Chip -> [data-tool-call-id] scroll via existing handleTimelineNavigate"
key-files:
  created:
    - packages/frontend/src/composables/useSubagentList.ts
    - packages/frontend/tests/composables/useSubagentList.test.ts
    - packages/frontend/src/components/SubagentOverviewStrip.vue
  modified:
    - packages/frontend/src/pages/ConversationDetailPage.vue
decisions:
  - "Interrupted merges into the error bucket (single red chip color) — matches SubagentSummaryCard.isError."
  - "Aggregate header hides zero-count buckets to keep the strip terse."
  - "handleSubagentJump reuses handleTimelineNavigate verbatim instead of duplicating pagination/expand/scroll logic."
  - "Description truncated to max-w-[16ch] with native title tooltip; ASCII '...' matches useTimeline.ts."
metrics:
  duration: "~15 minutes"
  completed: 2026-04-17
---

# Quick 260417-phc: IMPR-2 Sub-agent Overview Chip Strip Summary

One-liner: Added a chip-strip above the conversation timeline that aggregates
sub-agent Task/Agent tool calls with per-chip status + one-click jump to the
matching SubagentSummaryCard, built on a pure `useSubagentList` composable
that reuses `classifyGhostState` from IMPR-7.

## Commits

| # | Type | Hash     | Message                                                                      |
|---|------|----------|------------------------------------------------------------------------------|
| 1 | test | 79ee029  | test(quick-260417-phc): add failing vitest for useSubagentList (RED)         |
| 2 | feat | 1fcd81e  | feat(quick-260417-phc): implement useSubagentList composable (GREEN)         |
| 3 | feat | 4eaf606  | feat(quick-260417-phc): add SubagentOverviewStrip presentational component   |
| 4 | feat | f528f8e  | feat(quick-260417-phc): wire SubagentOverviewStrip into ConversationDetailPage |

## Artifacts

### packages/frontend/src/composables/useSubagentList.ts (GREEN — 141 lines)

Pure derivation composable. Inputs: `Ref<ToolCallRow[] | undefined>` and
`Ref<boolean>`. Outputs: `{ subagents: ComputedRef<SubagentListEntry[]>,
aggregate: ComputedRef<SubagentListAggregate> }`.

- Filter predicate copied verbatim from `ToolCallRow.vue:79-80` and
  `useTimeline.ts:47`: `tc.name === 'Task' || tc.name === 'Agent'`.
- `ghostState` delegates to `classifyGhostState` from
  `utils/ghost-card-state.ts` (IMPR-7 single source of truth).
- `summaryStatus` is populated only when `ghostState === 'summary'`.
- `description` priority mirrors `useTimeline.ts:48-54`: `input.description`
  (string) > `input.prompt.slice(0,40) + '...'` when >40 chars > raw prompt
  (≤40) > `'Subagent'`. ASCII three-dot ellipsis for visual parity with the
  timeline sidebar.
- Aggregate bucket semantics: `interrupted` merges into `error` (same as
  `SubagentSummaryCard.isError`). Running / unmatched / missing each get their
  own counter.

### packages/frontend/tests/composables/useSubagentList.test.ts (RED — 12 cases)

All 12 cases pass GREEN after the composable lands. Coverage:

1. Empty array → empty list, zero aggregate.
2. Undefined ref → treated as empty (loading state).
3. Non-Task/Agent entries filtered out.
4. Task + `status='success'` → ghostState=summary, summaryStatus=success.
5. Task + `status='error'` → summaryStatus=error, aggregate.error=1.
6. Agent + `status='interrupted'` → aggregate.error=1 (merged).
7. Running: no summary/link/flag → ghostState=running, summaryStatus undefined.
8. Unmatched: flag true, no summary/link → ghostState=unmatched.
9. Missing: link present, no summary → ghostState=missing.
10. Description priority: 6 sub-cases including 40-char boundary (no ellipsis)
    and 41-char truncation (ASCII '...').
11. Mixed bag: 2 success + 1 error + 1 running + 1 Read-excluded → total=4.
12. Reactivity: mutating `toolCalls.value` updates the computed without
    subscribing anything new (`nextTick` confirms flush).

### packages/frontend/src/components/SubagentOverviewStrip.vue (125 lines)

Stateless presentational. Props: `subagents` + `aggregate` (both from the
parent's `useSubagentList`). Emit: `jump-to` with the `toolCallId`.

- Self-hides when `subagents.length === 0` (defense in depth; the parent is
  also guarded by `v-else-if="data"`).
- Root: `flex items-center gap-2 flex-wrap mb-4` — wraps cleanly for swarm
  conversations (T-phc-03 DoS mitigation).
- Aggregate header shows `{N} sub-agent(s)` plus coloured counters for only
  the non-zero buckets; each counter uses the same icon as the matching chip
  for instant visual correspondence.
- Chip buttons use `badge badge-sm`, `type="button"`, keyboard focus ring, and
  a native `title` attribute carrying the full description (truncation at
  `max-w-[16ch]`).
- `aria-label` per chip: `Jump to sub-agent: {description} ({ghostState}
  {summaryStatus})`.

| ghostState + status     | Badge class     | Icon          | Spin |
|-------------------------|-----------------|---------------|------|
| summary + success       | `badge-success` | CheckCircle2  | no   |
| summary + error         | `badge-error`   | XCircle       | no   |
| summary + interrupted   | `badge-error`   | XCircle       | no   |
| running                 | `badge-info`    | Loader2       | yes  |
| unmatched               | `badge-ghost`   | HelpCircle    | no   |
| missing                 | `badge-warning` | AlertTriangle | no   |

### packages/frontend/src/pages/ConversationDetailPage.vue (+36 lines)

Three wiring edits, no refactor of existing code:

1. New imports next to `ConversationDetail` / `ConversationTimeline`:
   `SubagentOverviewStrip` + `useSubagentList`.
2. `toolCallsRef` + `isActiveRef` computed refs + destructure
   `{ subagents: subagentList, aggregate: subagentAggregate }` right after
   `useConversationDetail(id)`.
3. Template insertion between the metadata header `</div>` and
   `<ConversationDetail>`.
4. `handleSubagentJump(toolCallId)` added after `handleTimelineNavigate`;
   it looks up the matching timeline event and delegates to
   `handleTimelineNavigate(evt.key, evt.turnIndex, evt.parentKey)` so that
   pagination, group expansion, scroll, and the navigating-flag bookkeeping
   are identical to the timeline sidebar. Falls back to a direct
   `scrollContainer.querySelector([data-tool-call-id="${id}"])` scroll if the
   timeline event is not yet materialized (rare edge case: user clicks
   before `detailRef` attaches).

`handleTimelineNavigate`, the IntersectionObserver setup, and every other
existing handler are UNCHANGED.

## Verification

| Check | Command | Result |
|-------|---------|--------|
| Type check | `cd packages/frontend && npx vue-tsc --noEmit` | zero errors (unchanged vs baseline) |
| Focused test | `npx vitest run tests/composables/useSubagentList.test.ts` | 12/12 pass |
| Full suite | `npx vitest run` | 284 passed, 4 failed (same 4 pre-existing failures as 260417-ok0 baseline; zero NEW failures) |
| Reuse — classifier | `grep -c 'classifyGhostState' src/composables/useSubagentList.ts` | 3 (import + call + type) |
| Reuse — filter | `grep -c "name === 'Task'" src/composables/useSubagentList.ts` | 1 |
| Integration | `grep -c 'SubagentOverviewStrip' src/pages/ConversationDetailPage.vue` | 2 (import + template) |
| Scope | `git diff --name-only 6ea23f8..HEAD` | 4 files, all under `packages/frontend/` |
| Backend scope | files under `src-tauri/` | 0 changes |

### Pre-existing failures (inherited, not introduced)

Same set documented in 260417-ok0 SUMMARY:

- `tests/app.test.ts > Router Configuration > has exactly 9 named routes plus the redirect`
- `tests/composables/useCommandPalette.test.ts > returns all 6 pages and conversations when query is empty`
- `tests/composables/useCommandPalette.test.ts > select navigates to conversation`
- `tests/composables/useConversationDetail.test.ts > debounces conversation:changed events by 500ms`

Verified via baseline run on the `6ea23f8` commit; unchanged after this plan.

## Deviations from Plan

None — plan executed exactly as written. The interface contract, filter
predicate, classifier call, description priority, and scroll-reuse decision
all match the plan to the letter.

One optional note: the plan mentioned `CheckCircle` in the icon list; the
codebase consistently uses `CheckCircle2` (see `SubagentSummaryCard.vue:211`),
so `CheckCircle2` was chosen for visual consistency. This is not a deviation
from the plan's intent (a check-mark success icon), just the correct Lucide
name already in use.

## Deferred Items

None.

## Threat Flags

No new security-relevant surface introduced. The jump handler uses the same
`[data-tool-call-id]` CSS attribute selector pattern already present at
`ConversationDetailPage.vue:313` (hex DB IDs — not attacker-controlled).
No network endpoints added, no schema changes, no new trust boundaries.

## Self-Check

- `packages/frontend/src/composables/useSubagentList.ts` — FOUND
- `packages/frontend/tests/composables/useSubagentList.test.ts` — FOUND
- `packages/frontend/src/components/SubagentOverviewStrip.vue` — FOUND
- `packages/frontend/src/pages/ConversationDetailPage.vue` edits — FOUND (38,178,130 lines pattern)
- Commit 79ee029 (RED test) — FOUND
- Commit 1fcd81e (GREEN composable) — FOUND
- Commit 4eaf606 (component) — FOUND
- Commit f528f8e (wiring) — FOUND

## Self-Check: PASSED
