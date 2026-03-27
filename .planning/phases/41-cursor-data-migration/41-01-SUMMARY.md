---
phase: 41-cursor-data-migration
plan: 01
subsystem: database
tags: [sqlite, migration, data-cleanup, cursor-removal]

# Dependency graph
requires: []
provides:
  - purge_cursor_data one-time migration function
  - cursor_data_purged field on MigrationResult
affects: [42-cursor-backend-removal, 43-cursor-watcher-pricing-removal]

# Tech tracking
tech-stack:
  added: []
  patterns: [one-time migration guard via migrations_applied table]

key-files:
  created: []
  modified:
    - src-tauri/src/ingestion/migration.rs
    - src-tauri/src/ingestion/mod.rs

key-decisions:
  - "Purge runs as FIRST operation in run_data_quality_migration to avoid wasting time on cursor data"
  - "Transaction wraps all deletes for atomicity"

patterns-established:
  - "One-time data purge migration: guard check, child-first deletion in transaction, migrations_applied insert"

requirements-completed: [DATA-01]

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 41 Plan 01: Cursor Data Migration Summary

**One-time startup migration that purges all Cursor conversations, child records, and .vscdb ingested files from the database**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T20:35:25Z
- **Completed:** 2026-03-27T20:39:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added purge_cursor_data() function following existing one-time migration guard pattern
- Deletes all cursor conversations and 7 child tables in child-first order within a transaction
- Removes .vscdb entries from ingested_files table
- Wired as first operation in run_data_quality_migration() so subsequent migrations skip cursor data
- Full test coverage: cursor data deleted, claude-code data untouched, idempotent on second run

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing test** - `204554e` (test)
2. **Task 1 (GREEN): Implement purge_cursor_data** - `dce6e59` (feat)
3. **Task 2: Compile check** - verification only, no code changes needed

## Files Created/Modified
- `src-tauri/src/ingestion/migration.rs` - Added purge_cursor_data function, cursor_data_purged MigrationResult field, test
- `src-tauri/src/ingestion/mod.rs` - Added cursor_data_purged to migration result logging condition

## Decisions Made
- Purge runs as FIRST operation in run_data_quality_migration to avoid wasting time fixing titles/models on cursor data about to be deleted
- All deletes wrapped in a single SQLite transaction for atomicity
- Child-first deletion order: plan_steps -> plans -> compaction_events -> token_usage -> tool_calls -> messages -> conversations -> ingested_files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added cursor_data_purged to mod.rs logging condition**
- **Found during:** Task 1 (implementation)
- **Issue:** mod.rs checks MigrationResult fields to decide whether to log; new field needed inclusion
- **Fix:** Added `result.cursor_data_purged > 0` to the condition in mod.rs
- **Files modified:** src-tauri/src/ingestion/mod.rs
- **Verification:** cargo check passes
- **Committed in:** dce6e59 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Cursor data purged from database on startup
- Phase 42 (cursor backend removal) can safely remove cursor-specific code without orphaned DB references
- 110 tests pass, project compiles cleanly

---
*Phase: 41-cursor-data-migration*
*Completed: 2026-03-28*
