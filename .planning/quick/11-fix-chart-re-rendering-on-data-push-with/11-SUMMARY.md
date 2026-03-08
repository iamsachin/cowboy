---
phase: quick-11
plan: 01
subsystem: ui
tags: [vue-chartjs, v-show, chart.js, websocket]

requires:
  - phase: quick-7
    provides: animation: false on all chart options
provides:
  - Flash-free chart rendering using v-show instead of v-if/v-else
affects: []

tech-stack:
  added: []
  patterns: [v-show for chart visibility to prevent DOM unmount/remount]

key-files:
  created: []
  modified:
    - packages/frontend/src/components/TokenChart.vue
    - packages/frontend/src/components/CostChart.vue
    - packages/frontend/src/components/ConversationsChart.vue
    - packages/frontend/src/components/ModelDistributionChart.vue
    - packages/frontend/src/components/ToolStatsChart.vue
    - packages/frontend/src/components/AgentActivityChart.vue
    - packages/frontend/src/components/AgentOverlayChart.vue
    - packages/frontend/src/components/PlanStatsCharts.vue

key-decisions:
  - "v-show keeps Chart.js canvas mounted so vue-chartjs handles in-place data diffing without flash"

patterns-established:
  - "v-show pattern: use explicit boolean conditions for each state (loading/empty/data) instead of v-if/v-else chains"

requirements-completed: [QUICK-11]

duration: 1min
completed: 2026-03-08
---

# Quick Task 11: Fix Chart Re-rendering Summary

**Replaced v-if/v-else with v-show in all 8 chart components so Chart.js canvas stays mounted and vue-chartjs handles in-place data updates without flash**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-08T18:02:40Z
- **Completed:** 2026-03-08T18:04:09Z
- **Tasks:** 1 (+ 1 soft checkpoint)
- **Files modified:** 8

## Accomplishments
- Converted all 8 chart components from v-if/v-else-if/v-else to v-show with explicit conditions
- Chart canvas elements now stay mounted in the DOM during all state transitions (loading, empty, populated)
- vue-chartjs built-in data diffing (setDatasets/setLabels + chart.update()) handles smooth in-place updates

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert v-if/v-else to v-show in all 8 chart components** - `7ae59b3` (fix)

## Files Modified
- `packages/frontend/src/components/TokenChart.vue` - 3-state v-show (loading/empty/data)
- `packages/frontend/src/components/CostChart.vue` - 3-state v-show (loading/empty/data)
- `packages/frontend/src/components/ConversationsChart.vue` - 3-state v-show (loading/empty/data)
- `packages/frontend/src/components/ModelDistributionChart.vue` - 2-state v-show (empty/data, no loading prop)
- `packages/frontend/src/components/ToolStatsChart.vue` - 3-state v-show with dynamic height
- `packages/frontend/src/components/AgentActivityChart.vue` - 2-state v-show using isEmpty computed
- `packages/frontend/src/components/AgentOverlayChart.vue` - 2-state v-show using isEmpty computed
- `packages/frontend/src/components/PlanStatsCharts.vue` - Both bar and line chart sections converted

## Decisions Made
- Used v-show with explicit boolean conditions for each state instead of v-if/v-else chains, ensuring the Chart.js canvas element is never unmounted from the DOM

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Pre-existing vue-tsc type errors on `animation: boolean` (should be `animation: false as const`) in all chart components -- not introduced by this change, not in scope

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All chart components now use v-show pattern consistently
- Charts should update in-place without flash when data arrives via WebSocket

---
*Quick Task: 11*
*Completed: 2026-03-08*
