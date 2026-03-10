---
phase: 33-realtime-conversation-discovery
plan: 01
subsystem: ui
tags: [websocket, debounce, vue-composables, realtime]

requires:
  - phase: 31-websocket-infrastructure
    provides: useWebSocket composable with on() subscription API
  - phase: 32-realtime-conversation-detail
    provides: loading/refreshing ref pattern, scroll tracking composables
provides:
  - Debounced WS refetch (500ms) on all 3 list/analytics composables
  - newIds tracking for new-row highlight in conversation lists
  - Separate loading/refreshing refs for live-update UX
affects: [33-02-realtime-conversation-discovery-ui]

tech-stack:
  added: []
  patterns: [debounced-ws-refetch, new-row-id-tracking, loading-refreshing-separation]

key-files:
  created:
    - packages/frontend/tests/composables/useConversations.test.ts
    - packages/frontend/tests/composables/useConversationBrowser.test.ts
  modified:
    - packages/frontend/src/composables/useConversations.ts
    - packages/frontend/src/composables/useConversationBrowser.ts
    - packages/frontend/src/composables/useAnalytics.ts

key-decisions:
  - "500ms debounce window coalesces burst WS events into single API call"
  - "previousIds starts empty; initial load populates it without marking rows as new"
  - "newIds auto-clears after 2000ms to support transient highlight animation"

patterns-established:
  - "debouncedWsRefetch: 500ms setTimeout pattern with clearTimeout on scope dispose"
  - "trackNewRows: previousIds/newIds Set comparison with auto-clear timer"

requirements-completed: [PUSH-04, PUSH-05]

duration: 4min
completed: 2026-03-10
---

# Phase 33 Plan 01: Composable Logic Core Summary

**Debounced 500ms WS refetch with newIds row tracking on useConversations, useConversationBrowser, and useAnalytics**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T12:55:21Z
- **Completed:** 2026-03-10T12:59:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- All 3 composables now debounce WS events at 500ms, preventing API floods during rapid agent activity
- Both list composables expose newIds (Set of conversation IDs new since last fetch) for UI highlight
- Separate loading/refreshing refs prevent full-page spinner on live updates
- Page state preserved during WS-triggered refetches (user stays on current page)
- 11 new unit tests covering debounce, page preservation, newIds tracking, and cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for WS refetch + newIds** - `a288226` (test)
2. **Task 1 (GREEN): Implement debounced WS refetch + newIds in useConversations and useConversationBrowser** - `b75b6ed` (feat)
3. **Task 2: Add debounced WS refetch to useAnalytics** - `95c8f6f` (feat)

_Note: Task 1 used TDD flow (RED -> GREEN commits)_

## Files Created/Modified
- `packages/frontend/tests/composables/useConversations.test.ts` - 7 unit tests for WS subscription, debounce, newIds, refreshing
- `packages/frontend/tests/composables/useConversationBrowser.test.ts` - 4 unit tests for debounce, newIds, cleanup
- `packages/frontend/src/composables/useConversations.ts` - Added WS subscription, debouncedWsRefetch, newIds/refreshing, trackNewRows
- `packages/frontend/src/composables/useConversationBrowser.ts` - Replaced naive WS handlers with debounced version, added newIds/refreshing
- `packages/frontend/src/composables/useAnalytics.ts` - Replaced naive WS handlers with debounced version, added refreshing

## Decisions Made
- 500ms debounce window chosen to coalesce burst WS events into single API call (matches plan spec)
- previousIds starts empty; initial load populates it without marking rows as new (prevents flash)
- newIds auto-clears after 2000ms to support transient highlight animation in UI layer

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Composable logic complete; UI layer (33-02) can consume newIds, refreshing from both list composables
- useAnalytics.refreshing available for subtle loading indicator on dashboard KPIs

---
*Phase: 33-realtime-conversation-discovery*
*Completed: 2026-03-10*
