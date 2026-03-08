---
phase: 19-conversation-display-fixes
plan: 01
subsystem: ui
tags: [vitest, tdd, content-sanitizer, groupTurns, turn-grouping]

requires:
  - phase: 12-token-enrichment
    provides: "groupTurns composable and content-sanitizer utilities"
provides:
  - "Fixed isSystemInjected that correctly handles null/empty content"
  - "Skill prompt detection for 'Base directory for this skill:' pattern"
  - "groupTurns that preserves assistant groups across system-injected messages"
affects: [19-02, 19-03, conversation-display]

tech-stack:
  added: []
  patterns: ["Null-guard returns false (not true) for content classification functions"]

key-files:
  created:
    - packages/frontend/tests/utils/content-sanitizer.test.ts
  modified:
    - packages/frontend/src/utils/content-sanitizer.ts
    - packages/frontend/src/composables/useGroupedTurns.ts
    - packages/frontend/tests/composables/useGroupedTurns.test.ts

key-decisions:
  - "System-injected messages between assistant turns accumulate in pendingSystem without flushing the assistant group"
  - "flushSystem only called on assistant arrival when no pending assistant group exists"

patterns-established:
  - "Null/empty content returns false from classification functions (safe default: show message)"

requirements-completed: [CONV-01, CONV-05, CONV-06, CONV-08]

duration: 3min
completed: 2026-03-08
---

# Phase 19 Plan 01: Conversation Display Fixes Summary

**Fixed turn grouping to prevent system messages from splitting assistant groups, corrected null/empty content classification, and added skill prompt detection**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T09:31:03Z
- **Completed:** 2026-03-08T09:33:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- CONV-08: isSystemInjected now returns false for null/empty/whitespace content, preventing real messages from being hidden
- CONV-05: Added detection for "Base directory for this skill:" prefix as system-injected content
- CONV-01: Removed flushAssistant() call in system-injected branch so system messages between assistant turns don't break grouping
- CONV-06: System messages appear AFTER assistant groups (natural consequence of CONV-01 fix)
- Added 9 unit tests for content-sanitizer and 4 new tests for CONV-01 grouping scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix isSystemInjected and add content-sanitizer tests** - `0fde6ae` (fix, TDD)
2. **Task 2: Fix groupTurns system-message-breaks-assistant-group bug** - `13611eb` (fix, TDD)

## Files Created/Modified
- `packages/frontend/tests/utils/content-sanitizer.test.ts` - New test file: 9 tests covering CONV-05, CONV-08, and existing behavior
- `packages/frontend/src/utils/content-sanitizer.ts` - Fixed null/empty returns to false; added skill prompt pattern
- `packages/frontend/src/composables/useGroupedTurns.ts` - Removed flushAssistant from system-injected branch; conditional flushSystem in assistant branch
- `packages/frontend/tests/composables/useGroupedTurns.test.ts` - Added 4 CONV-01 test cases for system messages between assistant turns

## Decisions Made
- System-injected messages between assistant turns accumulate in pendingSystem without flushing the assistant group -- simplest fix with correct behavior
- flushSystem is only called on assistant message arrival when there is no pending assistant group (prevents premature system-group creation mid-group)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] flushSystem in assistant branch caused premature system group creation**
- **Found during:** Task 2 (groupTurns fix)
- **Issue:** Plan only mentioned removing flushAssistant() from system-injected branch, but the assistant branch's flushSystem() call also caused system messages to appear before (not after) the assistant group
- **Fix:** Added conditional: only call flushSystem() in assistant branch when pendingAssistant is empty
- **Files modified:** packages/frontend/src/composables/useGroupedTurns.ts
- **Verification:** All 37 relevant tests pass
- **Committed in:** 13611eb (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for correctness -- without this fix, system messages would appear before assistant groups instead of after.

## Issues Encountered
- Pre-existing test failure in tests/app.test.ts (route count assertion expects 6, finds 8) -- unrelated to our changes, logged to deferred-items.md

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Content sanitizer and groupTurns logic are solid with comprehensive test coverage
- Ready for 19-02 (additional conversation display fixes)

---
*Phase: 19-conversation-display-fixes*
*Completed: 2026-03-08*
