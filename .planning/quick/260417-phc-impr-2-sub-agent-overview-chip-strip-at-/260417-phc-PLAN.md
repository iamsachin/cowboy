---
phase: quick-260417-phc
plan: 01
type: execute
wave: 1
depends_on: []
subsystem: frontend-rendering
tags: [subagent, overview-strip, discovery, impr-2, frontend-only, tdd]
autonomous: true
requirements:
  - IMPR-2
files_modified:
  - packages/frontend/src/composables/useSubagentList.ts
  - packages/frontend/tests/composables/useSubagentList.test.ts
  - packages/frontend/src/components/SubagentOverviewStrip.vue
  - packages/frontend/src/pages/ConversationDetailPage.vue
user_setup: []

must_haves:
  truths:
    - "Conversation detail page renders a chip strip at the top when the conversation has >=1 Task/Agent tool call (FINDINGS.md §5 IMPR-2 user outcome)"
    - "Strip shows a header aggregate like `3 sub-agents · 2 ✓ 1 ✗` derived from per-chip ghostState + summary.status (FINDINGS.md §4.1a)"
    - "Each chip in the strip is clickable; clicking scrolls the matching SubagentSummaryCard into view via data-tool-call-id (FINDINGS.md §2.4 parallel-path pattern; ConversationDetailPage.vue:310-317)"
    - "Each chip's colour/icon reflects the same 4 ghostStates from IMPR-7 plus success/error for summary state (green=summary+success, red=summary+error or interrupted, pulse=running, grey=unmatched, warning=missing) — reuses classifyGhostState (260417-ok0-SUMMARY.md provides section)"
    - "Strip is hidden completely (no empty shell, no zero-count chrome) when the conversation has zero Task/Agent tool calls"
    - "Chip status stays in sync with SubagentSummaryCard: when IMPR-1's tool_call:changed refetch flips a running chip to summary, the strip re-renders with the new aggregate (because the composable is a computed over data.value.toolCalls)"
  artifacts:
    - path: "packages/frontend/src/composables/useSubagentList.ts"
      provides: "Pure derivation composable: (toolCalls, isActive) -> SubagentListEntry[]"
      exports: ["useSubagentList", "SubagentListEntry"]
      min_lines: 40
    - path: "packages/frontend/tests/composables/useSubagentList.test.ts"
      provides: "Vitest coverage of filter + status derivation + aggregate counts"
      min_lines: 80
    - path: "packages/frontend/src/components/SubagentOverviewStrip.vue"
      provides: "Presentational component: props `subagents: SubagentListEntry[]`, emit `jump-to: string`"
      min_lines: 80
    - path: "packages/frontend/src/pages/ConversationDetailPage.vue"
      provides: "Wires the strip between header card and ConversationDetail; uses existing scroll mechanism"
      contains: "SubagentOverviewStrip"
  key_links:
    - from: "packages/frontend/src/composables/useSubagentList.ts"
      to: "packages/frontend/src/utils/ghost-card-state.ts"
      via: "import classifyGhostState and reuse with same precedence"
      pattern: "classifyGhostState\\("
    - from: "packages/frontend/src/pages/ConversationDetailPage.vue"
      to: "packages/frontend/src/components/SubagentSummaryCard.vue"
      via: "chip @jump-to -> querySelector([data-tool-call-id=...]) -> scrollIntoView (same as timeline sidebar)"
      pattern: "data-tool-call-id"
    - from: "packages/frontend/src/components/SubagentOverviewStrip.vue"
      to: "packages/frontend/src/pages/ConversationDetailPage.vue"
      via: "emits 'jump-to' with toolCallId; page handles scroll via same handleTimelineNavigate-style pattern"
      pattern: "@jump-to"
---

<objective>
Ship IMPR-2 from FINDINGS.md §5: add a scannable sub-agent chip strip to the top
of `ConversationDetailPage.vue` so users can tell at a glance how many sub-agents
a conversation used, their individual status, and jump to any of them with one
click — without scrolling the turn list.

Purpose: closes the "no conversation-level sub-agent summary" gap (FINDINGS.md
§4.1a). Purely frontend; reuses three existing mechanisms:
1. `classifyGhostState` from IMPR-7 (260417-ok0) for per-chip state
2. The `[data-tool-call-id]` scroll pattern used by the timeline sidebar
   (`ConversationDetailPage.vue:310-317`)
3. The `isSubagentCall` filter (`tc.name === 'Task' || tc.name === 'Agent'`)
   used by `ToolCallRow.vue:79-80` and `useTimeline.ts:47`

Output:
- New composable `useSubagentList.ts` + vitest coverage (pure, TDD-friendly)
- New presentational component `SubagentOverviewStrip.vue`
- `ConversationDetailPage.vue` wiring (one new element slot + one handler)
</objective>

<execution_context>
@/Users/sachin/Desktop/learn/cowboy/.claude/get-shit-done/workflows/execute-plan.md
@/Users/sachin/Desktop/learn/cowboy/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260417-mg3-use-research-skill-and-go-through-deeply/FINDINGS.md
@.planning/quick/260417-ok0-impr-7-three-state-ghost-sub-agent-card-/260417-ok0-SUMMARY.md
@packages/frontend/src/pages/ConversationDetailPage.vue
@packages/frontend/src/components/ConversationTimeline.vue
@packages/frontend/src/composables/useTimeline.ts
@packages/frontend/src/utils/ghost-card-state.ts
@packages/frontend/tests/utils/ghost-card-state.test.ts
@packages/frontend/src/types/api.ts
@packages/frontend/src/components/ToolCallRow.vue

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->
<!-- Executor should use these directly — no codebase exploration needed. -->

From packages/frontend/src/types/api.ts (lines 3-13, 85-97):
```typescript
export interface SubagentSummary {
  toolBreakdown: Record<string, number>;
  filesTouched: string[];
  totalToolCalls: number;
  status: 'success' | 'error' | 'interrupted';
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  lastError: string | null;
  matchConfidence: 'high' | 'medium' | 'low';
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
  subagentConversationId?: string | null;
  subagentSummary?: SubagentSummary | null;
  subagentLinkAttempted: boolean;
}
```

From packages/frontend/src/utils/ghost-card-state.ts:
```typescript
export type GhostCardState = 'running' | 'unmatched' | 'missing' | 'summary';

export interface GhostCardFlags {
  subagentSummary: SubagentSummary | null | undefined;
  subagentLinkAttempted: boolean;
  subagentConversationId: string | null | undefined;
  isActive: boolean;
}

export function classifyGhostState(flags: GhostCardFlags): GhostCardState;
// Precedence: summary > missing > unmatched > running
```

From packages/frontend/src/pages/ConversationDetailPage.vue:310-317
(scroll-to-tool-call mechanism — reuse verbatim in the jump handler):
```typescript
let el: Element | null = null;
if (parentKey) {
  el = scrollContainer.value?.querySelector(`[data-tool-call-id="${key}"]`) ?? null;
}
if (!el) {
  el = scrollContainer.value?.querySelector(`[data-turn-key="${groupKey}"]`) ?? null;
}
el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
```

Sub-agent filter pattern used consistently in this codebase (reuse, do NOT invent):
```typescript
// From ToolCallRow.vue:79-80 and useTimeline.ts:47
tc.name === 'Task' || tc.name === 'Agent'
```

New contract this plan introduces (Task 1 writes this; Task 2 consumes it):
```typescript
// packages/frontend/src/composables/useSubagentList.ts
import type { GhostCardState } from '../utils/ghost-card-state';

export interface SubagentListEntry {
  toolCallId: string;           // tc.id -> matches [data-tool-call-id] on SubagentSummaryCard wrapper
  ghostState: GhostCardState;   // running | unmatched | missing | summary
  /**
   * When ghostState === 'summary', mirrors summary.status so the chip UI can render
   * success (green check), error (red X), interrupted (red X). Undefined otherwise.
   */
  summaryStatus?: 'success' | 'error' | 'interrupted';
  /**
   * Short label, derived in the same priority order as useTimeline.ts:48-54:
   * input.description -> truncated input.prompt (40 chars) -> 'Subagent'.
   */
  description: string;
}

export interface SubagentListAggregate {
  total: number;
  success: number;   // summary && status === 'success'
  error: number;     // summary && status !== 'success' (error + interrupted)
  running: number;   // ghostState === 'running'
  unmatched: number; // ghostState === 'unmatched'
  missing: number;   // ghostState === 'missing'
}

export function useSubagentList(
  toolCalls: Ref<ToolCallRow[] | undefined>,
  isActive: Ref<boolean>,
): {
  subagents: ComputedRef<SubagentListEntry[]>;
  aggregate: ComputedRef<SubagentListAggregate>;
};
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create useSubagentList composable with vitest coverage (TDD)</name>
  <files>
    packages/frontend/src/composables/useSubagentList.ts,
    packages/frontend/tests/composables/useSubagentList.test.ts
  </files>
  <behavior>
    Pure derivation. All reactivity flows through Vue `computed` — no side effects,
    no fetches, no localStorage. The test file drives the RED step; the composable
    file drives the GREEN step.

    Filter + derivation rules:
    - Filter: `tc.name === 'Task' || tc.name === 'Agent'` (copy verbatim from
      `ToolCallRow.vue:79-80` / `useTimeline.ts:47` — do NOT invent a new predicate).
    - ghostState: delegate to `classifyGhostState({ subagentSummary, subagentLinkAttempted, subagentConversationId, isActive })`.
      Pass `isActive` through as the flag value (even though the classifier does not
      use it for state selection — FINDINGS.md §2.6; ghost-card-state.ts:18-25).
    - summaryStatus: only populated when `ghostState === 'summary'`; mirrors
      `subagentSummary.status`. Undefined otherwise.
    - description: mirror the priority used in `useTimeline.ts:48-54`:
      `input.description` (string) -> `input.prompt.slice(0,40) + '…'` (string) -> `'Subagent'`.
      Guard with `typeof === 'string'` on both (same as useTimeline.ts).
    - Order: preserve input order (`toolCalls.filter(...)` — no sort).

    Aggregate counts (for the strip header):
    - total: filtered count
    - success: entries where `summaryStatus === 'success'`
    - error: entries where `summaryStatus === 'error' || summaryStatus === 'interrupted'`
      (interrupted treated as error — matches SubagentSummaryCard.vue `isError` computed
      per 260417-ok0 SUMMARY "Render + Null-Safety" section)
    - running / unmatched / missing: one counter per ghostState

    Test cases (≥7, drives 8+ assertions):
    - Test 1: empty toolCalls array -> subagents = [], aggregate.total = 0
    - Test 2: toolCalls with no Task/Agent entries (only Read/Edit/Bash) -> filtered out
    - Test 3: a Task tool call with summary.status='success' -> ghostState='summary',
      summaryStatus='success', aggregate.success=1
    - Test 4: a Task tool call with summary.status='error' -> summaryStatus='error',
      aggregate.error=1
    - Test 5: an Agent tool call with summary.status='interrupted' -> aggregate.error=1
      (interrupted merges into error bucket per decision)
    - Test 6: running tool call (no summary, no link, flag false) -> ghostState='running',
      aggregate.running=1, summaryStatus undefined
    - Test 7: unmatched (flag true, no summary, no link) -> ghostState='unmatched',
      aggregate.unmatched=1
    - Test 8: missing (link present, no summary) -> ghostState='missing',
      aggregate.missing=1
    - Test 9: description priority — input.description > input.prompt > fallback.
      Verify all three branches including the 40-char truncation with '…' suffix when
      prompt > 40 chars. Non-string input.description falls through to prompt.
    - Test 10: mixed bag (2 Task success + 1 Task error + 1 running + 1 Read-should-be-filtered)
      -> total=4, success=2, error=1, running=1, Read excluded.
    - Test 11 (reactivity): toolCalls ref mutation -> computed updates. Use
      `import { ref } from 'vue'` and `import { nextTick } from 'vue'` to verify.

    RED step commit message: `test(quick-260417-phc): add failing vitest for useSubagentList`
    GREEN step commit message: `feat(quick-260417-phc): implement useSubagentList composable (IMPR-2)`

    Interface the tests depend on (stable — Task 2 and 3 consume this):
    ```ts
    export interface SubagentListEntry {
      toolCallId: string;
      ghostState: GhostCardState;
      summaryStatus?: 'success' | 'error' | 'interrupted';
      description: string;
    }
    export interface SubagentListAggregate {
      total: number;
      success: number;
      error: number;
      running: number;
      unmatched: number;
      missing: number;
    }
    export function useSubagentList(
      toolCalls: Ref<ToolCallRow[] | undefined>,
      isActive: Ref<boolean>,
    ): {
      subagents: ComputedRef<SubagentListEntry[]>;
      aggregate: ComputedRef<SubagentListAggregate>;
    };
    ```

    The composable accepts a `Ref<ToolCallRow[] | undefined>` (NOT a plain array) so
    it remains reactive as `useConversationDetail`'s `data` stream flips between
    loading/loaded/refetched states. Handle `undefined` as empty.
  </behavior>
  <action>
    Step 1 (RED): Write `packages/frontend/tests/composables/useSubagentList.test.ts`
    covering the 11 cases above. Model test style on the existing
    `packages/frontend/tests/utils/ghost-card-state.test.ts` (import paths, fakeSummary
    pattern — copy its `fakeSummary` fixture and extend with `status` variants).
    For Vue-reactivity tests, model on
    `packages/frontend/tests/composables/useTimeline.test.ts` (ref + computed patterns).
    Run `npx vitest run tests/composables/useSubagentList.test.ts` — MUST fail with
    module-not-found (mirrors IMPR-7 RED step evidence from 260417-ok0 SUMMARY).

    Step 2 (GREEN): Create `packages/frontend/src/composables/useSubagentList.ts`:
    - Import `Ref`, `ComputedRef`, `computed` from `vue`
    - Import `ToolCallRow` from `../types/api` (same alias used across composables)
    - Import `classifyGhostState`, `GhostCardState` from `../utils/ghost-card-state`
    - Export `SubagentListEntry`, `SubagentListAggregate` interfaces
    - Implement `useSubagentList(toolCalls, isActive)` returning `{ subagents, aggregate }`
      where both are `computed` refs.
    - For description derivation, lift the exact logic from `useTimeline.ts:48-54`
      (input.description string -> prompt slice -> 'Subagent'). Keep the `typeof ===
      'string'` guards. Use `…` (ellipsis character, same as useTimeline.ts's `...`).
      NOTE: useTimeline.ts uses the three-ASCII-dot form `'...'`; match that exactly
      for visual consistency (grep the file to confirm; do not introduce the `…`
      unicode character).

    Step 3: Re-run `npx vitest run tests/composables/useSubagentList.test.ts` — MUST
    pass all cases. Run `npx vue-tsc --noEmit` to confirm zero type errors.
  </action>
  <verify>
    <automated>cd packages/frontend &amp;&amp; npx vitest run tests/composables/useSubagentList.test.ts &amp;&amp; npx vue-tsc --noEmit</automated>
  </verify>
  <done>
    - `useSubagentList.ts` exists, exports `useSubagentList`, `SubagentListEntry`,
      `SubagentListAggregate`.
    - `useSubagentList.test.ts` exists with ≥11 cases; all pass.
    - `vue-tsc --noEmit` passes with zero errors (no new errors vs baseline).
    - Two commits recorded: RED (failing test) then GREEN (implementation).
    - No modifications to existing files in this task.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create SubagentOverviewStrip.vue presentational component</name>
  <files>packages/frontend/src/components/SubagentOverviewStrip.vue</files>
  <behavior>
    Stateless presentational component. Props in, events out. No data fetching,
    no access to `useConversationDetail`, no direct DOM queries. The page owns the
    scroll; the strip only asks for a jump.

    Props (defineProps):
    - `subagents: SubagentListEntry[]` — from the parent's `useSubagentList`
    - `aggregate: SubagentListAggregate` — from the parent's `useSubagentList`

    Emits (defineEmits):
    - `(e: 'jump-to', toolCallId: string): void`

    Render contract:
    - When `subagents.length === 0`, render nothing (`<template v-if="subagents.length > 0">`).
      The parent MAY also guard with `v-if` but the component MUST self-hide
      (defense in depth; matches the truth "hidden on conversations without sub-agents").
    - Root: `<div class="flex items-center gap-2 flex-wrap mb-4">` (slots between the
      header card `mb-6` and the ConversationDetail; see Task 3 for placement). Responsive
      wrap so a swarm of 10 chips doesn't overflow on narrow viewports.
    - Aggregate header (left of the chips): a small `<span class="text-sm text-base-content/70">` that reads:
      `{{ aggregate.total }} sub-agent{{ aggregate.total === 1 ? '' : 's' }}`,
      optionally followed by a `·` separator and coloured counters.
      Count rendering: only show non-zero buckets to keep the header terse. Format:
      `· <CheckCircle>{{success}} · <XCircle>{{error}} · <Loader2 class="animate-spin">{{running}} · <HelpCircle>{{unmatched}} · <AlertTriangle>{{missing}}`.
      Each icon gets the same colour used on the matching chip (see below).
    - Chip element: `<button type="button" class="badge badge-sm gap-1 ..." @click="$emit('jump-to', entry.toolCallId)">`.
      Inside: small status icon + truncated description (max-w for safety).
      `type="button"` is mandatory (avoids accidental form submission). Hover and
      focus states from DaisyUI's `btn`-like reset — NOT `btn` class, because we
      want the inline-friendly badge sizing.
    - Colour + icon per entry, driven solely by `ghostState` (+ `summaryStatus` when
      ghostState='summary'):
        * summary + success -> `badge-success` + `CheckCircle` lucide icon
        * summary + error -> `badge-error` + `XCircle` lucide icon
        * summary + interrupted -> `badge-error` + `XCircle` (merges with error)
        * running -> `badge-info` + `Loader2` icon with `animate-spin` (IMPR-7
          established this pattern — 260417-ok0-SUMMARY.md "Render + Null-Safety"
          running branch)
        * unmatched -> `badge-ghost` + `HelpCircle`
        * missing -> `badge-warning` + `AlertTriangle`
      Keep icon size at `w-3 h-3` to fit inside `badge-sm`.
    - Accessibility: each chip has `:aria-label="`Jump to sub-agent: ${entry.description} (${ghostState}${entry.summaryStatus ? ' ' + entry.summaryStatus : ''})`"`.
    - Description truncation: CSS `truncate max-w-[16ch]` on the description span;
      full description in a native `title` tooltip attribute.
  </behavior>
  <action>
    Create the file with `<template>`, `<script setup lang="ts">`, and (if needed)
    scoped styles. Style conventions:
    - Tailwind + DaisyUI utility classes (consistent with
      `SubagentSummaryCard.vue`, `ConversationTimeline.vue`).
    - Lucide icons: `CheckCircle`, `XCircle`, `Loader2`, `HelpCircle`, `AlertTriangle`
      (all already used elsewhere in the codebase — grep confirms).
    - Import types from `../composables/useSubagentList`.
    - No `v-html`, no inline `style="..."` except as needed for truncation max-width
      (prefer Tailwind arbitrary values: `max-w-[16ch]`).

    Per-chip state helper: define a single local function
    `chipLook(entry: SubagentListEntry): { class: string; icon: Component; spin?: boolean }`
    inside `<script setup>` to keep the template minimal. Spin flag is true only for
    the running state.

    For aggregate icons, also reuse `chipLook` (same colours) or use a parallel table.

    Guard the whole render with `v-if="subagents.length > 0"` on the root template
    block so nothing renders for empty conversations (truth: "Strip is hidden on
    conversations without sub-agents").

    Do NOT introduce new globals, state stores, or composables. This component is
    purely a view over its props.
  </action>
  <verify>
    <automated>cd packages/frontend &amp;&amp; npx vue-tsc --noEmit</automated>
  </verify>
  <done>
    - `SubagentOverviewStrip.vue` exists, ~80-150 lines.
    - `defineProps` declares `subagents` and `aggregate` with correct types.
    - `defineEmits` declares `jump-to: [toolCallId: string]`.
    - Root wrapped in `v-if="subagents.length > 0"`.
    - Each chip emits `jump-to` on click with `entry.toolCallId`.
    - Each ghostState has distinct visible colour + icon per the table above.
    - `vue-tsc --noEmit` passes with zero errors.
    - No import from `useConversationDetail` or any other state-owning module.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire strip into ConversationDetailPage.vue</name>
  <files>packages/frontend/src/pages/ConversationDetailPage.vue</files>
  <behavior>
    Thin wiring: instantiate the composable, render the component, handle the jump.
    No new composables, no refactoring of existing code, no changes to the timeline
    handler or the scroll-container plumbing.

    Placement:
    - Insert `<SubagentOverviewStrip ... />` INSIDE the success-state `<template v-else-if="data">`,
      AFTER the closing `</div>` of the metadata header bar (currently line 128)
      and BEFORE `<ConversationDetail>` (currently line 131).
    - Visual spacing: the strip component already carries `mb-4`; the existing header
      bar has `mb-6`. To keep visual rhythm, reduce the header's `mb-6` to `mb-4`
      ONLY if the resulting gap is visually tight — prefer leaving `mb-6` as-is so
      this plan touches the minimum scope. (The strip has its own `mb-4` margin; the
      result will be `mb-6` (header) + strip + `mb-4` (strip) = normal flow.)
      DECISION: do NOT change the header's `mb-6`.

    Composable invocation (add to `<script setup>` near the existing
    `useConversationDetail` and `useTimeline` calls):
    ```ts
    import SubagentOverviewStrip from '../components/SubagentOverviewStrip.vue';
    import { useSubagentList } from '../composables/useSubagentList';

    // Derive the list. Pass refs — they must remain reactive so IMPR-1's
    // tool_call:changed refetch flips chip states without re-mount.
    const toolCallsRef = computed(() => data.value?.toolCalls);
    const isActiveRef  = computed(() => data.value?.conversation.isActive ?? false);
    const { subagents: subagentList, aggregate: subagentAggregate } =
      useSubagentList(toolCallsRef, isActiveRef);
    ```

    Template binding:
    ```html
    <SubagentOverviewStrip
      :subagents="subagentList"
      :aggregate="subagentAggregate"
      @jump-to="handleSubagentJump"
    />
    ```

    Jump handler (new function in `<script setup>`; reuse existing plumbing):
    ```ts
    async function handleSubagentJump(toolCallId: string): Promise<void> {
      // Find the timeline event for this tool call id to recover turnIndex + parentKey.
      const evt = timelineEvents.value.find(
        (e) => e.type === 'subagent' &amp;&amp; e.key === toolCallId,
      );
      if (!evt) {
        // Fallback: direct querySelector scroll without expanding group.
        const el = scrollContainer.value?.querySelector(
          `[data-tool-call-id="${toolCallId}"]`,
        );
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      // Reuse the existing handler — it already does loadUpTo, expandGroup,
      // querySelector([data-tool-call-id]), and scrollIntoView (lines 291-321).
      await handleTimelineNavigate(evt.key, evt.turnIndex, evt.parentKey);
    }
    ```

    Rationale for reusing `handleTimelineNavigate`:
    - It already handles pagination (`loadUpTo`), collapsed assistant groups
      (`expandGroup`), and the `data-tool-call-id` querySelector chain.
    - Matches FINDINGS.md §2.4 "Parallel path — timeline sidebar" behavior,
      satisfying the IMPR-2 user outcome of "each chip jumps to the card".
    - Avoids duplicating the navigating-flag bookkeeping (which prevents the
      IntersectionObserver from over-writing activeKey mid-scroll).
    - Note: requires `timelineEvents` to already be populated. It is — `timelineEvents`
      is a computed over `detailRef.value?.turns`, and `<ConversationDetail>` renders
      above the click event's origin (async mount propagation is not a concern because
      the user can only click a chip after the page has rendered, meaning `detailRef`
      is attached and `timelineEvents` is non-empty for any sub-agent the chip
      represents).

    What NOT to change:
    - Do NOT modify `handleTimelineNavigate` itself.
    - Do NOT modify the IntersectionObserver setup or `setupObserver`.
    - Do NOT modify the timeline auto-scroll logic.
    - Do NOT change any of the existing header bar metadata chips (Project/Agent/
      Model/Date/Duration/Tokens/Cost).
    - Do NOT introduce new CSS.
  </behavior>
  <action>
    1. Edit `<script setup>` block of `ConversationDetailPage.vue`:
       - Add imports for `SubagentOverviewStrip` and `useSubagentList` next to the
         existing `ConversationDetail` / `ConversationTimeline` imports (around line
         169-170).
       - After the `useConversationDetail(id)` destructure (line 187), add the
         `toolCallsRef`, `isActiveRef`, and `useSubagentList` invocation.
       - Add the `handleSubagentJump` async function after `handleTimelineNavigate`
         (after line 322).

    2. Edit the `<template>`:
       - Between the metadata header `</div>` (line 128) and `<ConversationDetail ...>`
         (line 131), insert:
         ```html
         <SubagentOverviewStrip
           :subagents="subagentList"
           :aggregate="subagentAggregate"
           @jump-to="handleSubagentJump"
         />
         ```

    3. Run `npx vue-tsc --noEmit` to confirm types propagate correctly.

    4. Run the full frontend test suite to confirm no regressions:
       `npx vitest run`. Expect 272+ passing and the same 4 pre-existing failures
       documented in 260417-ok0 SUMMARY (`useCommandPalette`, `app.test.ts`,
       `useConversationDetail`). No NEW failures.

    5. Manual smoke signal (informational only — no blocking automation):
       - `grep -c 'SubagentOverviewStrip' packages/frontend/src/pages/ConversationDetailPage.vue` should return 2 (import + template).
       - `grep -c 'data-tool-call-id' packages/frontend/src/pages/ConversationDetailPage.vue` should remain 1 (unchanged — still only inside handleTimelineNavigate).

    Commit message: `feat(quick-260417-phc): wire SubagentOverviewStrip into ConversationDetailPage (IMPR-2)`
  </action>
  <verify>
    <automated>cd packages/frontend &amp;&amp; npx vue-tsc --noEmit &amp;&amp; npx vitest run</automated>
  </verify>
  <done>
    - `ConversationDetailPage.vue` imports `SubagentOverviewStrip` and `useSubagentList`.
    - `<SubagentOverviewStrip>` appears exactly once in the template between the
      header bar and `<ConversationDetail>`.
    - `handleSubagentJump` is a new function; `handleTimelineNavigate` is
      UNCHANGED.
    - `vue-tsc --noEmit` passes.
    - `vitest run` matches the pre-plan baseline (same number of pass/fail;
      zero NEW failures attributable to this plan).
    - Conversation with 0 Task/Agent tool calls renders no strip (verified by
      the `v-if` inside SubagentOverviewStrip).
    - Conversation with ≥1 Task/Agent tool call renders the strip and clicking a
      chip calls `handleSubagentJump` -> `handleTimelineNavigate` -> scrollIntoView.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| data -&gt; template | `data.value.toolCalls` shape is trusted (backend-owned via `ConversationDetailResponse`). No user input traverses this boundary. |
| chip click -&gt; querySelector | `toolCallId` is used to build a CSS attribute selector. Comes from `ToolCallRow.id` (DB-assigned hex `generate_id` result — see FINDINGS.md §1.1). Not attacker-controlled. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-phc-01 | Tampering | `useSubagentList` filter | accept | Filter predicate is literal `=== 'Task' \|\| === 'Agent'`; no dynamic regex. No injection surface. |
| T-phc-02 | Information Disclosure | description field in chip | mitigate | Description is derived from the same `input.description` / `input.prompt` fields already rendered in the existing `SubagentSummaryCard` and timeline sidebar. No new surface. Truncated to 16ch with `title` tooltip — identical exposure to existing UI. |
| T-phc-03 | DoS (rendering) | strip with N chips | mitigate | Use `flex-wrap` so unbounded chip counts don't break layout. Typical N≤10 (FINDINGS.md §2.5 "parallel sub-agent"). Beyond that, wraps naturally. No virtualization needed at this scale (quick-28 deferral). |
| T-phc-04 | Tampering (XSS via toolCallId in querySelector) | jump handler | mitigate | `toolCallId` is a hex ID generated by Rust `generate_id` (SHA-based). Cannot contain CSS-selector-breaking characters. The same pattern is already used at `ConversationDetailPage.vue:313` without issue. No new attack surface. |
| T-phc-05 | Spoofing (chip status lies) | aggregate counts | accept | Counts derive from the same `subagentSummary` blob that drives the card itself (FINDINGS.md §2.6). If the card is wrong, the chip is wrong the same way. No new trust claim. |
</threat_model>

<verification>
Overall-phase checks (run after all three tasks complete):

1. Type check: `cd packages/frontend && npx vue-tsc --noEmit` -> zero errors (same
   baseline as 260417-ok0 SUMMARY).
2. Unit tests: `cd packages/frontend && npx vitest run` -> pre-plan baseline pass
   count + 11 new cases passing. Same 4 pre-existing failures; zero NEW failures.
3. Unit tests (focused): `npx vitest run tests/composables/useSubagentList.test.ts`
   -> all ≥11 cases pass.
4. File presence (grep):
   - `ls packages/frontend/src/composables/useSubagentList.ts` -> file exists
   - `ls packages/frontend/tests/composables/useSubagentList.test.ts` -> file exists
   - `ls packages/frontend/src/components/SubagentOverviewStrip.vue` -> file exists
   - `grep -c 'SubagentOverviewStrip' packages/frontend/src/pages/ConversationDetailPage.vue` -> 2 (import + template)
5. Reuse enforcement (grep):
   - `grep -c 'classifyGhostState' packages/frontend/src/composables/useSubagentList.ts` -> ≥1 (reuses IMPR-7)
   - `grep -c "name === 'Task'" packages/frontend/src/composables/useSubagentList.ts` -> ≥1 (same filter as ToolCallRow.vue / useTimeline.ts)
6. Scope boundary: no backend files modified; no schema changes; no WebSocket events
   added or consumed. `git diff --name-only origin/main..HEAD -- src-tauri/` -> empty.
</verification>

<success_criteria>
- All three `<done>` blocks satisfied.
- `vue-tsc --noEmit` zero errors.
- `vitest run` baseline unchanged + 11 new passing cases.
- Strip appears on conversations with sub-agents; hidden on those without.
- Clicking a chip scrolls the matching `SubagentSummaryCard` into view (reuses the
  exact same scroll path as the timeline sidebar — FINDINGS.md §2.4 "Parallel path").
- Chip status reuses `classifyGhostState` (260417-ok0 provides) — single source of
  truth with the `SubagentSummaryCard` itself. When IMPR-1's `tool_call:changed` event
  triggers a refetch, chip state flips in lock-step with the card.
- Zero backend changes. Zero schema changes. Purely additive frontend.
</success_criteria>

<output>
After completion, create `.planning/quick/260417-phc-impr-2-sub-agent-overview-chip-strip-at-/260417-phc-SUMMARY.md`
mirroring the 260417-ok0 SUMMARY structure: Commits table, per-artifact section,
Verification table (vue-tsc + vitest baseline comparison), Deviations, Deferred
Items, Threat Flags, Self-Check.
</output>
