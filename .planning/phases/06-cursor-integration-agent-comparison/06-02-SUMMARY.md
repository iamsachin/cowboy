---
phase: 06-cursor-integration-agent-comparison
plan: 02
subsystem: ui, dashboard
tags: [vue, chart.js, vue-chartjs, daisyui, composables, agent-comparison, tabs]

# Dependency graph
requires:
  - phase: 06-cursor-integration-agent-comparison
    plan: 01
    provides: "Agent-filtered API endpoints (overview, timeseries, model-distribution, conversations)"
  - phase: 03-analytics-dashboard
    provides: "useAnalytics, useDateRange, KpiCard, TokenChart, CostChart, ConversationsChart"
  - phase: 04-conversation-browser
    provides: "ConversationTable, useConversations, ConversationBrowser"
provides:
  - "useAgentAnalytics composable for per-agent data fetching with agent query param"
  - "useAgentComparison composable fetching both agents in parallel"
  - "AgentsPage with tabbed layout (Claude Code / Cursor / Compare)"
  - "AgentBadge component for colored agent identification"
  - "ModelDistributionChart doughnut chart for model usage breakdown"
  - "ComparisonCard side-by-side metric display for two agents"
  - "AgentOverlayChart overlaid line chart for cross-agent comparison"
  - "AgentActivityChart stacked bar chart for conversation activity"
  - "Agent column with badges in ConversationTable across all pages"
  - "Sidebar Agents and Conversations nav items enabled"
affects: [07-advanced-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tabbed page layout with URL query param sync (activeTab from route.query.tab)"
    - "Per-agent composable instances (non-singleton) with reactive agent Ref parameter"
    - "Parallel data fetching in useAgentComparison via Promise.all for both agents"
    - "Chart.js Doughnut registration for model distribution visualization"
    - "Stacked Bar chart configuration for multi-agent activity comparison"

key-files:
  created:
    - "packages/frontend/src/utils/agent-constants.ts"
    - "packages/frontend/src/composables/useAgentAnalytics.ts"
    - "packages/frontend/src/composables/useAgentComparison.ts"
    - "packages/frontend/src/components/AgentBadge.vue"
    - "packages/frontend/src/components/ModelDistributionChart.vue"
    - "packages/frontend/src/components/ComparisonCard.vue"
    - "packages/frontend/src/components/AgentOverlayChart.vue"
    - "packages/frontend/src/components/AgentActivityChart.vue"
  modified:
    - "packages/frontend/src/pages/AgentsPage.vue"
    - "packages/frontend/src/composables/useConversations.ts"
    - "packages/frontend/src/components/ConversationTable.vue"
    - "packages/frontend/src/components/AppSidebar.vue"
    - "packages/frontend/src/pages/OverviewPage.vue"
    - "packages/frontend/src/composables/useAnalytics.ts"
    - "packages/frontend/src/components/TokenChart.vue"
    - "packages/frontend/src/components/CostChart.vue"
    - "packages/frontend/src/components/ConversationsChart.vue"

key-decisions:
  - "Compare tab as default on AgentsPage (per user preference for immediate cross-agent visibility)"
  - "useAgentAnalytics is non-singleton -- each per-agent tab creates its own instance"
  - "useAgentComparison fetches API directly (not via useAgentAnalytics) to avoid watcher overhead"
  - "'No data' placeholder shown instead of infinite spinner when chart data is empty"
  - "ModelDistributionChart added to OverviewPage alongside per-agent pages"

patterns-established:
  - "Tabbed page layout: URL query param drives active tab via computed + router.replace"
  - "Per-agent composable: accepts Ref<string> agent param, watches for refetch on change"
  - "Comparison composable: parallel Promise.all fetching for side-by-side views"
  - "Chart empty state: 'No data' placeholder when dataset array is empty"

requirements-completed: [DASH-04, DASH-05]

# Metrics
duration: 8min
completed: 2026-03-04
---

# Phase 6 Plan 02: Frontend Agent Pages + Comparison View Summary

**Tabbed Agents page with per-agent dashboards (KPIs, charts, model donut), side-by-side comparison view with overlaid charts, and agent badges in conversation tables**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-04T12:00:00Z
- **Completed:** 2026-03-04T12:08:00Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments
- Built full Agents page with three tabs (Claude Code, Cursor, Compare) defaulting to Compare for immediate cross-agent visibility
- Per-agent tabs display complete dashboards: KPI cards, token/cost/conversation charts, model distribution doughnut, and filtered conversation table
- Compare tab shows side-by-side ComparisonCards, overlaid line charts for tokens/cost/conversations, and stacked activity bar chart
- Agent badge column added to ConversationTable across all pages (Overview, Agents, Conversations)
- Sidebar Agents and Conversations nav items enabled for full navigation
- Model distribution doughnut chart added to Overview page as well

## Task Commits

Each task was committed atomically:

1. **Task 1: Composables, utility constants, and new chart/card components** - `28b4d57` (feat)
2. **Task 2: AgentsPage rewrite, overview table badge, sidebar enable** - `3c370ca` (feat)
3. **Task 3: Visual verification** - checkpoint (human-verify, approved)

**Post-checkpoint fixes:**
- `a20e4f6` - fix: show 'No data' instead of infinite spinner on empty chart data
- `6df0260` - feat: add model distribution chart to Overview page

## Files Created/Modified
- `packages/frontend/src/utils/agent-constants.ts` - AGENT_COLORS, AGENT_LABELS, AGENTS constants
- `packages/frontend/src/composables/useAgentAnalytics.ts` - Per-agent data fetching with reactive agent parameter
- `packages/frontend/src/composables/useAgentComparison.ts` - Parallel fetching of both agents for comparison
- `packages/frontend/src/components/AgentBadge.vue` - Colored badge component (sky blue for Claude Code, purple for Cursor)
- `packages/frontend/src/components/ModelDistributionChart.vue` - Doughnut chart for model usage breakdown
- `packages/frontend/src/components/ComparisonCard.vue` - Side-by-side metric card for two agents
- `packages/frontend/src/components/AgentOverlayChart.vue` - Overlaid line chart comparing two agents
- `packages/frontend/src/components/AgentActivityChart.vue` - Stacked bar chart for conversation activity
- `packages/frontend/src/pages/AgentsPage.vue` - Full tabbed layout with Claude Code, Cursor, Compare tabs
- `packages/frontend/src/composables/useConversations.ts` - Added optional agent filter parameter
- `packages/frontend/src/components/ConversationTable.vue` - Added Agent column with AgentBadge
- `packages/frontend/src/components/AppSidebar.vue` - Enabled Agents and Conversations nav items
- `packages/frontend/src/pages/OverviewPage.vue` - Added ModelDistributionChart
- `packages/frontend/src/composables/useAnalytics.ts` - Added modelDistribution data fetching
- `packages/frontend/src/components/TokenChart.vue` - Empty state handling
- `packages/frontend/src/components/CostChart.vue` - Empty state handling
- `packages/frontend/src/components/ConversationsChart.vue` - Empty state handling

## Decisions Made
- Compare tab set as default on AgentsPage per user preference for immediate cross-agent comparison visibility
- useAgentAnalytics is non-singleton (each tab creates its own instance) unlike the global useAnalytics
- useAgentComparison calls API directly rather than composing useAgentAnalytics to avoid unnecessary watcher overhead
- Charts show "No data" placeholder instead of infinite spinner when dataset is empty (post-checkpoint fix)
- ModelDistributionChart added to Overview page in addition to per-agent pages (post-checkpoint enhancement)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed infinite spinner on empty chart data**
- **Found during:** Task 3 (visual verification)
- **Issue:** Charts showed infinite loading spinner when data array was empty instead of graceful "No data" message
- **Fix:** Added empty-state check in all chart components to render "No data" text when dataset is empty
- **Files modified:** ModelDistributionChart.vue, TokenChart.vue, CostChart.vue, ConversationsChart.vue
- **Verification:** Visually verified charts show "No data" placeholder when no data present
- **Committed in:** a20e4f6

**2. [Rule 2 - Missing Critical] Added ModelDistributionChart to Overview page**
- **Found during:** Task 3 (visual verification)
- **Issue:** Overview page lacked model distribution visualization even though the API endpoint existed
- **Fix:** Added ModelDistributionChart to OverviewPage and wired useAnalytics to fetch model distribution data
- **Files modified:** OverviewPage.vue, useAnalytics.ts
- **Verification:** Visually verified doughnut chart appears on Overview page
- **Committed in:** 6df0260

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes improve user experience. No scope creep -- they address gaps discovered during visual verification.

## Issues Encountered
None beyond the auto-fixed items discovered during visual verification.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 6 fully complete: Cursor ingestion pipeline (Plan 01) + frontend agent pages (Plan 02)
- All DASH-04 and DASH-05 requirements delivered
- Ready for Phase 7 (Advanced Analytics) which builds on the agent comparison foundation
- 18 new/modified frontend files, all type-checked with vue-tsc

## Self-Check: PASSED

All 4 commits verified (28b4d57, 3c370ca, a20e4f6, 6df0260). All 10 key files confirmed on disk. SUMMARY.md exists.

---
*Phase: 06-cursor-integration-agent-comparison*
*Completed: 2026-03-04*
