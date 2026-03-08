---
phase: 20-conversation-list-fixes
plan: 01
subsystem: api
tags: [drizzle, sql, sorting, filters, backend]

requires:
  - phase: 17-cost-calculation
    provides: "JS-side cost sort pattern for conversation list"
provides:
  - "8-column sort mapping for conversation list with NULLS LAST"
  - "GET /analytics/filters endpoint returning projects and agents"
  - "Token sort by input+output sum matching displayed total"
affects: [20-conversation-list-fixes]

tech-stack:
  added: []
  patterns: ["NULLS LAST via CASE WHEN for nullable column sorting"]

key-files:
  created: []
  modified:
    - packages/backend/src/db/queries/analytics.ts
    - packages/backend/src/routes/analytics.ts

key-decisions:
  - "Token sort uses sum(input + output) to match the displayed total in the UI"
  - "NULLS LAST implemented via CASE WHEN IS NULL pattern for cross-DB compatibility"
  - "Unrecognized sort fields fall back to date (createdAt) as safe default"

patterns-established:
  - "NULLS LAST pattern: CASE WHEN col IS NULL THEN 1 ELSE 0 END ASC, col DIR"

requirements-completed: [LIST-02, LIST-03, LIST-04]

duration: 3min
completed: 2026-03-08
---

# Phase 20 Plan 01: Backend Sort & Filters Summary

**Extended sort column mapping for all 8 conversation list columns with NULLS LAST and new /analytics/filters endpoint for dropdown population**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T12:22:45Z
- **Completed:** 2026-03-08T12:26:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- All 8 sort columns (date, agent, project, model, title, inputTokens, cost, cacheReadTokens) now produce correct SQL ordering
- Token sort (inputTokens field) sorts by sum(input + output) matching the displayed total in the UI
- Nullable columns (agent, project, model, title) use NULLS LAST regardless of ASC/DESC direction
- New GET /analytics/filters endpoint returns distinct projects and agents scoped by date range

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend sort column mapping and token sort** - `9e5a79a` (feat)
2. **Task 2: Add /analytics/filters endpoint** - `580868e` (feat)

## Files Created/Modified
- `packages/backend/src/db/queries/analytics.ts` - Extended sort mapping with 8-column support, NULLS LAST, and new getFilterOptions query
- `packages/backend/src/routes/analytics.ts` - Added getFilterOptions import and GET /analytics/filters route

## Decisions Made
- Token sort uses sum(input + output) to match the displayed total in the UI (LIST-02 fix)
- NULLS LAST implemented via CASE WHEN IS NULL pattern for SQLite compatibility
- Unrecognized sort fields fall back to date (createdAt) as safe default

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend sort and filter infrastructure ready for frontend consumption in plans 20-02 and 20-03
- /analytics/filters endpoint ready for project/agent dropdown population

---
*Phase: 20-conversation-list-fixes*
*Completed: 2026-03-08*
