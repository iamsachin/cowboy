---
phase: 34-live-token-usage-widget
plan: 02
subsystem: ui
tags: [vue, chart.js, websocket, composable, floating-widget, localStorage]

# Dependency graph
requires:
  - phase: 34-live-token-usage-widget/34-01
    provides: "GET /api/analytics/token-rate endpoint returning TokenRatePoint[]"
  - phase: 31-websocket-backbone
    provides: "useWebSocket composable with on() for WS events"
provides:
  - "useTokenRate singleton composable with WS-driven refetch, dismissed/restore state"
  - "LiveTokenPill floating widget with dismiss/restore and localStorage persistence"
  - "LiveTokenChart line chart for 60-min token rate history"
  - "Sidebar restore button for dismissed widget"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Floating pill widget with popover expansion (LiveTokenPill pattern)"
    - "Singleton composable with shared dismissed/restore state across components"
    - "filledTokenRate gap-filling for complete 60-minute chart timeline"

key-files:
  created:
    - packages/frontend/src/composables/useTokenRate.ts
    - packages/frontend/src/components/LiveTokenPill.vue
    - packages/frontend/src/components/LiveTokenChart.vue
  modified:
    - packages/frontend/src/components/AppSidebar.vue
    - packages/frontend/src/layouts/DashboardLayout.vue

key-decisions:
  - "Singleton composable with module-level dismissed ref shared between pill and sidebar"
  - "filledTokenRate uses UTC timestamps to match backend ISO format"
  - "Spike detection threshold: 2x average of previous 5 minutes combined rate"
  - "Click-outside handler with document listener for popover dismiss"

patterns-established:
  - "Floating pill with popover: fixed bottom-right, v-if for dismiss, Transition for popover fade"
  - "Shared localStorage state via singleton composable (dismissed/restore pattern)"

requirements-completed: [WIDG-01, WIDG-02, WIDG-03]

# Metrics
duration: 12min
completed: 2026-03-10
---

# Phase 34 Plan 02: Live Token Usage Widget Summary

**Floating pill with live token rates, expandable Chart.js popover for 60-min history, dismiss/restore via localStorage and sidebar button**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-10T14:10:00Z
- **Completed:** 2026-03-10T14:32:39Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- useTokenRate composable with WS-driven refetch, currentInput/currentOutput computed refs, filledTokenRate gap-filling, and shared dismissed/restore state
- LiveTokenPill floating widget with idle dimming, spike pulse animation, popover chart expansion, dismiss via X hover icon, and click-outside close
- LiveTokenChart renders Chart.js Line with input/output series for 60-minute rolling window
- Sidebar "Show live usage" restore button (collapsed and expanded variants)
- Widget mounted globally in DashboardLayout, persists across page navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useTokenRate composable and LiveTokenChart component** - `946328e` (feat)
2. **Task 2: Create LiveTokenPill component, wire into layout and sidebar** - `869f234` (feat)
3. **Bug fix: UTC timezone fix in filledTokenRate and chart labels** - `84b4e48` (fix)

Task 3 was a human-verify checkpoint -- approved after browser verification of all 11 steps.

## Files Created/Modified
- `packages/frontend/src/composables/useTokenRate.ts` - Singleton composable: fetchTokenRate, WS refetch, currentInput/currentOutput, filledTokenRate, dismissed/dismiss/restore
- `packages/frontend/src/components/LiveTokenChart.vue` - Chart.js Line chart with input/output series, HH:MM local time labels
- `packages/frontend/src/components/LiveTokenPill.vue` - Floating pill with popover, idle dimming, spike pulse, dismiss X, click-outside handler
- `packages/frontend/src/components/AppSidebar.vue` - Added "Show live usage" restore button (collapsed + expanded variants)
- `packages/frontend/src/layouts/DashboardLayout.vue` - Mounted LiveTokenPill globally

## Decisions Made
- Singleton composable with module-level `dismissed` ref shared between pill and sidebar -- avoids prop drilling or event bus
- filledTokenRate uses UTC timestamps to match backend ISO format (fixed during verification)
- Spike detection threshold set at 2x average of previous 5 minutes' combined rate
- Click-outside handler uses document listener with @click.stop on pill and popover to prevent false triggers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UTC/local timezone mismatch in filledTokenRate**
- **Found during:** Task 3 (human verification checkpoint)
- **Issue:** filledTokenRate generated minute slots using local time but backend returns UTC ISO timestamps, causing chart to show data points at wrong positions
- **Fix:** Changed filledTokenRate to use UTC date methods and chart labels to format UTC timestamps to local time for display
- **Files modified:** packages/frontend/src/composables/useTokenRate.ts, packages/frontend/src/components/LiveTokenChart.vue
- **Verification:** Chart now displays correct local times with data aligned properly
- **Committed in:** 84b4e48

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential fix for correct chart display. No scope creep.

## Issues Encountered
None beyond the timezone bug documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Live token usage widget fully functional and integrated
- Phase 34 plan 03 (if any) can proceed
- Widget pattern (floating pill + popover) established for potential reuse

---
*Phase: 34-live-token-usage-widget*
*Completed: 2026-03-10*

## Self-Check: PASSED

- All 5 source files verified on disk
- All 3 commits verified in git history (946328e, 869f234, 84b4e48)
- SUMMARY.md created at expected path
