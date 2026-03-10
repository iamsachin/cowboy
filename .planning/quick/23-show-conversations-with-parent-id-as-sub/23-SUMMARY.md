---
phase: quick-23
plan: 01
subsystem: ui, api
tags: [vue, drizzle, parent-child, sub-rows, tree-view]

provides:
  - "Child conversations rendered as indented sub-rows beneath parents in both tables"
  - "Pagination counts exclude child conversations"
affects: [conversation-tables, analytics-queries]

tech-stack:
  added: []
  patterns: ["displayRows computed flattening parent+children for table rendering"]

key-files:
  created: []
  modified:
    - packages/backend/src/db/queries/analytics.ts
    - packages/shared/src/types/api.ts
    - packages/frontend/src/components/ConversationTable.vue
    - packages/frontend/src/components/ConversationBrowser.vue
    - packages/frontend/src/app.css

key-decisions:
  - "Children fetched in separate query after parents, costs computed separately"
  - "Children always expanded with no toggle, using sub-row class for muted background"

requirements-completed: [QUICK-23]

duration: 3min
completed: 2026-03-10
---

# Quick Task 23: Show Conversations with Parent ID as Sub-rows Summary

**Child conversations nested as indented sub-rows with tree-line connectors beneath parents in both ConversationTable and ConversationBrowser**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T17:54:50Z
- **Completed:** 2026-03-10T17:57:41Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Backend excludes child conversations from pagination counts and main query, fetches them separately and nests under parent rows
- Both ConversationTable (overview) and ConversationBrowser (main browser) render children as indented sub-rows with muted background and tree-line connector
- Pagination totals correctly count only parent/standalone conversations

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend -- exclude children from pagination and nest under parents** - `03ae387` (feat)
2. **Task 2: Frontend -- render sub-rows with tree-line visual treatment in both tables** - `708fe92` (feat)

## Files Created/Modified
- `packages/shared/src/types/api.ts` - Added optional `children` field to ConversationRow
- `packages/backend/src/db/queries/analytics.ts` - Excluded children from main query/count, fetched children separately, attached to parent rows with costs
- `packages/frontend/src/components/ConversationTable.vue` - Added displayRows computed, sub-row rendering with tree connector
- `packages/frontend/src/components/ConversationBrowser.vue` - Same displayRows pattern, removed parentTitle subtitle (hierarchy now visual)
- `packages/frontend/src/app.css` - Added sub-row CSS for muted background styling

## Decisions Made
- Children fetched in a separate query after parent rows to keep pagination logic clean
- Tree connector uses Unicode corner character plus left border for visual hierarchy
- Removed "from: parentTitle" subtitle in ConversationBrowser since nesting makes the relationship visually obvious
- BotIcon kept on child rows as a small subagent indicator

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- Feature complete and ready for use
- No blockers

---
*Quick Task: 23*
*Completed: 2026-03-10*
