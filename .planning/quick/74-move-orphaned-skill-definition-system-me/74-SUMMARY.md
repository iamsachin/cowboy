---
phase: quick-74
plan: 01
subsystem: ui
tags: [vue, composable, system-messages, grouping]

requires:
  - phase: none
    provides: n/a
provides:
  - Skill-definition system message classification and inline rendering in AssistantGroupCard
affects: [useGroupedTurns, AssistantGroupCard, SystemMessageIndicator]

tech-stack:
  added: []
  patterns: [skill-definition messages attached to AssistantGroup rather than separate SystemGroup]

key-files:
  created: []
  modified:
    - packages/frontend/src/composables/useGroupedTurns.ts
    - packages/frontend/src/components/AssistantGroupCard.vue
    - packages/frontend/src/components/SystemMessageIndicator.vue
    - packages/frontend/tests/composables/useGroupedTurns.test.ts

key-decisions:
  - "Check 'Base directory for this skill:' before generic system-reminder pattern to ensure skill-definition takes priority"
  - "Only attach skill-definition messages to assistant group when pendingAssistant is non-empty; otherwise treat as regular SystemGroup"

patterns-established:
  - "Skill-definition classification: messages containing 'Base directory for this skill:' are routed to AssistantGroup.skillDefinitions"

requirements-completed: [QUICK-74]

duration: 3min
completed: 2026-04-06
---

# Quick Task 74: Move Orphaned Skill Definition System Messages Summary

**Skill-definition system messages now render inline inside AssistantGroupCard instead of as orphaned SystemGroup turns**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T13:21:42Z
- **Completed:** 2026-04-06T13:24:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added 'skill-definition' category to SystemMessageCategory type and classifySystemMessage function
- Skill-definition messages between assistant turns attach to AssistantGroup.skillDefinitions instead of creating separate SystemGroup
- AssistantGroupCard renders attached skill definitions via SystemMessageIndicator when expanded
- 3 new tests covering classification and grouping behavior, all 42 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add skill-definition category and attach to AssistantGroup** - `ce2129c` (feat, TDD)
2. **Task 2: Render skill definitions inline in AssistantGroupCard** - `15830e2` (feat)

## Files Created/Modified
- `packages/frontend/src/composables/useGroupedTurns.ts` - Added skill-definition category, classification logic, pendingSkillDefs accumulator, and AssistantGroup.skillDefinitions field
- `packages/frontend/src/components/AssistantGroupCard.vue` - Added skillDefGroup computed and SystemMessageIndicator rendering in expanded view
- `packages/frontend/src/components/SystemMessageIndicator.vue` - Added 'skill-definition' label to categoryLabels record
- `packages/frontend/tests/composables/useGroupedTurns.test.ts` - Added tests for skill-definition classification and grouping

## Decisions Made
- Moved skill-definition check before system-reminder in classifySystemMessage priority order, since skill-definition messages are often wrapped in system-reminder tags
- Used non-anchored regex `/Base directory for this skill:/m` to match content regardless of surrounding XML tags

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed classifySystemMessage priority order for skill-definition**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Plan placed skill-definition check before the final `return 'other'`, but system-reminder check matched first since skill-definition content is wrapped in `<system-reminder>` tags
- **Fix:** Moved skill-definition check to top of classifySystemMessage, before system-reminder check, and removed `^` anchor from regex to match within XML-wrapped content
- **Files modified:** packages/frontend/src/composables/useGroupedTurns.ts
- **Verification:** All 42 tests pass including new skill-definition tests
- **Committed in:** ce2129c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correct classification of skill-definition messages. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Feature complete and tested
- Manual verification recommended: open a conversation with skill definition system messages to confirm they appear inside the assistant group card

---
*Phase: quick-74*
*Completed: 2026-04-06*
