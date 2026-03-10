---
phase: 35-conversation-timeline
plan: 02
subsystem: ui
tags: [vue, timeline, IntersectionObserver, scroll-sync, two-column-layout]

# Dependency graph
requires:
  - phase: 35-conversation-timeline
    provides: useTimeline composable, ConversationTimeline.vue component, TimelineEvent type
  - phase: 32-live-conversation-detail
    provides: ConversationDetail.vue, useScrollTracker, useGroupedTurns
provides:
  - Two-column layout with collapsible timeline panel on conversation detail page
  - Click-to-scroll navigation with lazy-load and auto-expand support
  - IntersectionObserver-based active event tracking synced with scroll position
  - Timeline panel auto-scroll to keep highlighted event visible
  - Smart auto-scroll for new events (only when user is at bottom)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [IntersectionObserver scroll tracking, dual useScrollTracker for independent scroll containers, captureScrollPosition for layout-shift preservation]

key-files:
  created: []
  modified:
    - packages/frontend/src/pages/ConversationDetailPage.vue
    - packages/frontend/src/components/ConversationDetail.vue

key-decisions:
  - "Used dual useScrollTracker instances: one for main scroll container (position preservation) and one for timeline panel (auto-scroll gating)"
  - "IntersectionObserver with threshold 0.1 on scroll container root for active event detection"
  - "Timeline panel uses block:nearest scrollIntoView to minimize jarring movement when active event changes"

patterns-established:
  - "Dual scroll tracker pattern: separate useScrollTracker instances for independent scroll containers with different behaviors"
  - "Layout-shift preservation: captureScrollPosition before toggle, restore after nextTick, then re-setup observer"

requirements-completed: [TIME-01, TIME-02, TIME-03]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 35 Plan 02: Timeline Integration Summary

**Two-column layout with collapsible timeline panel, click-to-scroll navigation (load-more + auto-expand), IntersectionObserver active tracking, and dual scroll-container auto-scroll behavior**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T16:24:20Z
- **Completed:** 2026-03-10T16:27:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Two-column flex layout with 220px timeline panel that collapses to centered single-column
- Toggle button in metadata header with PanelRight icon, scroll position preserved on layout shift
- Click-to-scroll navigation that handles lazy-load boundary (loadUpTo) and collapsed groups (expandGroup)
- IntersectionObserver tracks visible turns and highlights topmost in timeline event order
- Timeline panel auto-scrolls to keep the highlighted event in view (block:nearest)
- New events auto-scroll timeline panel only when user was already at bottom (isTimelineAtBottom)
- data-turn-key attributes on all turn wrappers and defineExpose on ConversationDetail

## Task Commits

Each task was committed atomically:

1. **Task 1: Add data-turn-key attributes and defineExpose to ConversationDetail.vue** - `2efebeb` (feat)
2. **Task 2: Integrate timeline into ConversationDetailPage with layout, scroll sync, and navigation** - `e16fd60` (feat)

## Files Created/Modified
- `packages/frontend/src/components/ConversationDetail.vue` - Added data-turn-key attribute on all turn wrappers, defineExpose with loadUpTo, expandGroup, turns
- `packages/frontend/src/pages/ConversationDetailPage.vue` - Two-column layout, timeline panel integration, IntersectionObserver, toggle handler, navigation handler, dual scroll trackers

## Decisions Made
- Used dual useScrollTracker instances: main container for scroll position preservation during toggle, timeline panel for gating auto-scroll on new events
- IntersectionObserver uses threshold 0.1 with scroll container as root, picks topmost visible key in timeline event order
- Timeline panel auto-scroll uses block:nearest to avoid jarring jumps when active event is already visible
- Re-observe all data-turn-key elements on timelineEvents change and after toggle (layout shift creates new DOM positions)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 35 conversation timeline feature is complete
- All requirements TIME-01, TIME-02, TIME-03 fulfilled
- Timeline integrates with existing WebSocket live updates automatically via reactive turns

---
*Phase: 35-conversation-timeline*
*Completed: 2026-03-10*
