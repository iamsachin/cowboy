# Quick Task 33: Move Live Status to Left Nav

**Date:** 2026-03-28
**Status:** Complete

## Changes

- **`DashboardLayout.vue`** — Removed `LiveTokenPill` component and import
- **`AppSidebar.vue`** — Added `LiveTokenPill` above `ConnectionStatus` in the bottom section, passes `collapsed` prop
- **`LiveTokenPill.vue`** — Rewritten from fixed floating pill to inline sidebar component:
  - Uses `Activity` icon instead of floating button
  - Respects `collapsed` prop (tooltip on collapsed, full text expanded)
  - Chart popover opens upward (above pill) instead of above a floating button
  - Dismiss/restore still works via existing `useTokenRate` composable

## Commits

- `12bd37f` — feat(quick-33): move live token rate pill from floating position to left nav bottom
