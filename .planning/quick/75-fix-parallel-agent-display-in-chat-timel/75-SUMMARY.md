---
phase: quick-75
plan: 01
subsystem: frontend/composables
tags: [scroll-tracking, vue-composable, bug-fix]
dependency_graph:
  requires: []
  provides: [watch-based-scroll-listener]
  affects: [useScrollTracker, ChatTimeline, ConversationDetail]
tech_stack:
  added: []
  patterns: [vue-watch-immediate, ref-late-binding]
key_files:
  modified:
    - packages/frontend/src/composables/useScrollTracker.ts
decisions:
  - Used watch with immediate:true instead of onMounted to handle late-binding container refs
metrics:
  duration: 54s
  completed: "2026-04-06"
  tasks_completed: 1
  tasks_total: 1
---

# Quick Task 75: Fix useScrollTracker Late-Binding Ref Issue

Watch-based scroll listener attachment replacing onMounted to handle containerRef set after mount.

## What Was Done

### Task 1: Replace onMounted with watch-based scroll listener attachment
- **Commit:** e5061e3
- **Files:** `packages/frontend/src/composables/useScrollTracker.ts`
- Changed import from `onMounted` to `watch`
- Replaced `onMounted` block with `watch(containerRef, (newEl, oldEl) => {...}, { immediate: true })`
- Watch handler removes listener from old element and adds to new element
- Calls `checkBottom()` on initial attachment to set correct `isAtBottom` state
- Kept `onUnmounted` as safety net for cleanup

## Why This Fix Matters

The `onMounted` approach never attached the scroll listener because `containerRef` is `null` at mount time -- the parent component sets it in its own `onMounted` which runs after the child's. This caused `isAtBottom` to always remain `true`, breaking:
- Auto-scroll behavior (scrolled unconditionally instead of only when at bottom)
- Scroll position preservation (always assumed user was at bottom)
- New messages pill (never appeared because `isAtBottom` was always true)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compilation passes (vue-tsc --noEmit)
- "onMounted" does not appear in useScrollTracker.ts
- "watch(containerRef" appears in useScrollTracker.ts
- "immediate: true" appears in the watch options

## Self-Check: PASSED
