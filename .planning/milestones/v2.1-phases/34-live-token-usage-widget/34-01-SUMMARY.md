---
phase: 34-live-token-usage-widget
plan: 01
subsystem: api
tags: [drizzle, sqlite, fastify, token-usage, analytics]

requires:
  - phase: none
    provides: none
provides:
  - TokenRatePoint shared type exported from @cowboy/shared
  - getTokenRate() query function with 60-minute rolling window
  - GET /api/analytics/token-rate Fastify endpoint
affects: [34-02, 34-03, frontend-token-widget]

tech-stack:
  added: []
  patterns: [strftime minute grouping for time-series aggregation, ISO timestamp normalization for SQLite datetime comparison]

key-files:
  created:
    - packages/backend/tests/analytics/token-rate.test.ts
  modified:
    - packages/shared/src/types/api.ts
    - packages/shared/src/types/index.ts
    - packages/backend/src/db/queries/analytics.ts
    - packages/backend/src/routes/analytics.ts

key-decisions:
  - "Used strftime ISO format comparison instead of SQLite datetime() to match stored ISO timestamps with T separator"

patterns-established:
  - "Token rate query pattern: direct tokenUsage table query without conversation join for all-agents-combined aggregation"

requirements-completed: [WIDG-04]

duration: 3min
completed: 2026-03-10
---

# Phase 34 Plan 01: Token Rate Backend Endpoint Summary

**Per-minute token aggregation endpoint via getTokenRate() query with 60-minute rolling window and TokenRatePoint shared type**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T13:43:35Z
- **Completed:** 2026-03-10T13:46:36Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- TokenRatePoint interface added to @cowboy/shared with minute, inputTokens, outputTokens fields
- getTokenRate() query aggregates tokenUsage rows by minute for the last 60 minutes using strftime grouping
- GET /analytics/token-rate Fastify route wired up with no query parameters (server-side 60-minute window)
- 5 unit tests covering empty results, aggregation, time exclusion, grouping, and sort order

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TokenRatePoint shared type and backend query with tests**
   - `18c8b68` (test: failing tests for getTokenRate - RED)
   - `4c24278` (feat: implement getTokenRate query - GREEN)
2. **Task 2: Add token-rate Fastify route** - `f4f62c4` (feat)

**Plan metadata:** [pending] (docs: complete plan)

_Note: Task 1 used TDD with RED/GREEN commits_

## Files Created/Modified
- `packages/shared/src/types/api.ts` - Added TokenRatePoint interface
- `packages/shared/src/types/index.ts` - Added TokenRatePoint re-export
- `packages/backend/src/db/queries/analytics.ts` - Added getTokenRate() function
- `packages/backend/src/routes/analytics.ts` - Added GET /analytics/token-rate route
- `packages/backend/tests/analytics/token-rate.test.ts` - 5 unit tests for token rate query

## Decisions Made
- Used `strftime('%Y-%m-%dT%H:%M:%S', 'now', '-60 minutes')` instead of `datetime('now', '-60 minutes')` because stored timestamps use ISO format with `T` separator while SQLite `datetime()` uses space separator, causing string comparison failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SQLite datetime format mismatch**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** `datetime('now', '-60 minutes')` produces `YYYY-MM-DD HH:MM:SS` format but stored timestamps use `YYYY-MM-DDTHH:MM:SSZ` ISO format; string comparison `>=` failed to exclude old rows
- **Fix:** Changed to `strftime('%Y-%m-%dT%H:%M:%S', 'now', '-60 minutes')` which produces ISO-compatible format
- **Files modified:** packages/backend/src/db/queries/analytics.ts
- **Verification:** All 5 tests pass including the 60-minute exclusion test
- **Committed in:** 4c24278 (part of GREEN phase commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was necessary for correctness of time window filtering. No scope creep.

## Issues Encountered
None beyond the datetime format mismatch handled as deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend endpoint ready for frontend integration
- Frontend composable can fetch from /api/analytics/token-rate
- WebSocket-driven refetch pattern can trigger token rate refresh

## Self-Check: PASSED

All files verified present. All commits verified (18c8b68, 4c24278, f4f62c4, 247a5d4).

---
*Phase: 34-live-token-usage-widget*
*Completed: 2026-03-10*
