---
phase: 17-cost-calculation-fixes
plan: 01
subsystem: api
tags: [analytics, cost-calculation, pricing, drizzle]

# Dependency graph
requires: []
provides:
  - "Per-model cost calculation in computePeriodStats (groupBy model)"
  - "Accurate cost sort in getConversationList (JS-based after per-model pricing)"
  - "Per-model cost computation for conversation list rows (multi-model aware)"
  - "Shared formatCost() utility with conditional precision"
affects: [17-02-cost-display-components]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JS-based sort for computed columns that cannot be expressed in SQL without duplicating pricing logic"
    - "Per-model token grouping for accurate cost calculation in multi-model conversations"

key-files:
  created:
    - packages/backend/tests/analytics/multi-model-cost.test.ts
  modified:
    - packages/backend/src/db/queries/analytics.ts
    - packages/frontend/src/utils/format-tokens.ts

key-decisions:
  - "JS sort for cost column instead of SQL subquery to avoid duplicating pricing logic in SQL"
  - "Per-model cost calculation via secondary query grouped by (conversationId, model) for conversation list"

patterns-established:
  - "Multi-model cost: always group token rows by model before calling calculateCost()"
  - "Computed sort columns: fetch all rows, compute in JS, sort, then paginate"

requirements-completed: [COST-01, COST-02, COST-06]

# Metrics
duration: 3min
completed: 2026-03-08
---

# Phase 17 Plan 01: Cost Calculation Fixes Summary

**Per-model cost grouping in analytics queries, JS-based cost sort replacing inputTokens proxy, and shared formatCost() utility**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T08:41:07Z
- **Completed:** 2026-03-08T08:44:23Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Fixed COST-01: multi-model conversations now price each model's tokens separately via groupBy(conversationId, model)
- Fixed COST-02: cost sort uses actual computed cost instead of inputTokens proxy
- Created COST-06: shared formatCost() with 4-tier conditional precision ($0.01/2dp, $0.001/3dp, $0.0001/4dp, below)
- Conversation list rows now compute per-model costs via secondary query for multi-model accuracy

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix multi-model cost calculation and cost sort** (TDD)
   - `a188365` (test) - failing tests for multi-model cost and cost sort
   - `e279c14` (feat) - implementation fixing both COST-01 and COST-02
2. **Task 2: Create shared formatCost() utility** - `51479a0` (feat)

## Files Created/Modified
- `packages/backend/src/db/queries/analytics.ts` - Fixed groupBy in computePeriodStats, added per-model cost for conversation list, JS-based cost sort
- `packages/backend/tests/analytics/multi-model-cost.test.ts` - Tests for multi-model pricing and cost sort order
- `packages/frontend/src/utils/format-tokens.ts` - Added canonical formatCost() with 4-tier precision

## Decisions Made
- Used JS-based sort for cost column rather than SQL subquery to avoid duplicating pricing logic from MODEL_PRICING in SQL CASE expressions
- Added secondary per-model query for conversation list cost computation (grouped by conversationId + model) rather than using conversation.model field which only captures the primary model

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed conversation list cost computation for multi-model conversations**
- **Found during:** Task 1 (cost sort implementation)
- **Issue:** getConversationList used conversation.model (primary model) to price all tokens, incorrect for multi-model conversations
- **Fix:** Added secondary query grouping by (conversationId, model), summing per-model costs per conversation
- **Files modified:** packages/backend/src/db/queries/analytics.ts
- **Verification:** multi-model-cost.test.ts passes with correct per-conversation costs
- **Committed in:** e279c14

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for cost sort correctness. The cost sort cannot work correctly without accurate per-row cost computation.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- formatCost() is exported and ready for Plan 02 to wire into all components
- Per-model cost calculation patterns established for any future analytics queries

---
*Phase: 17-cost-calculation-fixes*
*Completed: 2026-03-08*
