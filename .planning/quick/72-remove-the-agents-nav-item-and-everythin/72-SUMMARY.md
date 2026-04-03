---
phase: quick-72
plan: 01
subsystem: frontend
tags: [cleanup, navigation, sidebar]
dependency_graph:
  requires: []
  provides: [no-agents-nav, no-agents-route, no-agents-page]
  affects: [sidebar, router, command-palette]
tech_stack:
  added: []
  patterns: []
key_files:
  modified:
    - packages/frontend/src/components/AppSidebar.vue
    - packages/frontend/src/router/index.ts
    - packages/frontend/src/composables/useCommandPalette.ts
    - packages/frontend/tests/app.test.ts
  deleted:
    - packages/frontend/src/pages/AgentsPage.vue
    - packages/frontend/src/composables/useAgentAnalytics.ts
decisions: []
metrics:
  duration: 100s
  completed: "2026-04-03T22:28:33Z"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 72: Remove the Agents Nav Item and Everything Related

Removed Agents nav item, route, page, composable, command palette entry, and test -- eliminating a redundant view that duplicated Overview functionality.

## Task Summary

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Remove Agents route, nav item, command palette entry, and test | c58cf65 | Done |
| 2 | Delete AgentsPage.vue and useAgentAnalytics.ts | f92c2bf | Done |

## Changes Made

### Task 1: Remove Agents route, nav item, command palette entry, and test
- **AppSidebar.vue**: Removed Agents entry from `navItems` array and removed unused `Bot` import from lucide-vue-next
- **router/index.ts**: Removed `/agents` route object
- **useCommandPalette.ts**: Removed Agents entry from `PAGES` array
- **tests/app.test.ts**: Removed `/agents` route test; fixed route count assertion from 9 to 6 (was already stale at 9, actual was 7 before this change)

### Task 2: Delete AgentsPage.vue and useAgentAnalytics.ts
- Deleted `AgentsPage.vue` (redundant page component)
- Deleted `useAgentAnalytics.ts` (composable only used by AgentsPage)
- Confirmed via grep that no other file imports useAgentAnalytics

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale route count in test**
- **Found during:** Task 1
- **Issue:** Test asserted 9 named routes but only 7 existed (plans routes were removed in quick-55 without updating count). After removing agents route, count became 6.
- **Fix:** Updated assertion from `toHaveLength(9)` to `toHaveLength(6)`
- **Files modified:** packages/frontend/tests/app.test.ts
- **Commit:** c58cf65

## Verification

- TypeScript compiles cleanly (`vue-tsc --noEmit` passes)
- All app tests pass (7/7)
- Pre-existing test failures in `useConversationDetail.test.ts` are unrelated (debounce timing)
- No dangling imports of deleted files
