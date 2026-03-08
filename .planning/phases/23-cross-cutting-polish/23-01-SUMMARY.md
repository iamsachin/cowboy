---
phase: 23-cross-cutting-polish
plan: 01
subsystem: ui
tags: [vue-router, localStorage, regex, typescript, daisyui]

requires:
  - phase: none
    provides: n/a
provides:
  - 404 catch-all route with cowboy-themed page
  - Sidebar collapsed state persistence via localStorage
  - Dead code removal (TurnCard.vue)
  - Word-boundary model badge matching
  - ConversationPlanEntry type for by-conversation API
affects: [24-browser-verification]

tech-stack:
  added: []
  patterns: [word-boundary regex for model string matching, localStorage persistence for UI state]

key-files:
  created:
    - packages/frontend/src/pages/NotFoundPage.vue
  modified:
    - packages/frontend/src/router/index.ts
    - packages/frontend/src/components/AppSidebar.vue
    - packages/frontend/src/utils/model-labels.ts
    - packages/shared/src/types/api.ts
    - packages/shared/src/types/index.ts
    - packages/frontend/src/pages/ConversationDetailPage.vue

key-decisions:
  - "Word-boundary regex uses model-string delimiters [-_./\\s] instead of \\b (digits are word chars in JS regex)"
  - "ConversationPlanEntry type separates by-conversation response from PlanDetailResponse"

patterns-established:
  - "localStorage sidebar persistence: read on init, watch to persist"
  - "Model matching via delimiter-bounded regex instead of substring includes()"

requirements-completed: [XCUT-01, XCUT-02, XCUT-06, XCUT-07, XCUT-08]

duration: 2min
completed: 2026-03-08
---

# Phase 23 Plan 01: Cross-Cutting Polish Summary

**404 catch-all route, sidebar localStorage persistence, TurnCard dead code removal, word-boundary model matching, and correct plan API type**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08T15:54:35Z
- **Completed:** 2026-03-08T15:56:47Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Cowboy-themed 404 page with DaisyUI hero layout and catch-all route
- Sidebar collapsed state persists across page reloads via localStorage
- Deleted unused TurnCard.vue (zero references in codebase)
- Model badge regex uses delimiter boundaries preventing false matches (e.g., 'o1' no longer matches 'sonnet-20240101')
- New ConversationPlanEntry type correctly models the by-conversation API response shape

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 404 page and catch-all route** - `273226e` (feat)
2. **Task 2: Persist sidebar state, delete TurnCard.vue dead code** - `b36b396` (feat)
3. **Task 3: Fix model badge regex and plan API type** - `2b0236f` (fix)

## Files Created/Modified
- `packages/frontend/src/pages/NotFoundPage.vue` - Cowboy-themed 404 page with back-to-overview link
- `packages/frontend/src/router/index.ts` - Added catch-all route at end of routes array
- `packages/frontend/src/components/AppSidebar.vue` - localStorage init and watcher for collapsed state
- `packages/frontend/src/components/TurnCard.vue` - Deleted (dead code)
- `packages/frontend/src/utils/model-labels.ts` - Word-boundary regex replacing includes()
- `packages/shared/src/types/api.ts` - New ConversationPlanEntry type
- `packages/shared/src/types/index.ts` - Export ConversationPlanEntry
- `packages/frontend/src/pages/ConversationDetailPage.vue` - Use ConversationPlanEntry instead of PlanDetailResponse

## Decisions Made
- Word-boundary regex uses model-string delimiters `[-_./\s]` instead of `\b` because JS regex treats digits as word characters, which would fail to match 'o1' after a dash
- Created separate ConversationPlanEntry type rather than reusing PlanDetailResponse, since by-conversation endpoint returns different shape (no conversationTitle, no sourceMessageId)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ConversationPlanEntry to shared package exports**
- **Found during:** Task 3
- **Issue:** New type was defined in api.ts but not re-exported from types/index.ts, so frontend import would fail
- **Fix:** Added ConversationPlanEntry to the export list in types/index.ts
- **Files modified:** packages/shared/src/types/index.ts
- **Verification:** vue-tsc --noEmit passes cleanly
- **Committed in:** 2b0236f (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for the import to work. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All five cross-cutting fixes complete and type-checked
- Ready for 23-02 plan or Phase 24 browser verification

---
*Phase: 23-cross-cutting-polish*
*Completed: 2026-03-08*
