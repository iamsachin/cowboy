---
phase: 45-frontend-removal
plan: 01
subsystem: ui
tags: [vue, cursor-removal, frontend, agent-constants, pricing]

requires:
  - phase: 44-settings-removal
    provides: Settings page Cursor removal complete
provides:
  - Zero Cursor agent references in frontend source code
  - Single-agent AgentsPage showing Claude Code only
  - Cleaned pricing table with Claude models only
affects: [46-verification]

tech-stack:
  added: []
  patterns: [single-agent-ui]

key-files:
  created: []
  modified:
    - packages/frontend/src/utils/agent-constants.ts
    - packages/frontend/src/types/pricing.ts
    - packages/frontend/src/pages/AgentsPage.vue
    - packages/frontend/src/pages/PlansPage.vue
    - packages/frontend/src/pages/OverviewPage.vue
    - packages/frontend/src/components/AgentBadge.vue
    - packages/frontend/src/utils/content-sanitizer.ts
    - packages/frontend/tests/composables/useCommandPalette.test.ts

key-decisions:
  - "AgentsPage uses static ref('claude-code') instead of computed from route tab"
  - "Cleaned AgentBadge cursor branch and content-sanitizer comment as additional cursor references"

patterns-established:
  - "Single-agent pattern: no tabs, no comparison, direct claude-code references"

requirements-completed: [UI-01, UI-02, UI-03, UI-04]

duration: 2min
completed: 2026-03-28
---

# Phase 45 Plan 01: Frontend Removal Summary

**Removed all Cursor references from Vue frontend: agent constants, pricing table, AgentsPage tabs/comparison, filter dropdowns, and 4 deleted files**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T09:38:44Z
- **Completed:** 2026-03-28T09:41:07Z
- **Tasks:** 2
- **Files modified:** 8 modified, 4 deleted

## Accomplishments
- Removed all cursor entries from agent constants (AGENT_COLORS, AGENT_LABELS, AGENT_THEME_CLASSES, AGENTS array)
- Removed Cursor-specific Claude model aliases and all OpenAI model entries from pricing table
- Deleted useAgentComparison.ts composable, ComparisonCard.vue, AgentOverlayChart.vue, AgentActivityChart.vue
- Simplified AgentsPage from tabbed multi-agent view to single-agent Claude Code page
- Removed Cursor option from PlansPage filter dropdown
- Updated OverviewPage empty state and test fixtures

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Cursor from constants, pricing, composable, and minor pages** - `427c951` (feat)
2. **Task 2: Simplify AgentsPage to single-agent and delete comparison components** - `5971fa8` (feat)

## Files Created/Modified
- `packages/frontend/src/utils/agent-constants.ts` - Removed cursor entries from all constant maps, AGENTS now ['claude-code'] only
- `packages/frontend/src/types/pricing.ts` - Removed Cursor-specific aliases and OpenAI model pricing
- `packages/frontend/src/composables/useAgentComparison.ts` - Deleted (cursor comparison fetching)
- `packages/frontend/src/pages/AgentsPage.vue` - Rewritten as single-agent page without tabs/comparison
- `packages/frontend/src/pages/PlansPage.vue` - Removed Cursor option from agent filter dropdown
- `packages/frontend/src/pages/OverviewPage.vue` - Updated empty state text
- `packages/frontend/src/components/ComparisonCard.vue` - Deleted
- `packages/frontend/src/components/AgentOverlayChart.vue` - Deleted
- `packages/frontend/src/components/AgentActivityChart.vue` - Deleted
- `packages/frontend/src/components/AgentBadge.vue` - Removed cursor badge class branch
- `packages/frontend/src/utils/content-sanitizer.ts` - Removed Cursor mention from comment
- `packages/frontend/tests/composables/useCommandPalette.test.ts` - Changed cursor/gpt-4 fixtures to claude-code/claude-3

## Decisions Made
- AgentsPage uses `ref('claude-code')` instead of computed from route tab -- simpler since there's only one agent
- Cleaned two additional cursor references found in AgentBadge and content-sanitizer (Rule 1 - dead code)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Dead Code] Removed cursor branch from AgentBadge.vue**
- **Found during:** Task 2 (final verification)
- **Issue:** AgentBadge still had `if (props.agent === 'cursor') return 'badge-secondary'` branch
- **Fix:** Removed the dead cursor branch
- **Files modified:** packages/frontend/src/components/AgentBadge.vue
- **Committed in:** 5971fa8 (Task 2 commit)

**2. [Rule 1 - Dead Code] Removed Cursor mention from content-sanitizer comment**
- **Found during:** Task 2 (final verification)
- **Issue:** JSDoc comment mentioned "Claude Code and Cursor"
- **Fix:** Changed to "Claude Code"
- **Files modified:** packages/frontend/src/utils/content-sanitizer.ts
- **Committed in:** 5971fa8 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 dead code)
**Impact on plan:** Both cleanups necessary for zero-cursor-references goal. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All frontend Cursor references eliminated
- Ready for Phase 46 verification pass
- Pre-existing TypeScript warnings (animation types, ConversationBrowser) remain unchanged

---
*Phase: 45-frontend-removal*
*Completed: 2026-03-28*
