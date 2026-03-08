---
phase: 18-data-accuracy-fixes
plan: 02
subsystem: analytics
tags: [sql, tool-stats, success-rate, drizzle-orm, vue]

# Dependency graph
requires:
  - phase: 11-core-collapsible-ui
    provides: ToolStatsTable component
provides:
  - Accurate tool call success rates excluding null-status and rejected calls
  - ExitPlanMode rejection classification in normalizer
  - Simplified tool stats query without expensive P95 computation
affects: [24-browser-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [null-status exclusion from analytics denominators, tool-specific status classification]

key-files:
  created: []
  modified:
    - packages/backend/src/db/queries/analytics.ts
    - packages/backend/src/ingestion/normalizer.ts
    - packages/shared/src/types/api.ts
    - packages/frontend/src/components/ToolStatsTable.vue

key-decisions:
  - "Remove duration columns entirely rather than estimate (JSONL lacks execution time data)"
  - "Narrow failure SQL to only 'error' status instead of all non-success non-null"
  - "ExitPlanMode rejected status only applies on re-ingestion (acceptable tradeoff)"

patterns-established:
  - "Null-status exclusion: analytics denominators exclude null-status rows for accurate rates"
  - "Tool-specific classification: normalizer can assign different statuses based on tool name"

requirements-completed: [DATA-05, DATA-06, DATA-07]

# Metrics
duration: 2min
completed: 2026-03-08
---

# Phase 18 Plan 02: Tool Stats Accuracy Summary

**Removed misleading duration columns, excluded null-status from success rate denominator, and classified ExitPlanMode rejections separately from errors**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08T09:02:40Z
- **Completed:** 2026-03-08T09:05:05Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Removed avgDuration and p95Duration columns from ToolStatsTable (always showed N/A)
- Eliminated expensive per-tool P95 secondary query in getToolStats
- Added unknown count to exclude null-status tool calls from success rate denominator
- ExitPlanMode with is_error=true now classified as 'rejected' instead of 'error'
- Success rate denominator excludes both unknown and rejected calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix tool duration estimation and null-status handling** - `c80a293` (fix)
2. **Task 2: Classify ExitPlanMode rejections as user-initiated** - `e60b7ce` (fix)

## Files Created/Modified
- `packages/backend/src/db/queries/analytics.ts` - Simplified getToolStats: removed P95 query, added unknown/rejected counts, narrowed failure to 'error' only
- `packages/backend/src/ingestion/normalizer.ts` - ExitPlanMode with is_error gets 'rejected' status
- `packages/shared/src/types/api.ts` - Added unknown and rejected fields to ToolStatsRow
- `packages/frontend/src/components/ToolStatsTable.vue` - Removed duration columns, updated success rate denominator

## Decisions Made
- Removed duration columns entirely rather than attempting to estimate from message timestamps (unreliable when multiple tool calls share one message)
- Narrowed failure SQL to only count 'error' status explicitly, rather than all non-success non-null (cleaner with new 'rejected' status)
- ExitPlanMode rejection classification only takes effect on re-ingestion; existing 'error' status remains until user re-ingests

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tool stats now show accurate success rates
- Re-ingestion needed for ExitPlanMode reclassification on existing data
- Ready for phase 18-03 or next data accuracy fixes

---
*Phase: 18-data-accuracy-fixes*
*Completed: 2026-03-08*
