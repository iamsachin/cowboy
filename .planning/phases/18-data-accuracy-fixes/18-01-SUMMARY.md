---
phase: 18-data-accuracy-fixes
plan: 01
subsystem: ingestion, ui
tags: [cursor, timestamps, duration, turn-count, model-backfill]

requires:
  - phase: 17-cost-calculation-fixes
    provides: "Cost calculation and display infrastructure"
provides:
  - "Timestamp 0 fallback to Date.now() in Cursor parser and normalizer"
  - "Duration computed from first/last message instead of metadata timestamps"
  - "Accurate turn count label (assistant groups)"
  - "NULL-model backfill for all agents with message-based fallback"
affects: [24-browser-verification]

tech-stack:
  added: []
  patterns: [message-span-duration, agent-agnostic-migration]

key-files:
  created: []
  modified:
    - packages/backend/src/ingestion/cursor-parser.ts
    - packages/backend/src/ingestion/cursor-normalizer.ts
    - packages/frontend/src/pages/ConversationDetailPage.vue
    - packages/backend/src/db/queries/analytics.ts
    - packages/shared/src/types/api.ts
    - packages/frontend/src/components/ConversationDetail.vue
    - packages/backend/src/ingestion/migration.ts

key-decisions:
  - "Duration from message span via backend firstMessageAt/lastMessageAt fields rather than frontend full-array sort"
  - "NULL-model backfill expanded to all agents, not just claude-code"

patterns-established:
  - "Message span duration: use first/last message timestamps from backend rather than conversation metadata"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04]

duration: 2min
completed: 2026-03-08
---

# Phase 18 Plan 01: Data Accuracy Fixes Summary

**Timestamp 0 fallback, message-span duration, accurate turn labels, and agent-agnostic NULL-model backfill**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08T09:02:37Z
- **Completed:** 2026-03-08T09:04:48Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Cursor conversations no longer produce Jan 1 1970 dates (timestamp 0 replaced with Date.now())
- Duration on conversation detail page shows actual message span (first to last message)
- Turn count label accurately says "N assistant groups" instead of misleading "N turns"
- NULL-model conversations get backfilled from token_usage for all agents, with fallback to assistant message models

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Cursor timestamp 0 fallback and duration calculation** - `f73f973` (fix)
2. **Task 2: Fix turn count label and NULL-model backfill** - `ac85e10` (fix)

## Files Created/Modified
- `packages/backend/src/ingestion/cursor-parser.ts` - Use Date.now() fallback instead of 0 for missing timestamps
- `packages/backend/src/ingestion/cursor-normalizer.ts` - Treat timestamp 0 as missing in normalization
- `packages/frontend/src/pages/ConversationDetailPage.vue` - Duration from messageDuration computed property
- `packages/backend/src/db/queries/analytics.ts` - Added firstMessageAt/lastMessageAt to detail response
- `packages/shared/src/types/api.ts` - Extended ConversationDetailResponse with message timestamp fields
- `packages/frontend/src/components/ConversationDetail.vue` - Label says "assistant groups" not "turns"
- `packages/backend/src/ingestion/migration.ts` - Agent-agnostic NULL model backfill with message fallback

## Decisions Made
- Duration computed via backend firstMessageAt/lastMessageAt fields rather than sorting full messages array in frontend (more efficient)
- NULL-model backfill expanded to all agents (not just claude-code) since token_usage table already has correct models regardless of agent

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data accuracy fixes for timestamps, duration, turn count, and model attribution are complete
- Ready for remaining 18-02 and 18-03 plans

## Self-Check: PASSED

- All 7 modified files exist on disk
- Commit f73f973 (Task 1) verified in git log
- Commit ac85e10 (Task 2) verified in git log

---
*Phase: 18-data-accuracy-fixes*
*Completed: 2026-03-08*
