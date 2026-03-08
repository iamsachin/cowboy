---
phase: 16-message-display
plan: 01
subsystem: ui
tags: [vue, typescript, vitest, tdd, composables, content-sanitizer]

requires: []
provides:
  - SystemGroup turn type for consecutive system-injected user messages
  - SlashCommandTurn turn type with extracted command text
  - ClearDividerTurn turn type for /clear commands
  - classifySystemMessage() helper returning SystemMessageCategory
  - Extended groupTurns() that accepts unfiltered messages including system content
affects:
  - 16-02-message-display (renders new GroupedTurn types in ConversationDetail.vue)

tech-stack:
  added: []
  patterns:
    - "pendingSystem accumulator in groupTurns mirrors pendingAssistant pattern for consecutive grouping"
    - "classifySystemMessage examines XML tag patterns in content to assign category labels"
    - "TDD RED-GREEN flow: write failing tests first, then implement to pass"

key-files:
  created: []
  modified:
    - packages/frontend/src/composables/useGroupedTurns.ts
    - packages/frontend/tests/composables/useGroupedTurns.test.ts

key-decisions:
  - "Existing tests that checked for 'assistant' type were updated to 'assistant-group' — the implementation always produces groups, even for single assistant messages"
  - "System message detection order: isClearCommand checked before isSlashCommand, isSlashCommand checked before isSystemInjected (mirrors content-sanitizer.ts precedence)"
  - "pendingSystem is flushed when any non-system user message arrives (clear, slash, or regular), matching the grouping semantics of pendingAssistant"

patterns-established:
  - "Turn type discrimination: use type literals ('system-group', 'slash-command', 'clear-divider') for exhaustive switch in Vue template"
  - "classifySystemMessage: priority-ordered regex matching against XML tag patterns"

requirements-completed: [MSG-01, MSG-02]

duration: 2min
completed: 2026-03-05
---

# Phase 16 Plan 01: Message Display Summary

**Extended useGroupedTurns with SystemGroup, SlashCommandTurn, and ClearDividerTurn turn types using TDD, enabling the UI layer to render system-injected content instead of filtering it**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-05T13:32:07Z
- **Completed:** 2026-03-05T13:34:17Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Added `SystemMessageCategory` union type and `classifySystemMessage()` helper that pattern-matches XML tags to return 'system-reminder' | 'objective' | 'skill-instruction' | 'system-caveat' | 'other'
- Added `SystemGroup`, `SlashCommandTurn`, and `ClearDividerTurn` interfaces to the GroupedTurn union
- Extended `groupTurns()` with a `pendingSystem` accumulator that merges consecutive system-injected messages into a single `SystemGroup` with per-message category labels
- Updated 24 tests (10 fixed from pre-existing failures, 14 new) covering all classification and grouping scenarios

## Task Commits

1. **RED: Failing tests for system message grouping** - `e7a5019` (test)
2. **GREEN: Implementation of new turn types** - `f4f92f0` (feat)

## Files Created/Modified

- `packages/frontend/src/composables/useGroupedTurns.ts` - Extended with SystemGroup/SlashCommandTurn/ClearDividerTurn types, classifySystemMessage helper, and updated groupTurns logic
- `packages/frontend/tests/composables/useGroupedTurns.test.ts` - Fixed 5 pre-existing test failures (assistant-group assertion updates) and added 14 new tests for new turn types

## Decisions Made

- Updated existing tests that checked `type === 'assistant'` to `type === 'assistant-group'` — the current implementation has always wrapped single assistant turns into groups; the old assertions were stale from a prior version
- `/clear` is checked before generic slash commands, which is before system injection — mirrors the precedence already established in `content-sanitizer.ts`
- `pendingSystem` is flushed when any non-system user message or assistant message arrives, ensuring system groups are tightly bound to the content that follows them

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 5 pre-existing test failures in existing groupTurns suite**
- **Found during:** TDD RED phase setup (baseline run)
- **Issue:** Existing tests checked `result[0].type === 'assistant'` but `groupTurns` already merged single assistant turns into `assistant-group`. These 5 tests had been failing before this plan.
- **Fix:** Updated assertions to check `'assistant-group'` and access `.turns[0]` for inner turn data
- **Files modified:** packages/frontend/tests/composables/useGroupedTurns.test.ts
- **Verification:** All 10 original tests now pass
- **Committed in:** e7a5019 (RED commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - pre-existing test correctness bug)
**Impact on plan:** Necessary fix to establish a valid baseline before adding new tests. No scope creep.

## Issues Encountered

None beyond the pre-existing test failures documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `GroupedTurn` union now includes `SystemGroup | SlashCommandTurn | ClearDividerTurn`
- Plan 16-02 can render these types in `ConversationDetail.vue` with distinct UI components
- `classifySystemMessage()` exported for use in UI components that need category-based labels/colors

---
*Phase: 16-message-display*
*Completed: 2026-03-05*
