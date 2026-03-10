---
phase: 32-realtime-conversation-detail
plan: 01
subsystem: ui
tags: [vue, composables, websocket, debounce, scroll-tracking, vitest]

# Dependency graph
requires:
  - phase: 31-websocket-event-infrastructure
    provides: "Typed WebSocket event routing with on() pattern and auto-cleanup"
provides:
  - "useConversationDetail with debounced refetch and in-flight queue"
  - "useScrollTracker composable for scroll position management"
  - "isActive field on ConversationDetailResponse"
  - "previousGroupKeys/newGroupKeys for new group detection"
affects: [32-02-PLAN, realtime-conversation-detail]

# Tech tracking
tech-stack:
  added: []
  patterns: [debounced-refetch-with-in-flight-queue, scroll-position-capture-restore]

key-files:
  created:
    - packages/frontend/src/composables/useScrollTracker.ts
    - packages/frontend/tests/composables/useConversationDetail.test.ts
    - packages/frontend/tests/composables/useScrollTracker.test.ts
  modified:
    - packages/frontend/src/composables/useConversationDetail.ts
    - packages/shared/src/types/api.ts
    - packages/backend/src/db/queries/analytics.ts

key-decisions:
  - "Separate loading (initial) and refreshing (live) refs to avoid full-page spinner on live updates"
  - "Group key tracking uses groupTurns + turnKey for accurate new group detection"
  - "captureScrollPosition returns a restore function for caller-controlled timing"

patterns-established:
  - "Debounced refetch with in-flight queue: at most 1 fetch active + 1 queued"
  - "Scroll capture/restore: capture before data update, restore after nextTick"

requirements-completed: [PUSH-01, PUSH-03]

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 32 Plan 01: Composable Logic Core Summary

**Debounced refetch with in-flight queue for useConversationDetail, scroll position tracker, and isActive on detail API**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T12:14:09Z
- **Completed:** 2026-03-10T12:18:44Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- useConversationDetail debounces conversation:changed events by 500ms with at most 1 in-flight + 1 queued fetch
- useScrollTracker detects at-bottom state (100px threshold), preserves scroll position when scrolled up, auto-scrolls when at bottom
- isActive field added to ConversationDetailResponse type and backend query
- previousGroupKeys and newGroupKeys track genuinely new groups across refetches for fade-in animations (Plan 02)
- 16 unit tests covering debounce, queue, group tracking, scroll detection, and position preservation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add isActive to detail API + debounced refetch composable with tests** - `070e548` (feat)
2. **Task 2: Create useScrollTracker composable with tests** - `a1dbe82` (feat)

## Files Created/Modified
- `packages/shared/src/types/api.ts` - Added isActive field to ConversationDetailResponse
- `packages/backend/src/db/queries/analytics.ts` - Added isActive computation in getConversationDetail
- `packages/frontend/src/composables/useConversationDetail.ts` - Debounced refetch with in-flight queue, group key tracking, refreshing ref
- `packages/frontend/src/composables/useScrollTracker.ts` - Scroll position tracking with at-bottom detection, capture/restore, and scrollToBottom
- `packages/frontend/tests/composables/useConversationDetail.test.ts` - 8 tests for debounce, queue, group keys, and event filtering
- `packages/frontend/tests/composables/useScrollTracker.test.ts` - 8 tests for scroll detection, position preservation, and auto-scroll

## Decisions Made
- Separated `loading` (initial) and `refreshing` (live update) refs to avoid full-page spinner during live refetches
- Used groupTurns + turnKey to compute group keys for accurate new-vs-existing group detection
- captureScrollPosition returns a restore closure for caller-controlled timing (call after nextTick)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both composables ready for Plan 02 UI integration (ConversationDetail.vue)
- useConversationDetail exports previousGroupKeys/newGroupKeys for fade-in animation targeting
- useScrollTracker exports captureScrollPosition for scroll preservation during live updates
- isActive available in API response for green dot indicator

---
*Phase: 32-realtime-conversation-detail*
*Completed: 2026-03-10*
