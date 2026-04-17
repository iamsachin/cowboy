---
phase: quick-260417-phr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/frontend/src/composables/useTimeline.ts
  - packages/frontend/tests/composables/useTimeline.test.ts
  - packages/frontend/src/components/ConversationTimeline.vue
autonomous: true
requirements:
  - IMPR-3
tags: [subagent, timeline, status-icons, pulse, frontend-only, impr-3]

must_haves:
  truths:
    - "A successful sub-agent event in the timeline sidebar shows a green CheckCircle2 (text-success)"
    - "A failed sub-agent event in the timeline sidebar shows a red XCircle (text-error)"
    - "An interrupted sub-agent event in the timeline sidebar shows a yellow AlertTriangle (text-warning)"
    - "An unmatched sub-agent event in the timeline sidebar shows a muted HelpCircle (text-base-content/60)"
    - "A missing sub-agent event in the timeline sidebar shows AlertTriangle (text-warning)"
    - "A running sub-agent event shows a pulsing Workflow icon (text-info) regardless of its position in the timeline"
    - "User events, assistant-group events, and compaction events are visually unchanged (existing icons/colours preserved)"
  artifacts:
    - path: "packages/frontend/src/composables/useTimeline.ts"
      provides: "TimelineEvent extended with optional status + subagentConversationId + subagentLinkAttempted populated on subagent events via classifyGhostState"
      contains: "status?: 'success' | 'error' | 'interrupted' | 'running' | 'unmatched' | 'missing'"
    - path: "packages/frontend/tests/composables/useTimeline.test.ts"
      provides: "6+ new test cases covering every subagent status path (success/error/interrupted from summary, running/unmatched/missing from classifyGhostState)"
      contains: "subagent status"
    - path: "packages/frontend/src/components/ConversationTimeline.vue"
      provides: "iconConfig switches on status for subagent events; pulse class applies when event.type==='subagent' && event.status==='running' OR legacy isActive-last-event gate"
      contains: "CheckCircle2"
  key_links:
    - from: "packages/frontend/src/composables/useTimeline.ts"
      to: "packages/frontend/src/utils/ghost-card-state.ts"
      via: "import { classifyGhostState } from '../utils/ghost-card-state'"
      pattern: "classifyGhostState"
    - from: "packages/frontend/src/composables/useTimeline.ts"
      to: "packages/frontend/src/types/api.ts"
      via: "reads tc.subagentSummary.status, tc.subagentConversationId, tc.subagentLinkAttempted from ToolCallRow (IMPR-7 projection)"
      pattern: "subagentLinkAttempted"
    - from: "packages/frontend/src/components/ConversationTimeline.vue"
      to: "packages/frontend/src/composables/useTimeline.ts"
      via: "TimelineEvent.status drives iconConfig + pulse gate"
      pattern: "event.status"
---

<objective>
Make the right-side conversation timeline sidebar distinguish sub-agent events by lifecycle state. Today every sub-agent event renders with the same `Workflow` icon and `text-info` colour (ConversationTimeline.vue:58-62), so a failed sub-agent is visually indistinguishable from a successful one, and a still-running sub-agent in the middle of the timeline does not pulse (the existing pulse gate at ConversationTimeline.vue:22 only lights up the LAST event of an active conversation).

Purpose: Closes FINDINGS.md §4.1b (no state cue on subagent events) and §4.5c (pulse gate too narrow), both flagged as IMPROVEMENT-3 / P0 in the research backlog. Reuses the `classifyGhostState` classifier and `subagentLinkAttempted` projection already shipped by IMPR-7 (SUMMARY: .planning/quick/260417-ok0-impr-7-three-state-ghost-sub-agent-card-/260417-ok0-SUMMARY.md) — zero schema / backend changes; frontend-only.

Output:
- Extended `TimelineEvent` type with optional `status` + `subagentConversationId` + `subagentLinkAttempted`, populated at the subagent emission site in `extractTimelineEvents`.
- New vitest cases locking the status derivation across the six lifecycle states.
- Updated `ConversationTimeline.vue` template with status-aware icon + colour config and a broadened pulse gate.
</objective>

<execution_context>
@/Users/sachin/Desktop/learn/cowboy/.claude/get-shit-done/workflows/execute-plan.md
@/Users/sachin/Desktop/learn/cowboy/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
# Project state
@/Users/sachin/Desktop/learn/cowboy/.planning/STATE.md
@/Users/sachin/Desktop/learn/cowboy/CLAUDE.md

# Research + prior art
@/Users/sachin/Desktop/learn/cowboy/.planning/quick/260417-mg3-use-research-skill-and-go-through-deeply/FINDINGS.md
@/Users/sachin/Desktop/learn/cowboy/.planning/quick/260417-ok0-impr-7-three-state-ghost-sub-agent-card-/260417-ok0-SUMMARY.md

# Files to edit
@/Users/sachin/Desktop/learn/cowboy/packages/frontend/src/composables/useTimeline.ts
@/Users/sachin/Desktop/learn/cowboy/packages/frontend/src/components/ConversationTimeline.vue
@/Users/sachin/Desktop/learn/cowboy/packages/frontend/tests/composables/useTimeline.test.ts

# Dependencies being reused
@/Users/sachin/Desktop/learn/cowboy/packages/frontend/src/utils/ghost-card-state.ts
@/Users/sachin/Desktop/learn/cowboy/packages/frontend/src/types/api.ts
@/Users/sachin/Desktop/learn/cowboy/packages/frontend/tests/utils/ghost-card-state.test.ts

<interfaces>
<!-- Contracts the executor needs. No codebase exploration required. -->

From packages/frontend/src/types/api.ts (lines 3-13, 85-97):
```typescript
export interface SubagentSummary {
  toolBreakdown: Record<string, number>;
  filesTouched: string[];
  totalToolCalls: number;
  status: 'success' | 'error' | 'interrupted';   // <-- NB: three values only
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
  subagentLinkAttempted: boolean;          // <-- added by IMPR-7
}
```

From packages/frontend/src/utils/ghost-card-state.ts (full file, shipped by IMPR-7):
```typescript
export type GhostCardState = 'running' | 'unmatched' | 'missing' | 'summary';

export interface GhostCardFlags {
  subagentSummary: SubagentSummary | null | undefined;
  subagentLinkAttempted: boolean;
  subagentConversationId: string | null | undefined;
  isActive: boolean;                       // NOT used for classification
}

// Precedence: summary > missing > unmatched > running
export function classifyGhostState(flags: GhostCardFlags): GhostCardState;
```

From packages/frontend/src/composables/useTimeline.ts (lines 4-11, the current type):
```typescript
export interface TimelineEvent {
  key: string;
  type: 'user' | 'assistant-group' | 'compaction' | 'subagent';
  label: string;
  turnIndex: number;
  /** For subagent events: the key of the parent assistant-group */
  parentKey?: string;
}
```

From packages/frontend/src/composables/useTimeline.ts (subagent emission site, lines 44-66) — this is the block that needs to populate the new fields:
```typescript
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
```

From packages/frontend/src/components/ConversationTimeline.vue (current pulse gate, line 22):
```typescript
isActive && idx === events.length - 1 ? 'pulse-icon' : '',
```

From packages/frontend/src/components/ConversationTimeline.vue (current iconConfig, lines 52-63):
```typescript
function iconConfig(event: TimelineEvent) {
  switch (event.type) {
    case 'user':             return { icon: User, colorClass: 'text-primary' };
    case 'assistant-group':  return { icon: Bot, colorClass: 'text-secondary' };
    case 'subagent':         return { icon: Workflow, colorClass: 'text-info' };
    case 'compaction':       return { icon: Minimize2, colorClass: 'text-warning' };
  }
}
```

From packages/frontend/src/pages/ConversationDetailPage.vue (line 155) — the props passed in, unchanged:
```html
<ConversationTimeline
  :events="timelineEvents"
  :active-key="activeKey"
  :is-active="data.conversation.isActive ?? false"
  @navigate="handleTimelineNavigate"
/>
```

Icon convention already present in the codebase (SubagentSummaryCard.vue line 211-213):
```typescript
import { Bot, ChevronRight, CheckCircle2, XCircle, AlertCircle, ExternalLink,
         AlertTriangle, HelpCircle, Loader2 } from 'lucide-vue-next';
```
USE `CheckCircle2` (not `CheckCircle`) — the codebase convention.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend TimelineEvent with status + write failing/passing tests</name>
  <files>
    packages/frontend/src/composables/useTimeline.ts,
    packages/frontend/tests/composables/useTimeline.test.ts
  </files>
  <behavior>
    Derived `status` on subagent events (existing non-subagent events unchanged):

    - status === 'success'      WHEN tc.subagentSummary?.status === 'success'
    - status === 'error'        WHEN tc.subagentSummary?.status === 'error'
    - status === 'interrupted'  WHEN tc.subagentSummary?.status === 'interrupted'
    - status === 'missing'      WHEN !summary && subagentConversationId  (classifyGhostState → 'missing')
    - status === 'unmatched'    WHEN !summary && !subagentConversationId && subagentLinkAttempted
    - status === 'running'      WHEN !summary && !subagentConversationId && !subagentLinkAttempted

    Projection from `subagentConversationId` and `subagentLinkAttempted` is also copied onto the event (executor can use these downstream for future enhancements; minimal add now is justified because the classifier already needs them).

    The emission site MUST call `classifyGhostState({ subagentSummary, subagentLinkAttempted, subagentConversationId, isActive: false })`. Passing `isActive: false` is intentional — the classifier does not use `isActive`, and `extractTimelineEvents` is a pure function with no access to conversation state. Pulse behaviour is re-derived at render time in Task 2 using the `isActive` prop that `ConversationTimeline.vue` already receives.

    Summary-present precedence: when the summary exists, its own status field wins (success/error/interrupted) regardless of what `classifyGhostState` would return ('summary'). In other words, the event's `status` is ALWAYS one of the six terminal values (`success|error|interrupted|running|unmatched|missing`), never `'summary'`.

    Edge cases locked by tests:
    - Test 1: Task tool call with `subagentSummary.status === 'success'` → event.status === 'success'
    - Test 2: Task tool call with `subagentSummary.status === 'error'` → event.status === 'error'
    - Test 3: Task tool call with `subagentSummary.status === 'interrupted'` → event.status === 'interrupted'
    - Test 4: Task tool call with no summary, no link, `subagentLinkAttempted === false` → event.status === 'running'
    - Test 5: Task tool call with no summary, no link, `subagentLinkAttempted === true` → event.status === 'unmatched'
    - Test 6: Task tool call with no summary but `subagentConversationId === 'conv-x'`, `subagentLinkAttempted === true` → event.status === 'missing'
    - Test 7: Task tool call with no summary but `subagentConversationId === 'conv-x'`, `subagentLinkAttempted === false` → event.status === 'missing' (link beats flag per classifier precedence)
    - Test 8: `Agent` tool name behaves identically to `Task` (parity check) — one case sufficient
    - Test 9: Non-subagent events (user / assistant-group / compaction) have `event.status === undefined`
  </behavior>
  <action>
1. Extend the `TimelineEvent` interface in `packages/frontend/src/composables/useTimeline.ts` (lines 4-11):
   ```typescript
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
   ```

2. Add an import at the top of `useTimeline.ts`:
   ```typescript
   import { classifyGhostState } from '../utils/ghost-card-state';
   ```

3. Replace the subagent event push (currently at lines 57-63) with a status-populating version. The push becomes:
   ```typescript
   const summary = tc.subagentSummary;
   const toolCount = summary?.totalToolCalls ?? 0;
   // Derive status: summary.status wins when summary exists; otherwise fall back to
   // classifyGhostState (which returns 'running' | 'unmatched' | 'missing' — the
   // 'summary' branch is unreachable because summary is null in the else path).
   let status: TimelineEvent['status'];
   if (summary) {
     status = summary.status; // 'success' | 'error' | 'interrupted'
   } else {
     const ghost = classifyGhostState({
       subagentSummary: null,
       subagentLinkAttempted: tc.subagentLinkAttempted,
       subagentConversationId: tc.subagentConversationId ?? null,
       isActive: false, // classifier ignores this; render-time decides pulse
     });
     // ghost is 'running' | 'unmatched' | 'missing' | 'summary' — but 'summary'
     // is unreachable here because we're in the `!summary` branch. Narrow safely.
     status = ghost === 'summary' ? undefined : ghost;
   }
   events.push({
     key: tc.id,
     type: 'subagent',
     label: `${desc}${toolCount > 0 ? ` · ${toolCount} tools` : ''}`,
     turnIndex: i,
     parentKey: groupKey,
     status,
     subagentConversationId: tc.subagentConversationId ?? null,
     subagentLinkAttempted: tc.subagentLinkAttempted,
   });
   ```

4. Write the 9 tests above in `packages/frontend/tests/composables/useTimeline.test.ts`. Follow the existing factory pattern — add a `makeAssistantGroupWithSubagent` helper that accepts `(toolCallId, toolName, overrides)` and returns an `AssistantGroup` whose first `assistant` turn has a single `ToolCallRow` in `toolCalls`. `overrides` supplies `subagentSummary`, `subagentConversationId`, `subagentLinkAttempted`, and the optional `input.description`. Reuse the `SubagentSummary` shape from `../../src/types`.

   Sketch for the factory (place BEFORE the existing `describe` blocks):
   ```typescript
   import type { ToolCallRow, SubagentSummary } from '../../src/types/api';

   function makeAssistantGroupWithSubagent(
     msgId: string,
     tcId: string,
     toolName: 'Task' | 'Agent',
     overrides: Partial<ToolCallRow> & { description?: string } = {},
   ): AssistantGroup {
     const { description, ...tcOverrides } = overrides;
     const tc: ToolCallRow = {
       id: tcId,
       messageId: msgId,
       name: toolName,
       input: { description: description ?? 'Fix login bug' },
       output: null,
       status: null,
       duration: null,
       createdAt: '2024-01-01T00:01:00Z',
       subagentConversationId: null,
       subagentSummary: null,
       subagentLinkAttempted: false,
       ...tcOverrides,
     };
     return {
       type: 'assistant-group',
       turns: [{
         type: 'assistant',
         message: {
           id: msgId, role: 'assistant', content: '',
           thinking: null, model: 'Opus 4',
           createdAt: '2024-01-01T00:01:00Z',
         },
         toolCalls: [tc],
       }],
       model: 'Opus 4',
       messageCount: 1,
       toolCallCount: 1,
       firstTimestamp: '2024-01-01T00:01:00Z',
       lastTimestamp: '2024-01-01T00:01:00Z',
     };
   }
   ```

   Add a new `describe('extractTimelineEvents — subagent status', () => { ... })` block with the 9 tests listed in `<behavior>`. Each test asserts ONE thing: `expect(subagentEvent.status).toBe(<expected>)` (plus in Test 9: `expect(userEvent.status).toBeUndefined()` etc.).

5. RED→GREEN discipline:
   - Commit A (RED): Add tests + type extension ONLY (step 1 type change + step 4 tests). Emission logic unchanged. Run `npx vitest run tests/composables/useTimeline.test.ts`. All new tests MUST fail (status is `undefined` on every subagent event). Commit: `test(quick-260417-phr): add failing tests for timeline subagent status derivation (IMPR-3)`.
   - Commit B (GREEN): Add import (step 2) + replace emission block (step 3). Run the same test command. All 9 new tests pass. Run `npx vitest run tests/composables/useTimeline.test.ts` (full file) to confirm no regression in existing 14 tests. Commit: `feat(quick-260417-phr): derive subagent lifecycle status in extractTimelineEvents (IMPR-3)`.

   Do NOT combine RED and GREEN into one commit — the two-commit discipline is the only enforceable proof that the tests actually tested the new behaviour (not a tautology).
  </action>
  <verify>
    <automated>cd packages/frontend &amp;&amp; npx vitest run tests/composables/useTimeline.test.ts</automated>
  </verify>
  <done>
- All 9 new subagent-status test cases pass (2 Task tool-call status variants → success/error/interrupted, 4 Task-without-summary variants → running/unmatched/missing × link-flag combos, 1 Agent parity, 1 non-subagent undefined-status).
- All pre-existing 14 tests in useTimeline.test.ts still pass.
- `classifyGhostState` is imported from `../utils/ghost-card-state` in `useTimeline.ts`.
- `TimelineEvent` has `status`, `subagentConversationId`, `subagentLinkAttempted` as optional fields (all three optional so other emission sites — user/assistant-group/compaction — remain unchanged without edits).
- Two commits exist in order: RED (tests fail), GREEN (tests pass). Commit messages follow the `feat/test(quick-260417-phr): <msg> (IMPR-3)` convention.
  </done>
</task>

<task type="auto">
  <name>Task 2: Status-aware icons + broadened pulse gate in ConversationTimeline.vue</name>
  <files>
    packages/frontend/src/components/ConversationTimeline.vue
  </files>
  <action>
1. Extend the lucide-vue-next import at line 39 of `ConversationTimeline.vue` to include the status icons. The final import becomes:
   ```typescript
   import {
     User, Bot, Minimize2, Workflow,
     CheckCircle2, XCircle, AlertTriangle, HelpCircle,
   } from 'lucide-vue-next';
   ```
   (Use `CheckCircle2`, matching `SubagentSummaryCard.vue:211-213` — codebase convention. NOT `CheckCircle`.)

2. Replace the `iconConfig` function body (currently lines 52-63) with a status-aware version. Non-subagent event types keep exactly their current behaviour; the `subagent` branch now switches on `event.status`:
   ```typescript
   function iconConfig(event: TimelineEvent) {
     switch (event.type) {
       case 'user':
         return { icon: User, colorClass: 'text-primary' };
       case 'assistant-group':
         return { icon: Bot, colorClass: 'text-secondary' };
       case 'compaction':
         return { icon: Minimize2, colorClass: 'text-warning' };
       case 'subagent':
         switch (event.status) {
           case 'success':
             return { icon: CheckCircle2, colorClass: 'text-success' };
           case 'error':
             return { icon: XCircle, colorClass: 'text-error' };
           case 'interrupted':
             return { icon: AlertTriangle, colorClass: 'text-warning' };
           case 'missing':
             return { icon: AlertTriangle, colorClass: 'text-warning' };
           case 'unmatched':
             return { icon: HelpCircle, colorClass: 'text-base-content/60' };
           case 'running':
           default:
             // 'running' OR legacy undefined (defensive: older event shapes)
             return { icon: Workflow, colorClass: 'text-info' };
         }
     }
   }
   ```
   Note: `interrupted` and `missing` share the same icon + colour intentionally (both represent "something went wrong that isn't a clean error"). This is a deliberate design choice that keeps the sidebar glanceable (5 visually-distinct states max: success ✓, error ✗, warning ⚠, unmatched ?, running ⟳).

3. Broaden the pulse gate at line 22 of the template. The current class binding is:
   ```html
   isActive && idx === events.length - 1 ? 'pulse-icon' : '',
   ```
   Replace it with a version that also pulses any running subagent mid-timeline:
   ```html
   (event.type === 'subagent' &amp;&amp; event.status === 'running') || (isActive &amp;&amp; idx === events.length - 1)
     ? 'pulse-icon' : '',
   ```
   Rationale: a running sub-agent event ALWAYS pulses (regardless of position and regardless of whether the overall conversation `isActive` — if the linker hasn't run yet, it's still in-flight and worth showing). The legacy last-event gate is preserved for the "assistant is currently generating" cue on the final event of an active conversation.

   IMPORTANT: Do NOT remove the legacy gate. Two rationales for keeping both:
   - A sub-agent that has completed with success (event.status === 'success') should NOT pulse — the new clause correctly excludes it.
   - The last assistant-group event of an active conversation (not a sub-agent) should still pulse — the legacy clause handles that.

4. `labelClass` (current lines 65-76) does NOT need to change. The existing `'text-info/70 pl-2'` label colour for subagents remains fine — the ICON colour carries the status signal. Changing label colour too would double-encode and risk distracting users. Leave `labelClass` untouched.

5. Commit: `feat(quick-260417-phr): status-aware timeline icons + pulse running subagents mid-timeline (IMPR-3)`.

6. Run the three verification commands in the `<verify>` block. Both test suites (useTimeline + ghost-card-state) should stay green (we did not touch their inputs); vue-tsc must report zero errors.
  </action>
  <verify>
    <automated>cd packages/frontend &amp;&amp; npx vue-tsc --noEmit &amp;&amp; npx vitest run tests/composables/useTimeline.test.ts tests/utils/ghost-card-state.test.ts</automated>
  </verify>
  <done>
- `ConversationTimeline.vue` imports `CheckCircle2`, `XCircle`, `AlertTriangle`, `HelpCircle` from `lucide-vue-next` (in addition to existing icons).
- `iconConfig` returns status-dependent icon + colour for subagent events: success → CheckCircle2 text-success, error → XCircle text-error, interrupted → AlertTriangle text-warning, missing → AlertTriangle text-warning, unmatched → HelpCircle text-base-content/60, running (or undefined default) → Workflow text-info.
- Non-subagent event types (user, assistant-group, compaction) render exactly as before — icons and colour classes unchanged.
- Pulse class is applied when `event.type === 'subagent' && event.status === 'running'` OR the pre-existing `isActive && idx === events.length - 1` condition.
- `labelClass` function is unchanged (intentionally — ICON carries status, LABEL carries type).
- `npx vue-tsc --noEmit` reports zero errors.
- `npx vitest run tests/composables/useTimeline.test.ts tests/utils/ghost-card-state.test.ts` reports all cases passing.
- One commit authored with message `feat(quick-260417-phr): status-aware timeline icons + pulse running subagents mid-timeline (IMPR-3)`.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

No new trust boundaries. All changes are downstream of existing API responses (`ConversationDetailResponse.toolCalls[]`) already trusted and consumed by `SubagentSummaryCard.vue` via IMPR-7. No new network calls, no new schema, no new IPC, no new file access.

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-phr-01 | Tampering | `tc.subagentSummary.status` (source of rendered icon) | accept | The field is sourced from the same authenticated local SQLite DB that already drives `SubagentSummaryCard`; no new ingress. A malicious value outside the `success|error|interrupted` set falls through `iconConfig`'s subagent `switch` to `default` → Workflow/text-info (running fallback). Observable-but-harmless. |
| T-phr-02 | Information Disclosure | `event.subagentConversationId` now mirrored onto `TimelineEvent` | accept | The value is already exposed in the same response consumed by the browser (e.g. `SubagentSummaryCard.vue` link). Adding it to `TimelineEvent` does not widen the blast radius; `TimelineEvent` is not persisted or sent over the wire. |
| T-phr-03 | Denial of Service | `classifyGhostState` called per Task/Agent tool call during `extractTimelineEvents` | accept | Pure function, O(1) per call. `extractTimelineEvents` is already O(turns × toolCalls); the added work is a constant-factor bump (3 branches). No loops unbounded by user input were introduced. |
</threat_model>

<verification>
Automated (blocking):
- `cd packages/frontend && npx vitest run tests/composables/useTimeline.test.ts` — 14 existing + 9 new cases pass (23 total).
- `cd packages/frontend && npx vitest run tests/utils/ghost-card-state.test.ts` — existing 8 cases still pass (no edits to classifier).
- `cd packages/frontend && npx vue-tsc --noEmit` — zero errors.

Automated (informational — must not regress baseline):
- `cd packages/frontend && npx vitest run` — 4 pre-existing failures documented in IMPR-7 SUMMARY (useCommandPalette, app.test.ts, useConversationDetail) are acceptable; 0 new failures expected.

Grep sanity checks:
- `grep -n "classifyGhostState" packages/frontend/src/composables/useTimeline.ts` — 2 matches (import + call site).
- `grep -n "CheckCircle2\|XCircle\|AlertTriangle\|HelpCircle" packages/frontend/src/components/ConversationTimeline.vue` — 4+ matches (import line + 4 case branches).
- `grep -nE "pulse-icon" packages/frontend/src/components/ConversationTimeline.vue` — 2 matches (the expanded class binding + the `.pulse-icon` CSS class).

Manual smoke test (human-verify, optional — not gated on in CI):
1. Open a conversation with a successful sub-agent → timeline shows green CheckCircle2.
2. Open a conversation with a failed sub-agent → timeline shows red XCircle.
3. Run a live session spawning a sub-agent; observe the running `Workflow` icon pulsing in the middle of the timeline before the linker finishes (pre-flag); after the linker pass + `tool_call:changed` refetch, the icon flips to the terminal status icon.
</verification>

<success_criteria>
Defined in must_haves.truths (frontmatter). Summary:
- Six distinct sub-agent states (success/error/interrupted/running/unmatched/missing) render with the documented icon + colour pairs.
- A running sub-agent pulses regardless of its position in the timeline.
- Non-sub-agent events (user, assistant-group, compaction) are pixel-identical to before.
- Zero schema changes, zero backend changes, zero new dependencies.
- All existing tests pass; 9 new tests pin the derivation logic.
</success_criteria>

<output>
After completion, create `.planning/quick/260417-phr-impr-3-status-aware-timeline-icons-and-p/260417-phr-SUMMARY.md` recording:
- Commits (3 expected: test RED, composable GREEN, component render)
- Files modified (3: useTimeline.ts, useTimeline.test.ts, ConversationTimeline.vue)
- Test counts (before → after per file)
- Any deviations (Rule 3 blockers if encountered; none anticipated since the props surface does not change)
- Grep sanity check results
</output>
