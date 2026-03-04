---
phase: 07-advanced-analytics
plan: 01
subsystem: api
tags: [drizzle, fastify, analytics, tool-stats, heatmap, project-stats, p95, sqlite]

# Dependency graph
requires:
  - phase: 03-dashboard-kpis
    provides: analytics query patterns, calculateCost, date range filtering with T23:59:59Z convention
  - phase: 04-conversation-browser
    provides: conversation detail with tool calls (TOOL-01)
  - phase: 06-cursor-integration-agent-comparison
    provides: model distribution endpoint (TOKEN-05), agent filter pattern
provides:
  - GET /api/analytics/tool-stats endpoint returning per-tool success/failure counts, frequency, avg+P95 duration
  - GET /api/analytics/heatmap endpoint returning daily conversation counts
  - GET /api/analytics/project-stats endpoint returning per-project token/cost breakdown with topModels
  - Shared TypeScript types ToolStatsRow, HeatmapDay, ProjectStatsRow, ProjectModelEntry
affects: [07-02-PLAN, 07-03-PLAN, frontend-analytics-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [P95 duration computed in JS from sorted SQLite results, per-project cost aggregation via per-model secondary queries, topModels array via distinct conversationId count per model]

key-files:
  created:
    - packages/backend/tests/analytics/tool-stats.test.ts
    - packages/backend/tests/analytics/heatmap.test.ts
    - packages/backend/tests/analytics/project-stats.test.ts
  modified:
    - packages/shared/src/types/api.ts
    - packages/shared/src/types/index.ts
    - packages/backend/src/db/queries/analytics.ts
    - packages/backend/src/routes/analytics.ts
    - packages/backend/tests/fixtures/seed-analytics.ts
    - packages/backend/tests/analytics/conversation-detail.test.ts

key-decisions:
  - "P95 duration computed in JavaScript via sorted array index (SQLite has no PERCENTILE function)"
  - "Tool success checks both 'success' and 'completed' status values for forward compatibility"
  - "Project cost calculated per-model via secondary query to maintain accuracy across mixed-model projects"
  - "topModels uses count(distinct conversationId) per model for accurate per-project model distribution"

patterns-established:
  - "P95 pattern: secondary query fetching sorted durations per group, compute Math.floor(length * 0.95) index in JS"
  - "Per-project aggregation: group conversations by project, secondary queries for per-model cost and model distribution"

requirements-completed: [TOKEN-05, TOOL-01, TOOL-02, TOOL-03, DASH-06, DASH-07]

# Metrics
duration: 7min
completed: 2026-03-04
---

# Phase 7 Plan 01: Advanced Analytics Backend Summary

**Three new analytics API endpoints: tool-stats with P95 duration, activity heatmap with daily counts, and project-stats with per-model cost breakdown and topModels array**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-04T12:46:42Z
- **Completed:** 2026-03-04T12:53:28Z
- **Tasks:** 2 (Task 1 was TDD: RED+GREEN)
- **Files modified:** 9

## Accomplishments
- GET /api/analytics/tool-stats returns per-tool aggregates with success/failure counts, avg duration, and P95 duration computed in JavaScript
- GET /api/analytics/heatmap returns daily conversation counts grouped by date for activity visualization
- GET /api/analytics/project-stats returns per-project analytics with token breakdown, accurate per-model cost, and topModels array
- All three endpoints support from, to, and agent query parameters following existing patterns
- 11 new integration tests with deterministic assertions against seed data, full backend suite green (193 tests)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for tool-stats, heatmap, project-stats** - `3dd83b7` (test)
2. **Task 1 GREEN: Implement query functions and routes** - `f072cc0` (feat)

_Note: Task 2 (route registration) was completed as part of Task 1 GREEN since integration tests require routes to exist._

## Files Created/Modified
- `packages/shared/src/types/api.ts` - Added ToolStatsRow, ToolStatsResponse, HeatmapDay, ProjectModelEntry, ProjectStatsRow types
- `packages/shared/src/types/index.ts` - Re-exported new types from @cowboy/shared
- `packages/backend/src/db/queries/analytics.ts` - Added getToolStats, getHeatmapData, getProjectStats query functions
- `packages/backend/src/routes/analytics.ts` - Registered three new GET routes between model-distribution and conversations/:id
- `packages/backend/tests/fixtures/seed-analytics.ts` - Extended with 10 tool calls across conversations (Read, Write, Bash with varied statuses/durations) and messages for conv-4/conv-5
- `packages/backend/tests/analytics/tool-stats.test.ts` - 3 tests for tool stats endpoint
- `packages/backend/tests/analytics/heatmap.test.ts` - 4 tests for heatmap endpoint
- `packages/backend/tests/analytics/project-stats.test.ts` - 4 tests for project stats endpoint
- `packages/backend/tests/analytics/conversation-detail.test.ts` - Updated for extended seed data (conv-1 now has 2 tool calls)

## Decisions Made
- P95 duration computed in JavaScript: SQLite has no PERCENTILE function, so we fetch sorted duration arrays per tool and compute `sorted[Math.floor(length * 0.95)]`
- Tool success status checks both 'success' and 'completed': the codebase uses 'completed' but checking both ensures forward compatibility
- Project cost uses per-model secondary queries: ensures accurate cost calculation when a project spans multiple models
- topModels counts distinct conversationId per model: gives accurate "how many conversations used each model" rather than token usage row counts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated conversation-detail test for extended seed data**
- **Found during:** Task 1 GREEN (verification)
- **Issue:** conversation-detail.test.ts expected conv-1 to have 1 tool call, but seed data now includes 2 tool calls for conv-1
- **Fix:** Updated test to expect 2 tool calls and assert on both (Read and Write)
- **Files modified:** packages/backend/tests/analytics/conversation-detail.test.ts
- **Verification:** Full analytics test suite passes (59 tests)
- **Committed in:** f072cc0 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary correction for test consistency. No scope creep.

## Issues Encountered
- file-watcher.test.ts is flaky when run concurrently with other tests (passes when run alone). Pre-existing issue, not caused by this plan's changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Three backend endpoints ready for frontend consumption in Plan 03 (Analytics page)
- Plan 02 (cost projection) can proceed independently as it extends the existing timeseries data
- All shared types exported from @cowboy/shared for frontend type safety

---
*Phase: 07-advanced-analytics*
*Completed: 2026-03-04*
