---
phase: 21-plan-extraction-quality
plan: 03
subsystem: ui
tags: [vue, daisyui, badges, kpi, date-formatting, sort]

requires:
  - phase: 08-plans-crud
    provides: PlansPage, KpiCard, usePlans composable
  - phase: 21-02
    provides: Backend sort column mapping for all 6 columns
provides:
  - Distinct status badges for not-started vs unknown plans
  - KPI cards with no empty space when description is absent
  - Local timezone date formatting on Plans page
  - Verified frontend sort param passthrough for all 6 columns
affects: [24-browser-verification]

tech-stack:
  added: []
  patterns: [badge-neutral for not-started, badge-ghost+outline for unknown, conditional v-if on stat-desc, local date via getFullYear/getMonth/getDate]

key-files:
  created: []
  modified:
    - packages/frontend/src/pages/PlansPage.vue
    - packages/frontend/src/components/KpiCard.vue

key-decisions:
  - "badge-neutral (solid gray) for not-started; badge-ghost+badge-outline (dashed) for unknown -- visually distinct"
  - "HelpCircle icon prefix on unknown status badge for additional distinction"
  - "Conditional v-if on stat-desc div to prevent empty whitespace when no trend or description"
  - "Frontend sort params pass column field names directly; backend handles mapping (no frontend transform needed)"

patterns-established:
  - "Status badge pattern: complete=success, partial=warning, not-started=neutral, unknown=ghost+outline"

requirements-completed: [PLAN-08, PLAN-09, PLAN-07]

duration: 2min
completed: 2026-03-08
---

# Phase 21 Plan 03: Plans Page UI Fixes Summary

**Distinct status badges (neutral vs ghost+outline), conditional KPI stat-desc, local date formatting, and verified sort passthrough for all 6 columns**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08T14:44:54Z
- **Completed:** 2026-03-08T14:46:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- not-started plans now show solid gray badge-neutral, visually distinct from unknown which shows dashed badge-ghost+outline with HelpCircle icon
- KPI cards with empty description no longer render an empty stat-desc div (conditional v-if)
- Date formatting uses local timezone (getFullYear/getMonth/getDate) instead of UTC toISOString
- Verified frontend sort params pass all 6 column names (title, steps, status, agent, project, date) directly to API; backend maps them

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix status badges, KPI description, and date formatting** - `8c5c538` (feat) - changes were bundled into prior 21-01 commit
2. **Task 2: Fix frontend sort param mapping for all columns** - verification only, no code changes needed

## Files Created/Modified
- `packages/frontend/src/pages/PlansPage.vue` - Status badge classes, HelpCircle import/usage, local date formatting
- `packages/frontend/src/components/KpiCard.vue` - Conditional v-if on stat-desc div

## Decisions Made
- badge-neutral for not-started (solid gray) vs badge-ghost+badge-outline for unknown (dashed) provides clear visual distinction
- HelpCircle icon added to unknown status for additional clarity
- Frontend sort passthrough confirmed correct -- backend (21-02) handles all column name to SQL mapping
- No changes needed in usePlans.ts -- setSort already passes raw column field names

## Deviations from Plan

None - plan executed exactly as written. Task 1 code changes were already committed during 21-01 execution (bundled in 8c5c538). Task 2 was verification-only confirming existing behavior.

## Issues Encountered
- Pre-existing type error in ToolStatsTable.vue (Property 'rejected' does not exist on type 'ToolStatsRow') -- unrelated to this plan, not fixed (out of scope)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans page UI fixes complete
- Ready for Phase 24 browser verification of all status badge, KPI, sort, and date changes

---
*Phase: 21-plan-extraction-quality*
*Completed: 2026-03-08*
