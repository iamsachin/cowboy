---
phase: 32-realtime-conversation-detail
plan: 02
subsystem: ui
tags: [vue, scroll-tracking, animation, css, realtime, new-messages-pill]

# Dependency graph
requires:
  - phase: 32-realtime-conversation-detail
    plan: 01
    provides: "useConversationDetail with debounced refetch, useScrollTracker, newGroupKeys, isActive"
provides:
  - "Realtime conversation detail UX with auto-scroll, scroll preservation, and new messages pill"
  - "Fade-in animation for new message groups"
  - "Green pulse-dot indicator for active conversations in detail view"
  - "Pagination and collapse state preservation across live refetches"
affects: [33-realtime-dashboard, realtime-conversation-detail]

# Tech tracking
tech-stack:
  added: []
  patterns: [scroll-aware-auto-expand, css-fade-in-for-new-content, floating-pill-notification]

key-files:
  created:
    - packages/frontend/src/components/NewMessagesPill.vue
  modified:
    - packages/frontend/src/components/ConversationDetail.vue
    - packages/frontend/src/pages/ConversationDetailPage.vue

key-decisions:
  - "NewMessagesPill uses fixed positioning with z-50 for viewport-anchored floating pill"
  - "Pagination auto-expands when user is at bottom to show new messages without manual interaction"
  - "Fade-in animation uses CSS-only approach (200ms ease-out) keyed on newGroupKeys set"

patterns-established:
  - "Scroll-aware auto-expand: when at bottom, visibleCount tracks total to show all new content"
  - "CSS fade-in for new content: class toggled by reactive Set, animation completes naturally"

requirements-completed: [PUSH-01, PUSH-03]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 32 Plan 02: Realtime Conversation Detail UI Summary

**Scroll-aware live message display with auto-scroll, new messages pill, fade-in animations, and green pulse-dot for active conversations**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T12:28:00Z
- **Completed:** 2026-03-10T12:32:11Z
- **Tasks:** 3 (2 auto + 1 checkpoint verified)
- **Files modified:** 3

## Accomplishments
- ConversationDetail.vue integrates useScrollTracker for auto-scroll when at bottom and position preservation when scrolled up
- NewMessagesPill.vue provides floating notification pill with count and click-to-scroll-to-bottom
- Fade-in CSS animation on new message groups using newGroupKeys set from composable
- Green pulse-dot in ConversationDetailPage metadata header for active conversations
- Pagination resets only on conversation ID change (not live message arrival), preserving expanded state
- Dev-mode duplicate message ID detection via watchEffect console.warn

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate scroll tracking, pagination fix, fade-in, and new messages pill** - `021b3dc` (feat)
2. **Task 2: Add green pulse-dot and wire composable outputs into page** - `bf42bf9` (feat)
3. **Task 3: Verify realtime conversation detail UX** - checkpoint (human-verify, approved)

## Files Created/Modified
- `packages/frontend/src/components/NewMessagesPill.vue` - Floating pill showing new message count with click-to-scroll
- `packages/frontend/src/components/ConversationDetail.vue` - Scroll tracking integration, auto-expand pagination, fade-in animation, scroll preservation
- `packages/frontend/src/pages/ConversationDetailPage.vue` - Green pulse-dot for active conversations, wired newGroupKeys/conversationId props, dev-mode duplicate detection

## Decisions Made
- NewMessagesPill uses fixed bottom-center positioning (z-50) with DaisyUI btn-primary styling
- Pagination auto-expands visibleCount when user is at bottom so new messages are never hidden behind "load more"
- Fade-in uses pure CSS animation (no JS cleanup needed) since newGroupKeys set refreshes on each refetch
- Pulse-dot CSS duplicated in page component (6 lines, simpler than shared extraction per CONTEXT.md guidance)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full realtime conversation detail experience complete (composable logic + UI)
- Phase 32 complete, ready for Phase 33 (realtime dashboard)
- WebSocket event infrastructure (Phase 31) + conversation detail (Phase 32) provide foundation for dashboard live updates

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 32-realtime-conversation-detail*
*Completed: 2026-03-10*
