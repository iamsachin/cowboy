---
phase: 31-websocket-event-infrastructure
plan: 02
subsystem: frontend
tags: [websocket, vue, composables, typed-events, event-routing]

# Dependency graph
requires:
  - phase: 31-01
    provides: Shared WebSocket event type definitions (discriminated union), backend broadcastEvent decorator
provides:
  - Typed event router useWebSocket with on(type, callback) API
  - Gap detection with automatic system:full-refresh
  - All 7 composables migrated to typed event subscriptions
  - Conversation-scoped smart refetch in useConversationDetail
affects: [32-incremental-frontend-updates, realtime-updates]

# Tech tracking
tech-stack:
  added: []
  patterns: [typed-event-routing, conversation-scoped-refetch, on-subscribe-pattern]

key-files:
  created: []
  modified:
    - packages/frontend/src/composables/useWebSocket.ts
    - packages/frontend/src/composables/useAnalytics.ts
    - packages/frontend/src/composables/useConversationBrowser.ts
    - packages/frontend/src/composables/usePlans.ts
    - packages/frontend/src/composables/useConversationDetail.ts
    - packages/frontend/src/composables/useAgentAnalytics.ts
    - packages/frontend/src/composables/useAdvancedAnalytics.ts
    - packages/frontend/src/composables/useAgentComparison.ts
    - packages/frontend/tests/composables/useWebSocket.test.ts

key-decisions:
  - "on() auto-cleans via onScopeDispose when in active scope, removing need for explicit cleanup"
  - "useConversationDetail uses string comparison for conversationId (not reactive ref) since it receives a plain string param"
  - "Tab visibility fires synthetic system:full-refresh to all listeners instead of generic callback"

patterns-established:
  - "on(type, callback) pattern: all composables subscribe to specific event types, not generic data-changed"
  - "Conversation-scoped refetch: detail composables filter events by conversationId before refetching"
  - "Synthetic system:full-refresh: gap detection and tab visibility both emit system:full-refresh to normalize catch-up behavior"

requirements-completed: [PUSH-02]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 31 Plan 02: Frontend WebSocket Event Router Summary

**Typed on(type, callback) event router in useWebSocket with gap detection, plus migration of all 7 composables to typed event subscriptions with conversation-scoped smart refetch**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T11:37:56Z
- **Completed:** 2026-03-10T11:41:44Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Refactored useWebSocket from flat onDataChanged to typed on(type, callback) event router with Map-based listener registry
- Added sequence gap detection that auto-fires system:full-refresh when events are missed
- Migrated all 7 consumer composables to typed event subscriptions (conversation:changed, conversation:created, system:full-refresh)
- useConversationDetail performs conversation-scoped refetch only when its specific conversationId matches the event
- Zero references to onDataChanged or data-changed remain in frontend source

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor useWebSocket to typed event router with gap detection** - `d785054` (feat)
2. **Task 2: Migrate all 7 composables to typed event subscriptions** - `3b8fcf6` (feat)

## Files Created/Modified
- `packages/frontend/src/composables/useWebSocket.ts` - Typed event router with on(), gap detection, seq tracking, visibility handler
- `packages/frontend/tests/composables/useWebSocket.test.ts` - 18 tests covering on() API, gap detection, reconnect reset, visibility, unsubscribe
- `packages/frontend/src/composables/useAnalytics.ts` - Migrated to on() typed events
- `packages/frontend/src/composables/useConversationBrowser.ts` - Migrated to on() typed events
- `packages/frontend/src/composables/usePlans.ts` - Migrated to on() typed events
- `packages/frontend/src/composables/useConversationDetail.ts` - Wired up with conversation-scoped on() subscriptions
- `packages/frontend/src/composables/useAgentAnalytics.ts` - Migrated to on() typed events
- `packages/frontend/src/composables/useAdvancedAnalytics.ts` - Migrated to on() typed events
- `packages/frontend/src/composables/useAgentComparison.ts` - Migrated to on() typed events

## Decisions Made
- on() auto-cleans via onScopeDispose when in active scope, so explicit onScopeDispose(unsubscribe) calls removed from consumers
- useConversationDetail takes conversationId as plain string (not ref), so comparison is direct string equality
- Tab visibility fires synthetic system:full-refresh with seq=0 to normalize catch-up behavior across gap detection and visibility changes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full typed WebSocket event infrastructure complete (backend + frontend)
- All composables subscribe to specific event types for smart refetch
- Ready for Phase 32 incremental frontend updates (delta merge into reactive state)

---
*Phase: 31-websocket-event-infrastructure*
*Completed: 2026-03-10*
