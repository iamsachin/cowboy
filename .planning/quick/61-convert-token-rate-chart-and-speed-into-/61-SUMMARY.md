---
phase: quick-61
plan: 01
subsystem: ui
tags: [vue, daisyui, sidebar, token-rate, chart]

requires:
  - phase: quick-44
    provides: token rate speed display
provides:
  - Always-visible token rate card with inline chart and speed indicators
  - Sidebar without dismiss/restore toggle
affects: [sidebar, token-rate]

tech-stack:
  added: []
  patterns: [always-visible sidebar widget]

key-files:
  created: []
  modified:
    - packages/frontend/src/components/LiveTokenPill.vue
    - packages/frontend/src/components/AppSidebar.vue
    - packages/frontend/src/composables/useTokenRate.ts

key-decisions:
  - "Removed all dismiss/restore/popover logic in favor of always-visible card"

patterns-established:
  - "Sidebar bottom widgets are always visible, not toggleable"

requirements-completed: [QUICK-61]

duration: 1min
completed: 2026-04-03
---

# Quick Task 61: Convert Token Rate Chart to Always-Visible Sidebar Card

**Always-visible compact token rate card with inline chart and speed indicators pinned at sidebar bottom, replacing dismissible popover**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-03T18:20:24Z
- **Completed:** 2026-04-03T18:21:53Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Converted LiveTokenPill from popover to always-visible compact card with rounded corners and proper margins
- Inline chart (h-28) with speed indicators (up/down tokens per min) below
- Removed all dismiss/restore logic from useTokenRate composable
- Removed "Show live usage" toggle buttons from AppSidebar
- Collapsed sidebar shows Activity icon only

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert LiveTokenPill from popover to always-visible card** - `bc6dd55` (feat)
2. **Task 2: Remove "Show live usage" toggle from AppSidebar** - `f048633` (feat)

## Files Created/Modified
- `packages/frontend/src/components/LiveTokenPill.vue` - Rewritten from popover to always-visible card with chart and speed row
- `packages/frontend/src/components/AppSidebar.vue` - Removed widget restore buttons and related imports
- `packages/frontend/src/composables/useTokenRate.ts` - Removed dismissed ref, dismiss(), restore() functions

## Decisions Made
- Removed all dismiss/restore/popover logic entirely rather than hiding it, keeping the codebase clean

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

---
*Phase: quick-61*
*Completed: 2026-04-03*
