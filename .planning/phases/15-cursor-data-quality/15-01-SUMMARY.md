---
phase: 15-cursor-data-quality
plan: 01
subsystem: ingestion
tags: [cursor, normalizer, parser, vue, agent-filter]

requires:
  - phase: 14-ingestion-quality
    provides: "Title utils, model normalization, data quality migration pattern"
provides:
  - "Cursor assistant bubbles produce tool activity summaries instead of null content"
  - "Workspace path extraction from composerData for project name derivation"
  - "ConversationBrowser agent filter dropdown with Cursor option"
affects: [15-02-migration]

tech-stack:
  added: []
  patterns: ["Grouped tool-only bubble summarization in normalizer", "Workspace path to project name derivation"]

key-files:
  created: []
  modified:
    - packages/backend/src/ingestion/cursor-parser.ts
    - packages/backend/src/ingestion/cursor-normalizer.ts
    - packages/backend/src/ingestion/index.ts
    - packages/backend/tests/ingestion/cursor-normalizer.test.ts
    - packages/backend/tests/ingestion/cursor-ingest.test.ts
    - packages/frontend/src/components/ConversationBrowser.vue

key-decisions:
  - "Tool-only assistant bubbles produce grouped summary messages (e.g. 'Executed 3 tool calls') instead of being skipped entirely"
  - "Workspace path extracted from composerData fields (workspacePath, workspaceFolder, rootDir, context.workspacePath) with fallback chain"
  - "Project name derived from basename of workspace path, falling back to 'Cursor'"

patterns-established:
  - "Grouped tool activity summarization: consecutive tool-only bubbles merged into single summary message"

requirements-completed: [CURSOR-01, CURSOR-02, CURSOR-03]

duration: 5min
completed: 2026-03-05
---

# Phase 15 Plan 01: Cursor Data Quality Summary

**Tool activity summaries for empty assistant bubbles, workspace-derived project names, and Cursor agent filter in ConversationBrowser**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T12:39:55Z
- **Completed:** 2026-03-05T12:45:45Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Cursor assistant bubbles with no text content now produce descriptive tool activity summaries instead of null content (prevents "Empty response" in UI)
- Consecutive tool-only bubbles are grouped into a single summary message (e.g. "Executed 3 tool calls")
- CursorConversation interface extended with workspacePath field parsed from composerData
- index.ts derives project name from workspace path basename instead of hardcoding 'Cursor'
- ConversationBrowser agent filter dropdown dynamically renders from AGENTS constant, showing Cursor alongside Claude Code

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Cursor assistant content extraction and workspace path derivation** - `e3a0854` (feat)
2. **Task 2: Add Cursor to ConversationBrowser agent filter dropdown** - `709e244` (feat)

## Files Created/Modified
- `packages/backend/src/ingestion/cursor-parser.ts` - Added workspacePath field to CursorConversation, parsed from composerData
- `packages/backend/src/ingestion/cursor-normalizer.ts` - Replaced skip logic with grouped tool activity summaries for empty assistant bubbles
- `packages/backend/src/ingestion/index.ts` - Derive project name from workspace path basename with 'Cursor' fallback
- `packages/backend/tests/ingestion/cursor-normalizer.test.ts` - Added tests for content extraction, tool summaries, workspace path derivation
- `packages/backend/tests/ingestion/cursor-ingest.test.ts` - Updated integration tests for new tool summary behavior
- `packages/frontend/src/components/ConversationBrowser.vue` - Dynamic agent filter using AGENTS constant and AGENT_LABELS

## Decisions Made
- Tool-only assistant bubbles produce grouped summary messages instead of being skipped entirely, preventing "Empty response" in the UI
- Workspace path extracted from multiple possible composerData fields (workspacePath, workspaceFolder, rootDir, context.workspacePath) with fallback chain
- Project name derived from basename of workspace path, falling back to literal 'Cursor'

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed import path for agent-constants in ConversationBrowser**
- **Found during:** Task 2
- **Issue:** Used `@/utils/agent-constants` which doesn't resolve in vite build; project uses relative paths
- **Fix:** Changed to `../utils/agent-constants` matching existing convention
- **Files modified:** ConversationBrowser.vue
- **Verification:** Frontend build succeeds
- **Committed in:** 709e244 (Task 2 commit)

**2. [Rule 1 - Bug] Updated integration tests for new tool summary behavior**
- **Found during:** Task 1
- **Issue:** cursor-ingest.test.ts expected old skip behavior (2 messages for conv with tool bubble) but now produces 3 (with summary)
- **Fix:** Updated message count expectations and token usage assertions
- **Files modified:** cursor-ingest.test.ts
- **Verification:** All 363 tests pass
- **Committed in:** e3a0854 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Normalizer and parser changes ready for Plan 02 migration to retroactively fix existing data
- Workspace path extraction pattern established for migration to re-derive project names

---
*Phase: 15-cursor-data-quality*
*Completed: 2026-03-05*
