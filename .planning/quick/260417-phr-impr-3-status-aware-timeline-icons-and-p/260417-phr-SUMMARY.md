---
phase: quick-260417-phr
plan: 01
subsystem: frontend-timeline-sidebar
tags: [subagent, timeline, status-icons, pulse, frontend-only, impr-3]
requires:
  - FINDINGS.md §4.1b (no state cue on subagent events)
  - FINDINGS.md §4.5c (pulse gate too narrow)
  - FINDINGS.md §5 IMPROVEMENT-3
  - .planning/quick/260417-ok0-impr-7-three-state-ghost-sub-agent-card-/260417-ok0-SUMMARY.md (reuses classifyGhostState + subagentLinkAttempted projection)
provides:
  - type-field: TimelineEvent.status ('success' | 'error' | 'interrupted' | 'running' | 'unmatched' | 'missing' | undefined)
  - type-field: TimelineEvent.subagentConversationId (string | null | undefined)
  - type-field: TimelineEvent.subagentLinkAttempted (boolean | undefined)
  - derivation: extractTimelineEvents populates status via summary.status OR classifyGhostState fallback
  - render: ConversationTimeline.vue iconConfig returns status-aware icon + colour for subagent events
  - render: ConversationTimeline.vue pulses any running subagent regardless of position (legacy last-event gate preserved)
affects:
  - packages/frontend/src/composables/useTimeline.ts
  - packages/frontend/tests/composables/useTimeline.test.ts
  - packages/frontend/src/components/ConversationTimeline.vue
tech-stack:
  added: []
  patterns:
    - "Pure status derivation: summary-status precedence over classifier ghost-state"
    - "Render-time pulse decision: composable stays pure (no conversation state); template combines event.status with existing isActive prop"
    - "Default-case fallback in nested status switch preserves legacy Workflow/text-info for undefined status"
key-files:
  created: []
  modified:
    - packages/frontend/src/composables/useTimeline.ts
    - packages/frontend/tests/composables/useTimeline.test.ts
    - packages/frontend/src/components/ConversationTimeline.vue
decisions:
  - "interrupted and missing share AlertTriangle/text-warning intentionally — both represent 'something went wrong that isn't a clean error'; keeps the sidebar glanceable (5 visually-distinct states max)"
  - "classifyGhostState invoked with isActive: false because extractTimelineEvents is a pure function with no conversation-level state; pulse is re-derived at render time from the existing isActive prop"
  - "Summary-status always wins over ghost-state — status is ALWAYS one of the six terminal values, never 'summary'"
  - "labelClass untouched (intentionally) — icon carries status signal, label carries type; double-encoding would risk distracting users"
metrics:
  duration_seconds: 443
  completed: 2026-04-17
  tasks_completed: 2
  tasks_total: 2
  commits: 3
---

# Phase quick-260417-phr Plan 01: IMPR-3 Status-Aware Timeline Icons and Pulse Summary

Status-aware icons and broadened pulse gate for sub-agent events in the right-side conversation timeline sidebar. Derives lifecycle status (success/error/interrupted/running/unmatched/missing) inside `extractTimelineEvents` via `classifyGhostState` reuse, then renders differentiated icon + colour per status in `ConversationTimeline.vue` and pulses every running sub-agent regardless of position.

## Commits

| Commit | Type | Scope | Files |
|--------|------|-------|-------|
| `79ebcf2` | test | quick-260417-phr | `useTimeline.ts` (type), `useTimeline.test.ts` (+9 tests + factories) |
| `ef3b8f0` | feat | quick-260417-phr | `useTimeline.ts` (emission logic: classifier import + status derivation) |
| `2bb2751` | feat | quick-260417-phr | `ConversationTimeline.vue` (icon import, iconConfig branches, pulse gate) |

## Files Modified

- `packages/frontend/src/composables/useTimeline.ts` — extended `TimelineEvent` with 3 optional fields; imported `classifyGhostState`; populated status + projection fields at subagent emission site
- `packages/frontend/tests/composables/useTimeline.test.ts` — added `ToolCallRow`/`SubagentSummary` type imports, `makeAssistantGroupWithSubagent` + `makeSubagentSummary` factories, and 9 new test cases in a new `describe('extractTimelineEvents -- subagent status')` block
- `packages/frontend/src/components/ConversationTimeline.vue` — extended lucide-vue-next import with 4 status icons; replaced `iconConfig` with nested status switch; broadened pulse class-binding

## Test Counts

| File | Before | After | Delta |
|------|--------|-------|-------|
| `tests/composables/useTimeline.test.ts` | 15 | 24 | +9 |
| `tests/utils/ghost-card-state.test.ts` | 8 | 8 | unchanged (no edits to classifier) |
| **Combined** | **23** | **32** | **+9** |

## Verification Results

| Command | Result |
|---------|--------|
| `npx vue-tsc --noEmit` (frontend) | PASS — exit 0, zero errors |
| `npx vitest run tests/composables/useTimeline.test.ts` | PASS — 24/24 (15 existing + 9 new) |
| `npx vitest run tests/composables/useTimeline.test.ts tests/utils/ghost-card-state.test.ts` | PASS — 32/32 |
| RED-gate at commit `79ebcf2` | CONFIRMED — 8/9 new tests failed (test 9 is control, trivially passes because non-subagent events already lack `status`) |
| GREEN-gate at commit `ef3b8f0` | CONFIRMED — all 9 new tests pass |

## Grep Sanity Checks

| Pattern | File | Matches |
|---------|------|---------|
| `classifyGhostState` | `src/composables/useTimeline.ts` | 3 (import L3, comment L65, call-site L72) |
| `CheckCircle2\|XCircle\|AlertTriangle\|HelpCircle` | `src/components/ConversationTimeline.vue` | 6 (import L42 + 5 case branches — AlertTriangle used twice for interrupted + missing) |
| `pulse-icon` | `src/components/ConversationTimeline.vue` | 2 (class-binding L23, CSS rule L99) |

All expectations met. (Plan predicted 2/4+/2 respectively; 3/6/2 observed — higher counts reflect the documented design of reusing `AlertTriangle` for both `interrupted` and `missing`.)

## Deviations from Plan

### Environment deviations (Rule 3 — blocking, auto-fixed)

**1. Worktree needed hard-reset + pnpm install**
- **Found during:** Startup `<worktree_branch_check>`.
- **Issue:** Worktree HEAD pointed at `c8a48ff` (ahead of required base `6ea23f8`); also had no `node_modules` so `npx vitest` could not resolve `@vitejs/plugin-vue`.
- **Fix:** Hard-reset to `6ea23f8` per the instruction; ran `pnpm install --frozen-lockfile` at root and `packages/frontend` to populate symlink tree.
- **Files modified:** none — environment-only.

### Code deviations

None. Plan executed exactly as written.

### Expected RED gate behaviour note

Plan text at line 349 reads "All new tests MUST fail." In practice only 8 of the 9 tests fail in RED, because Test 9 (non-subagent events have `status === undefined`) is a control/regression guard — `undefined` is both the expected RED value (no emission-site changes yet) and the expected GREEN value (emission logic only writes `status` on subagent events). This is not a deviation; it is the intended semantic of the control test. Both RED and GREEN gates were still visible in the run logs (8 distinct failures disappeared between `79ebcf2` and `ef3b8f0`).

## Known Stubs

None. All status branches wire to real icon components and classify via real derivation logic; no placeholder/TODO values introduced.

## TDD Gate Compliance

- RED commit exists: `79ebcf2` (`test(quick-260417-phr): ...`)
- GREEN commit exists after RED: `ef3b8f0` (`feat(quick-260417-phr): ...`)
- REFACTOR: not needed (emission-site change was already minimal; no cleanup opportunity uncovered)
- Gate sequence verified in `git log` on branch `worktree-agent-a9e655ff`.

## Self-Check

- [x] `useTimeline.ts` exists and contains `classifyGhostState` import + call (verified via Grep)
- [x] `useTimeline.test.ts` exists and contains 9 new subagent-status cases (verified via test run — 24 total)
- [x] `ConversationTimeline.vue` exists and contains 4 new icon imports + 5 status branches + broadened pulse gate (verified via Grep)
- [x] Commit `79ebcf2` exists in `git log`
- [x] Commit `ef3b8f0` exists in `git log`
- [x] Commit `2bb2751` exists in `git log`
- [x] `vue-tsc --noEmit` exits 0
- [x] All 32 targeted tests pass
- [x] Zero edits to IMPR-2/IMPR-4-owned files (ConversationDetailPage.vue, SubagentSummaryCard.vue, ToolCallRow.vue, AssistantGroupCard.vue) — confirmed via `git diff --stat HEAD~3..HEAD`

## Self-Check: PASSED
