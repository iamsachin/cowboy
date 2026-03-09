---
phase: 25-data-quality-code-cleanup
plan: 02
subsystem: ui
tags: [vue, css, cleanup, dead-code, formatting]

requires:
  - phase: none
    provides: n/a
provides:
  - "Shared markdown-content.css for .thinking-content styling"
  - "Single formatCost utility (formatTurnCost removed)"
  - "ToolCallCard.vue dead code removed"
affects: [26-ux-enhancements, frontend-components]

tech-stack:
  added: []
  patterns: ["shared CSS via non-scoped style import for cross-component rendering"]

key-files:
  created:
    - packages/frontend/src/styles/markdown-content.css
  modified:
    - packages/frontend/src/components/AssistantGroupCard.vue
    - packages/frontend/src/components/SystemMessageIndicator.vue
    - packages/frontend/src/utils/format-tokens.ts

key-decisions:
  - "Used non-scoped <style> with @import for shared CSS rather than JS-based import"
  - "Union of both components' CSS rules into shared file (AssistantGroupCard had blockquote/a/hr extras)"

patterns-established:
  - "Shared CSS pattern: place in src/styles/, import via non-scoped <style> block"

requirements-completed: [CLEAN-01, CLEAN-02, CLEAN-03]

duration: 3min
completed: 2026-03-09
---

# Phase 25 Plan 02: Code Cleanup Summary

**Removed dead ToolCallCard.vue, consolidated formatTurnCost into formatCost, and extracted shared markdown CSS to single file**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T07:28:08Z
- **Completed:** 2026-03-09T07:30:43Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Deleted unused ToolCallCard.vue component (53 lines of dead code)
- Removed legacy formatTurnCost function, all cost display now uses formatCost with better precision handling
- Extracted 70 lines of shared markdown CSS from two components into packages/frontend/src/styles/markdown-content.css
- Reduced total CSS duplication by ~112 lines across AssistantGroupCard.vue and SystemMessageIndicator.vue

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete ToolCallCard.vue and consolidate cost formatters** - `6a8f0d8` (feat)
2. **Task 2: Extract shared markdown CSS from duplicated component styles** - `1ade98e` (refactor)

## Files Created/Modified
- `packages/frontend/src/styles/markdown-content.css` - Shared .thinking-content :deep() CSS rules
- `packages/frontend/src/components/AssistantGroupCard.vue` - Replaced formatTurnCost with formatCost, removed duplicated CSS
- `packages/frontend/src/components/SystemMessageIndicator.vue` - Removed duplicated CSS, imports shared file
- `packages/frontend/src/utils/format-tokens.ts` - Removed formatTurnCost function
- `packages/frontend/src/components/ToolCallCard.vue` - Deleted (dead code)

## Decisions Made
- Used non-scoped `<style>` with `@import` for shared CSS, since `:deep()` selectors need to target child component elements and scoped styles would add data attributes
- Took union of both components' CSS (AssistantGroupCard had blockquote, a, hr rules that SystemMessageIndicator did not)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript build errors in chart components (animation type mismatch) prevent `pnpm build` from succeeding, but Vite build confirms CSS compilation works correctly
- Pre-existing test failures in route count assertions unrelated to changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Codebase is cleaner with no dead components and unified formatting utilities
- Shared CSS pattern established for future markdown rendering components
- Ready for Phase 26+ feature development

---
*Phase: 25-data-quality-code-cleanup*
*Completed: 2026-03-09*
