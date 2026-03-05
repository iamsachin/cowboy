---
phase: 15-cursor-data-quality
plan: 02
subsystem: ingestion
tags: [cursor, migration, data-quality, idempotent]

requires:
  - phase: 15-cursor-data-quality
    plan: 01
    provides: "Workspace path extraction in parser, tool activity summaries in normalizer"
  - phase: 14-ingestion-quality
    provides: "Data quality migration framework (title/model fixes)"
provides:
  - "Retroactive fix for Cursor conversations with hardcoded 'Cursor' project name"
  - "Retroactive fix for null/empty assistant message content in Cursor conversations"
  - "Extended migration return type with cursor-specific fix counts"
affects: []

tech-stack:
  added: []
  patterns: ["Cursor DB re-read for retroactive data correction", "Deterministic ID reverse-lookup for bubble-to-message mapping"]

key-files:
  created: []
  modified:
    - packages/backend/src/ingestion/migration.ts
    - packages/backend/src/ingestion/index.ts
    - packages/backend/tests/ingestion/migration.test.ts

key-decisions:
  - "fixCursorProjects uses parseCursorDb + generateId reverse-lookup to map DB conversations to Cursor composerIds"
  - "fixCursorMessageContent re-derives content from bubble data when Cursor DB available, falls back to 'Executed tool call'"
  - "Both functions are idempotent via WHERE clause conditions (project='Cursor', content IS NULL)"

patterns-established:
  - "Deterministic ID reverse-lookup: use generateId to map between internal IDs and source system IDs"

requirements-completed: [CURSOR-01, CURSOR-03]

duration: 7min
completed: 2026-03-05
---

# Phase 15 Plan 02: Cursor Data Quality Migration Summary

**Retroactive migration fixing hardcoded 'Cursor' project names and null assistant content using Cursor DB re-read**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-05T12:48:14Z
- **Completed:** 2026-03-05T12:55:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- fixCursorProjects reads Cursor state.vscdb to derive workspace-based project names for conversations previously stored with 'Cursor'
- fixCursorMessageContent re-extracts assistant message content from Cursor bubble data, falling back to 'Executed tool call' placeholder
- runDataQualityMigration extended with cursor fix counts (cursorProjectsFixed, cursorMessagesFixed)
- Both functions are idempotent -- already-fixed records skip on subsequent runs
- 12 new tests covering project fix, content fix, idempotency, and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests for Cursor migration** - `666e0d2` (test)
2. **Task 1 (GREEN): Implement Cursor project and content migration** - `b9ba1ce` (feat)

## Files Created/Modified
- `packages/backend/src/ingestion/migration.ts` - Added fixCursorProjects, fixCursorMessageContent, extended runDataQualityMigration
- `packages/backend/src/ingestion/index.ts` - Updated log condition to include cursor fix counts
- `packages/backend/tests/ingestion/migration.test.ts` - 12 new tests for cursor-specific migration functions

## Decisions Made
- fixCursorProjects uses generateId('cursor', composerId) to reverse-map DB conversation IDs back to Cursor composerIds for workspace path lookup
- fixCursorMessageContent uses generateId(conversationId, bubbleId) to match message IDs to Cursor bubbles for content re-extraction
- Fallback to 'Executed tool call' for messages where Cursor DB is unavailable or bubble has no text content
- Both functions return 0 when no Cursor DB path provided (graceful degradation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated index.ts log condition for cursor fix counts**
- **Found during:** Task 1 (post-implementation review)
- **Issue:** runDataQualityMigration log trigger only checked titlesFixed/modelsFixed, not new cursor counts
- **Fix:** Added cursorProjectsFixed and cursorMessagesFixed to the log condition
- **Files modified:** packages/backend/src/ingestion/index.ts
- **Verification:** All 375 tests pass
- **Committed in:** b9ba1ce (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for observability of cursor migration results. No scope creep.

## Issues Encountered
- Mock Cursor DB data in tests was under 100 characters, falling below parseCursorDb's `LENGTH(value) > 100` filter. Fixed by adding padding data to mock composerData entries.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 15 complete -- all Cursor data quality fixes (normalizer, agent filter, migration) are in place
- Existing data will be retroactively fixed on next server startup via idempotent migration

---
*Phase: 15-cursor-data-quality*
*Completed: 2026-03-05*
