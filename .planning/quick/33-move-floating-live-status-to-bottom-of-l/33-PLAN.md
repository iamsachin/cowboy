---
phase: quick-33
type: quick
description: "Move floating live token rate pill to bottom of left nav"
---

# Quick Task 33: Move Live Status to Left Nav

## Task

Move the floating `LiveTokenPill` from its fixed bottom-right position to the left sidebar, pinned at the bottom above the connection status indicator.

## Changes

1. Remove `LiveTokenPill` from `DashboardLayout.vue` (was floating fixed bottom-right)
2. Add `LiveTokenPill` to `AppSidebar.vue` above `ConnectionStatus`, with `collapsed` prop
3. Rewrite `LiveTokenPill.vue` to work inline (not fixed positioned), respect collapsed state, and open chart popover upward
