---
phase: 03-api-core-dashboard
plan: 01
subsystem: api
tags: [fastify, drizzle, sqlite, analytics, pricing, rest-api]

# Dependency graph
requires:
  - phase: 02-claude-code-ingestion
    provides: "conversations and token_usage tables populated with ingested data"
provides:
  - "GET /api/analytics/overview endpoint with KPI stats and trends"
  - "GET /api/analytics/timeseries endpoint with granularity grouping"
  - "GET /api/analytics/conversations endpoint with pagination and cost"
  - "Model pricing module with calculateCost function"
  - "autoGranularity utility for date range detection"
  - "Shared TypeScript types for OverviewStats, TimeSeriesPoint, ConversationRow"
  - "Test fixture seeder for analytics data"
affects: [03-api-core-dashboard, 04-conversation-browser]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Drizzle aggregate queries with SQLite date functions", "Server-side cost calculation via shared pricing module", "Fuzzy model name matching for pricing lookup"]

key-files:
  created:
    - packages/shared/src/types/pricing.ts
    - packages/shared/src/types/analytics.ts
    - packages/backend/src/db/queries/analytics.ts
    - packages/backend/src/routes/analytics.ts
    - packages/backend/tests/fixtures/seed-analytics.ts
    - packages/backend/tests/analytics/pricing.test.ts
    - packages/backend/tests/analytics/overview.test.ts
    - packages/backend/tests/analytics/timeseries.test.ts
    - packages/backend/tests/analytics/conversations.test.ts
  modified:
    - packages/shared/src/types/api.ts
    - packages/shared/src/types/index.ts
    - packages/backend/src/app.ts

key-decisions:
  - "Server-side cost calculation in query layer using calculateCost from @cowboy/shared"
  - "Prior period for trend excludes current period start date to prevent overlap"
  - "Time-series groups by model first then aggregates per-period for accurate cost calculation"
  - "Conversation list sort by cost uses input tokens as proxy"

patterns-established:
  - "Analytics query pattern: Drizzle aggregate queries with SQLite strftime for date grouping"
  - "Pricing lookup pattern: exact match first, then fuzzy match via includes()"
  - "Date range filtering: append T23:59:59Z to 'to' date for inclusive day boundary"

requirements-completed: [DASH-01, DASH-02, DASH-03, TOKEN-01, TOKEN-02, TOKEN-03]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 3 Plan 1: Analytics API Summary

**Three REST endpoints serving KPI stats, time-series data, and paginated conversations with server-side cost calculation via shared pricing module**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T07:06:56Z
- **Completed:** 2026-03-04T07:12:19Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- Shared pricing module with 14 Claude model pricing entries and fuzzy matching for versioned model strings
- Analytics query layer with getOverviewStats (token totals, cost, savings, trends), getTimeSeries (daily/weekly/monthly grouping), and getConversationList (pagination, cost per row)
- Three Fastify GET endpoints under /api/analytics/ registered in app.ts with sensible defaults
- 28 new tests across 4 test files plus 3 existing health tests all passing (111 total backend tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared types, pricing module, test fixtures, and pricing tests** - `75c5ca9` (test)
2. **Task 2: Analytics query layer with integration tests** - `9a90938` (feat)
3. **Task 3: Fastify analytics route plugin and app registration** - `2f4358c` (feat)

## Files Created/Modified
- `packages/shared/src/types/pricing.ts` - Model pricing map (14 models) and calculateCost function with fuzzy matching
- `packages/shared/src/types/analytics.ts` - Granularity type and autoGranularity utility
- `packages/shared/src/types/api.ts` - OverviewStats, TimeSeriesPoint, ConversationRow, ConversationListResponse types
- `packages/shared/src/types/index.ts` - Re-exports all new types and functions
- `packages/backend/src/db/queries/analytics.ts` - Drizzle aggregate query functions for overview, timeseries, conversations
- `packages/backend/src/routes/analytics.ts` - Fastify route plugin with 3 GET endpoints
- `packages/backend/src/app.ts` - Added analyticsRoutes registration
- `packages/backend/tests/fixtures/seed-analytics.ts` - Shared test data seeder with 5 conversations across 3 days
- `packages/backend/tests/analytics/pricing.test.ts` - 11 tests for calculateCost and autoGranularity
- `packages/backend/tests/analytics/overview.test.ts` - 5 tests for KPI aggregation and trends
- `packages/backend/tests/analytics/timeseries.test.ts` - 5 tests for granularity grouping
- `packages/backend/tests/analytics/conversations.test.ts` - 7 tests for pagination, cost, and sorting

## Decisions Made
- Server-side cost calculation in the query layer rather than client-side, keeping API responses self-contained
- Prior trend period ends one day before current period start to prevent data overlap in trend calculations
- Time-series queries group by model AND period first, then aggregate per-period in code for accurate per-model cost calculation
- Conversation list sort-by-cost uses input tokens as a proxy since cost requires model lookup

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed prior period overlap in trend calculation**
- **Found during:** Task 2 (Analytics query layer)
- **Issue:** Prior period used `from` as its `to` boundary which, after adding T23:59:59Z, overlapped with current period data
- **Fix:** Changed prior period `to` to `from - 1 day` to ensure no data overlap
- **Files modified:** packages/backend/src/db/queries/analytics.ts
- **Verification:** Trend test now correctly returns null when prior period has no data
- **Committed in:** 9a90938 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential for correctness of trend calculations. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 analytics API endpoints are functional and tested
- Shared types ready for frontend consumption in Plan 02 (dashboard UI)
- Test fixtures available for reuse in future test files
- 111 total backend tests passing with no regressions

## Self-Check: PASSED

All 13 files verified present. All 3 task commits verified in git log.

---
*Phase: 03-api-core-dashboard*
*Completed: 2026-03-04*
