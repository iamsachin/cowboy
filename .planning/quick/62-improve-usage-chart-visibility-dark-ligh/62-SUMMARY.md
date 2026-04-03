---
phase: quick-62
plan: 01
subsystem: ui
tags: [chart.js, oklch, css-variables, theming]

requires:
  - phase: quick-61
    provides: LiveTokenChart sidebar card
provides:
  - Theme-aware chart line colors via CSS variables
  - Thicker, more visible chart lines in both dark and light themes
affects: [chart-theme, LiveTokenChart]

tech-stack:
  added: []
  patterns: [CSS variable-driven chart colors, theme-aware computed datasets]

key-files:
  created: []
  modified:
    - packages/frontend/src/app.css
    - packages/frontend/src/utils/chart-theme.ts
    - packages/frontend/src/components/LiveTokenChart.vue

key-decisions:
  - "Used oklch color space for chart line variables to match existing theme conventions"
  - "Set borderWidth to 2 for both datasets for improved line visibility"

patterns-established:
  - "Chart dataset colors sourced from CSS variables via getChartThemeColors()"

requirements-completed: [QUICK-62]

duration: 1min
completed: 2026-04-03
---

# Quick Task 62: Improve Usage Chart Visibility Summary

**Theme-aware chart line colors via CSS variables with increased line width for dark/light mode visibility**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-03T18:36:37Z
- **Completed:** 2026-04-03T18:37:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added 4 CSS custom properties (--chart-input-border, --chart-input-fill, --chart-output-border, --chart-output-fill) to both forest and emerald theme blocks
- Extended ChartThemeColors interface and getChartThemeColors() with 4 new color properties and rgba fallbacks
- Replaced hardcoded rgba colors in LiveTokenChart.vue with theme-aware values and increased borderWidth from 1 to 2

## Task Commits

Each task was committed atomically:

1. **Task 1: Add chart line CSS variables and extend theme utility** - `3d17e97` (feat)
2. **Task 2: Use theme colors in LiveTokenChart and increase line visibility** - `1468c94` (feat)

## Files Created/Modified
- `packages/frontend/src/app.css` - Added chart line color CSS variables to forest and emerald theme blocks
- `packages/frontend/src/utils/chart-theme.ts` - Extended interface and getter with inputBorder, inputFill, outputBorder, outputFill
- `packages/frontend/src/components/LiveTokenChart.vue` - Uses getChartThemeColors() for dataset colors, borderWidth increased to 2

## Decisions Made
- Used oklch color space for chart line variables to stay consistent with existing theme variables
- Dark theme (forest) uses brighter, vivid colors; light theme (emerald) uses darker, more saturated colors for white background contrast

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Chart colors are now fully theme-driven via CSS variables
- Future chart additions should follow the same pattern of CSS variable + getChartThemeColors()

---
*Phase: quick-62*
*Completed: 2026-04-03*
