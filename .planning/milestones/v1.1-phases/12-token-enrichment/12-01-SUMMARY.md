---
phase: 12-token-enrichment
plan: 01
subsystem: api
tags: [drizzle, sqlite, token-usage, per-message, cost-calculation]

requires:
  - phase: 04-conversation-detail
    provides: ConversationDetailResponse type and getConversationDetail query
provides:
  - MessageTokenUsage interface exported from @cowboy/shared
  - tokenUsageByMessage map on ConversationDetailResponse with per-message token counts and cost
affects: [12-02, frontend-turn-card-token-display]

tech-stack:
  added: []
  patterns: [per-message SUM GROUP BY aggregation with calculateCost per row]

key-files:
  created: []
  modified:
    - packages/shared/src/types/api.ts
    - packages/shared/src/types/index.ts
    - packages/backend/src/db/queries/analytics.ts
    - packages/backend/tests/fixtures/seed-analytics.ts
    - packages/backend/tests/analytics/conversation-detail.test.ts

key-decisions:
  - "SUM GROUP BY messageId aggregation (not LIMIT 1) to handle multiple tokenUsage rows per message"
  - "Filter WHERE messageId IS NOT NULL to exclude orphan tokenUsage records"
  - "Reordered seed fixture inserts: messages before tokenUsage for FK constraint compliance"

patterns-established:
  - "Per-message token pattern: query tokenUsage grouped by messageId, build Record<string, MessageTokenUsage> map"

requirements-completed: [META-01, META-02]

duration: 5min
completed: 2026-03-05
---

# Phase 12 Plan 01: Per-Message Token Data Summary

**Per-message token aggregation (input, output, cacheRead, cacheCreation, cost) via SUM GROUP BY messageId on conversation detail API**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T08:51:48Z
- **Completed:** 2026-03-05T08:56:52Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 5

## Accomplishments
- Added MessageTokenUsage interface and tokenUsageByMessage field to ConversationDetailResponse
- Implemented per-message token aggregation query with SUM GROUP BY messageId in getConversationDetail()
- Server-side cost calculation per message using existing calculateCost(), null for unknown models
- Updated seed fixtures with messageId FK on tokenUsage records
- All 14 conversation-detail tests pass (5 new + 9 existing)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for per-message token data** - `cfbc1c4` (test)
2. **Task 1 GREEN: Implement per-message token query + seed updates** - `1a6ca1f` (feat)

## Files Created/Modified
- `packages/shared/src/types/api.ts` - Added MessageTokenUsage interface and tokenUsageByMessage to ConversationDetailResponse
- `packages/shared/src/types/index.ts` - Re-exported MessageTokenUsage from @cowboy/shared
- `packages/backend/src/db/queries/analytics.ts` - Added per-message token aggregation query with cost calculation
- `packages/backend/tests/fixtures/seed-analytics.ts` - Added messageId to tokenUsage records, reordered inserts for FK
- `packages/backend/tests/analytics/conversation-detail.test.ts` - Added 5 tests for tokenUsageByMessage

## Decisions Made
- Used SUM GROUP BY messageId aggregation to correctly handle multiple tokenUsage rows per message (per research pitfall #2)
- Filtered WHERE messageId IS NOT NULL to exclude orphan tokenUsage records without message association (per research pitfall #1)
- Reordered seed fixture inserts (messages before tokenUsage) to satisfy FK constraints after adding messageId references

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed seed fixture FK constraint violation**
- **Found during:** Task 1 GREEN phase
- **Issue:** Adding messageId to tokenUsage seed records created FK constraint failures because tokenUsage was inserted before messages
- **Fix:** Reordered seed inserts: conversations -> messages -> tokenUsage -> toolCalls
- **Files modified:** packages/backend/tests/fixtures/seed-analytics.ts
- **Verification:** All 303 tests pass (304 total, 1 pre-existing flaky file-watcher test)
- **Committed in:** 1a6ca1f (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential fix for test correctness. No scope creep.

## Issues Encountered
None beyond the FK ordering issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- tokenUsageByMessage map available on ConversationDetailResponse for Plan 02 frontend integration
- TurnCard components can look up per-message token usage by messageId key

---
*Phase: 12-token-enrichment*
*Completed: 2026-03-05*
