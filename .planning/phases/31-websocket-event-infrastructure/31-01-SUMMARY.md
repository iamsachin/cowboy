---
phase: 31-websocket-event-infrastructure
plan: 01
subsystem: api
tags: [websocket, fastify, typescript, discriminated-union, event-system]

# Dependency graph
requires: []
provides:
  - Shared WebSocket event type definitions (discriminated union)
  - Backend broadcastEvent decorator with monotonic sequence numbers
  - Ingestion diff tracking emitting typed conversation:changed and conversation:created events
  - Settings routes emitting system:full-refresh events
affects: [31-02-PLAN, frontend-composables, realtime-updates]

# Tech tracking
tech-stack:
  added: []
  patterns: [pre-post-snapshot-diff, distributive-omit-type, module-level-sequence-counter]

key-files:
  created:
    - packages/shared/src/types/websocket-events.ts
  modified:
    - packages/shared/src/types/index.ts
    - packages/backend/src/plugins/websocket.ts
    - packages/backend/src/ingestion/index.ts
    - packages/backend/src/app.ts
    - packages/backend/src/routes/settings.ts
    - packages/backend/tests/websocket.test.ts

key-decisions:
  - "Used WebSocketEventPayload distributive type instead of Omit<WebSocketEvent, 'seq'> to preserve discriminated union narrowing"
  - "Pre/post-transaction snapshot comparison for change detection avoids modifying transaction internals"
  - "Module-level sequence counter resets on server restart; frontend handles via reconnect reset"

patterns-established:
  - "WebSocketEventPayload type: use distributive union Omit to preserve discriminated union narrowing across all event types"
  - "Snapshot diff pattern: snapshot DB state before transaction, compare after commit to determine changes"
  - "broadcastEvent(payload): all WebSocket emissions go through typed decorator that injects monotonic seq"

requirements-completed: [PUSH-02]

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 31 Plan 01: Backend WebSocket Event Infrastructure Summary

**Typed WebSocket event system with discriminated union types, broadcastEvent decorator with sequence numbers, and ingestion diff tracking for conversation:changed/created events**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T11:29:49Z
- **Completed:** 2026-03-10T11:35:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Shared type definitions for all WebSocket events (ConversationChangedEvent, ConversationCreatedEvent, SystemFullRefreshEvent) with type guards
- Backend broadcastEvent decorator injecting monotonic sequence numbers on every event
- Ingestion diff tracking using pre/post-transaction snapshot comparison, detecting messages-added, tool-calls-added, tokens-updated, plan-updated, status-changed, and metadata-changed
- Complete migration from untyped data-changed broadcast to typed event emission across all backend code

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared event types and backend broadcastEvent decorator** - `1ad7053` (feat)
2. **Task 2: Ingestion diff tracking and event emission migration** - `9029c0f` (feat)

## Files Created/Modified
- `packages/shared/src/types/websocket-events.ts` - Discriminated union event types, ChangeType, type guards, WebSocketEventPayload
- `packages/shared/src/types/index.ts` - Re-exports all WebSocket event types
- `packages/backend/src/plugins/websocket.ts` - broadcastEvent decorator with module-level seq counter
- `packages/backend/src/ingestion/index.ts` - snapshotConversation() and trackChanges() for diff detection, collectedEvents array
- `packages/backend/src/app.ts` - onIngestionComplete callback iterates and broadcasts typed events
- `packages/backend/src/routes/settings.ts` - clear-db and refresh-db emit system:full-refresh
- `packages/backend/tests/websocket.test.ts` - Tests for typed events, sequence numbers, and monotonic ordering

## Decisions Made
- Used WebSocketEventPayload distributive type to preserve union narrowing (Omit on union types collapses the discriminant)
- Pre/post snapshot comparison approach for change detection keeps transaction code clean and ensures events only fire after commit
- Extracted snapshotConversation() and trackChanges() helpers shared between Claude Code and Cursor ingestion loops
- Migrated app.ts and settings.ts to broadcastEvent in Task 1 (ahead of plan) to ensure compilation passes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migrated app.ts and settings.ts callers in Task 1 instead of Task 2**
- **Found during:** Task 1 (verify step)
- **Issue:** Backend would not compile with broadcastEvent decorator if callers still referenced the removed broadcast decorator
- **Fix:** Moved the caller migration (app.ts and settings.ts) to Task 1 so type-checking passes
- **Files modified:** packages/backend/src/app.ts, packages/backend/src/routes/settings.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 1ad7053 (Task 1 commit)

**2. [Rule 1 - Bug] Added WebSocketEventPayload distributive type**
- **Found during:** Task 2 (type-checking)
- **Issue:** Omit<WebSocketEvent, 'seq'> collapses discriminated union, preventing typed event construction
- **Fix:** Created WebSocketEventPayload as explicit union of per-variant Omit types
- **Files modified:** packages/shared/src/types/websocket-events.ts, packages/shared/src/types/index.ts
- **Verification:** npx tsc --noEmit passes, events can be constructed with correct types
- **Committed in:** 9029c0f (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for compilation correctness. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend event infrastructure complete, ready for frontend composable migration (31-02)
- All event shapes defined and exported from shared package
- broadcastEvent decorator tested with sequence numbers
- No references to data-changed remain in backend source

---
*Phase: 31-websocket-event-infrastructure*
*Completed: 2026-03-10*
