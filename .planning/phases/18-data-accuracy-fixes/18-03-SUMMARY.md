---
phase: 18-data-accuracy-fixes
plan: 03
subsystem: ui, api
tags: [timezone, heatmap, timeseries, sqlite, date-formatting]

requires:
  - phase: 17-cost-calculation-fixes
    provides: Cost calculation and analytics query infrastructure
provides:
  - Timezone-consistent heatmap date rendering (no one-day shift)
  - Timeseries grouping aligned with date filter source (conversations.createdAt)
affects: [24-browser-verification]

tech-stack:
  added: []
  patterns: [local-timezone date formatting in JS, consistent timestamp source in SQL queries]

key-files:
  created: []
  modified:
    - packages/frontend/src/components/ActivityHeatmap.vue
    - packages/backend/src/db/queries/analytics.ts

key-decisions:
  - "Use getFullYear/getMonth/getDate for local date formatting instead of toISOString (avoids UTC conversion)"
  - "Group timeseries by conversations.createdAt to match the WHERE filter source"

patterns-established:
  - "Local timezone dates: Always use getFullYear/getMonth/getDate for date-only strings, never toISOString().slice()"
  - "Timestamp consistency: SQL GROUP BY and WHERE should reference the same timestamp column"

requirements-completed: [DATA-08, DATA-09]

duration: 1min
completed: 2026-03-08
---

# Phase 18 Plan 03: Heatmap Timezone & Timeseries Consistency Summary

**Fixed heatmap one-day timezone shift using local date formatting and aligned timeseries grouping to use conversations.createdAt**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-08T09:02:34Z
- **Completed:** 2026-03-08T09:03:25Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Heatmap cells no longer shift by one day for users in UTC-negative timezones
- Timeseries period grouping now uses conversations.createdAt instead of tokenUsage.createdAt, eliminating attribution mismatches for long-running or timestamp-inconsistent conversations

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix heatmap timezone and timeseries timestamp consistency** - `e2c167b` (fix)

## Files Created/Modified
- `packages/frontend/src/components/ActivityHeatmap.vue` - Replaced toISOString().slice(0,10) with local timezone date formatting using getFullYear/getMonth/getDate
- `packages/backend/src/db/queries/analytics.ts` - Changed timeseries strftime from tokenUsage.createdAt to conversations.createdAt

## Decisions Made
- Used getFullYear/getMonth/getDate for local date string formatting instead of toISOString (which converts to UTC, causing day shift)
- Aligned timeseries grouping to conversations.createdAt since the WHERE clause already filters on that column

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DATA-08 and DATA-09 fixes complete
- Ready for remaining data accuracy plans or browser verification in Phase 24

---
*Phase: 18-data-accuracy-fixes*
*Completed: 2026-03-08*
