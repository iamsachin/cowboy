---
phase: 11-core-collapsible-ui
plan: 02
subsystem: ui
tags: [vue, collapsible, turncard, toolcallrow, progressive-disclosure, lucide]

requires:
  - phase: 11-core-collapsible-ui
    provides: useCollapseState composable, turn-helpers (getPreviewSnippet, calculateDuration, truncateOutput)
  - phase: 10-data-grouping-foundation
    provides: AssistantTurn/Turn types, groupTurns algorithm, TurnCard/ToolCallRow components
provides:
  - Collapsible TurnCard with summary header (model badge, tool count, duration, timestamp, preview snippet)
  - Expandable ToolCallRow with I/O JSON detail, truncation, and copy-to-clipboard
affects: [11-03-conversation-integration]

tech-stack:
  added: []
  patterns: [props-controlled-collapse, details-summary-expansion, copy-to-clipboard-feedback]

key-files:
  created: []
  modified:
    - packages/frontend/src/components/TurnCard.vue
    - packages/frontend/src/components/ToolCallRow.vue
    - packages/frontend/src/components/ConversationDetail.vue

key-decisions:
  - "Props-controlled collapse: TurnCard receives expanded boolean and emits toggle, parent manages state"
  - "Native details/summary for ToolCallRow I/O expansion, matching existing thinking section pattern"
  - "ConversationDetail temporarily wired with expanded=true for type safety until Plan 03 integrates properly"

patterns-established:
  - "Two-level progressive disclosure: TurnCard (level 1, parent-controlled) + ToolCallRow details (level 2, local)"
  - "Copy button pattern: absolute positioned, opacity-0 group-hover:opacity-100, Check icon feedback for 1.5s"

requirements-completed: [GROUP-03, GROUP-04, GROUP-05, GROUP-06]

duration: 3min
completed: 2026-03-05
---

# Phase 11 Plan 02: Collapsible Turn Card and Tool Call Row Summary

**TurnCard with collapsed/expanded summary header and ToolCallRow with expandable I/O JSON detail, copy buttons, and output truncation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T06:12:56Z
- **Completed:** 2026-03-05T06:16:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- TurnCard refactored with two-state UI: collapsed summary header (model, tool count, duration, timestamp, preview) and expanded full content
- ToolCallRow enhanced with expandable I/O details using native details/summary element
- Copy-to-clipboard on input/output pre blocks with visual Check icon feedback
- Long output truncation at 20 lines with "Show full output" button

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor TurnCard with collapsed/expanded states and summary header** - `d4f5a43` (feat)
2. **Task 2: Add expandable I/O detail to ToolCallRow** - `dd4dd8d` (feat)

## Files Created/Modified
- `packages/frontend/src/components/TurnCard.vue` - Collapsible assistant turn card with summary header, chevron rotation, props-controlled state
- `packages/frontend/src/components/ToolCallRow.vue` - Expandable tool call row with I/O JSON pre blocks, copy buttons, output truncation
- `packages/frontend/src/components/ConversationDetail.vue` - Temporary expanded=true prop for type safety

## Decisions Made
- TurnCard collapse is props-controlled (expanded boolean + toggle emit) rather than internal state -- parent manages via useCollapseState
- Used native details/summary for ToolCallRow I/O expansion, consistent with existing thinking section pattern
- ConversationDetail temporarily passes expanded=true to keep TypeScript clean; Plan 03 will wire useCollapseState properly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added temporary expanded prop to ConversationDetail**
- **Found during:** Task 1 (TurnCard refactor)
- **Issue:** Adding required `expanded` prop to TurnCard broke ConversationDetail.vue type check
- **Fix:** Temporarily pass `:expanded="true"` and `@toggle="() => {}"` in ConversationDetail
- **Files modified:** packages/frontend/src/components/ConversationDetail.vue
- **Verification:** vue-tsc --noEmit passes cleanly
- **Committed in:** d4f5a43 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal -- temporary shim ensures type safety. Plan 03 will replace with proper integration.

## Issues Encountered
- Pre-existing router test failure (expected 6 named routes, got 8) -- unrelated to this plan's changes, confirmed by testing on prior commit

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TurnCard and ToolCallRow are fully refactored and ready for Plan 03 integration
- ConversationDetail needs proper useCollapseState wiring (replace temporary expanded=true)
- All turn-helper imports verified working in both components

---
*Phase: 11-core-collapsible-ui*
*Completed: 2026-03-05*
