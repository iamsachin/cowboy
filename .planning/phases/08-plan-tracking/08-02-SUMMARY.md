---
phase: 08-plan-tracking
plan: 02
subsystem: api
tags: [plan-queries, drizzle, fastify, rest-api, pagination, aggregation]

# Dependency graph
requires:
  - phase: 08-plan-tracking
    provides: "Plan extractor, plans/planSteps DB tables, shared plan types"
  - phase: 03-analytics-dashboard
    provides: "Analytics query patterns, date filter pattern, route registration pattern"
provides:
  - "Plan query functions: getPlanList, getPlanDetail, getPlanStats, getPlanTimeSeries, getPlansByConversation"
  - "Plan API routes: /api/plans, /api/plans/:id, /api/plans/stats, /api/plans/timeseries, /api/plans/by-conversation/:conversationId"
  - "Plan routes registered in app.ts under /api prefix"
  - "Plan types re-exported from shared package index"
affects: [08-plan-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plan query layer following analytics.ts patterns: date filter, join with conversations, aggregation"
    - "Route registration order: specific routes before parameterized to avoid Fastify conflicts"
    - "Zero-division safety in aggregation: check totalSteps > 0 before computing completionRate"

key-files:
  created:
    - "packages/backend/src/db/queries/plans.ts"
    - "packages/backend/src/routes/plans.ts"
    - "packages/backend/tests/plans/plan-stats.test.ts"
    - "packages/backend/tests/plans/plan-api.test.ts"
  modified:
    - "packages/backend/src/app.ts"
    - "packages/shared/src/types/index.ts"

key-decisions:
  - "Route registration order: /plans/stats, /plans/timeseries, /plans/by-conversation/:id registered BEFORE /plans/:id to prevent Fastify parameter conflicts"
  - "Plan types re-exported from shared/types/index.ts to enable frontend imports via @cowboy/shared"

patterns-established:
  - "Plan query functions mirror analytics.ts: date filter with T23:59:59Z inclusive boundary, optional agent filter, inner join with conversations"
  - "Plan API routes follow analytics.ts pattern exactly: default 30-day range, autoGranularity for timeseries"

requirements-completed: [PLAN-02, PLAN-03]

# Metrics
duration: 6min
completed: 2026-03-04
---

# Phase 8 Plan 2: Plan Query Layer and REST API Summary

**Drizzle query functions and Fastify API routes for plan list, detail, stats, timeseries, and by-conversation endpoints**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-04T13:44:55Z
- **Completed:** 2026-03-04T13:51:54Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Built 5 query functions (getPlanList, getPlanDetail, getPlanStats, getPlanTimeSeries, getPlansByConversation) following established analytics.ts patterns
- Created 5 API routes with pagination, filtering, aggregation, and 404 handling
- Registered plan routes in app.ts with correct route ordering to avoid parameter conflicts
- Added 33 tests (19 query layer + 14 API integration) with 100% pass rate

## Task Commits

Each task was committed atomically:

1. **Task 1: Plan query layer** - `7e0a4ee` (feat)
2. **Task 2: Plan API routes and registration** - `a09fc57` (feat)

## Files Created/Modified
- `packages/backend/src/db/queries/plans.ts` - Query functions for plan list, detail, stats, timeseries, and by-conversation
- `packages/backend/src/routes/plans.ts` - Fastify route handlers for /api/plans/* endpoints
- `packages/backend/src/app.ts` - Plan routes registered under /api prefix after analytics routes
- `packages/shared/src/types/index.ts` - Re-export plan types (PlanRow, PlanStepRow, PlanListResponse, etc.)
- `packages/backend/tests/plans/plan-stats.test.ts` - 19 tests for query functions
- `packages/backend/tests/plans/plan-api.test.ts` - 14 integration tests for API endpoints

## Decisions Made
- Route registration order: specific named routes (/stats, /timeseries, /by-conversation/:id) registered before the parameterized route (/:id). This follows the Phase 4 decision and prevents Fastify from treating "stats" as an :id parameter.
- Plan types re-exported from shared/types/index.ts so the frontend can import them via @cowboy/shared.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-exported plan types from shared package index**
- **Found during:** Task 1 (Plan query layer implementation)
- **Issue:** Plan types (PlanRow, PlanStepRow, etc.) were defined in api.ts but not re-exported from shared/types/index.ts, causing import failures in the query module.
- **Fix:** Added plan type exports to packages/shared/src/types/index.ts
- **Files modified:** packages/shared/src/types/index.ts
- **Verification:** Import resolves, TypeScript compilation succeeds
- **Committed in:** 7e0a4ee (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was required for the query module to compile. No scope creep.

## Issues Encountered
None - implementation followed established patterns from analytics.ts and existing route registration.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All plan API endpoints operational, ready for frontend consumption
- Next plan (08-03) can build the Plans page, plan detail page, and inline plan display in conversation detail
- Full backend test suite passes (255 tests green)

## Self-Check: PASSED

All 6 created/modified files verified present. Both task commits (7e0a4ee, a09fc57) verified in git log.

---
*Phase: 08-plan-tracking*
*Completed: 2026-03-04*
