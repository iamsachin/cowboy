---
phase: 42-ingestion-pipeline-removal
plan: 01
subsystem: ingestion
tags: [rust, cursor-removal, code-cleanup, ingestion-pipeline]

# Dependency graph
requires:
  - phase: 41-cursor-data-migration
    provides: purge_cursor_data migration that cleans cursor records from DB
provides:
  - Clean ingestion pipeline with zero Cursor code (only Claude Code JSONL processing)
  - Simplified MigrationResult struct without cursor-specific fields
affects: [43-watcher-pricing-removal, 44-settings-removal]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src-tauri/src/ingestion/mod.rs
    - src-tauri/src/ingestion/migration.rs
    - src-tauri/src/ingestion/id_generator.rs

key-decisions:
  - "Preserved purge_cursor_data() in migration.rs as the Phase 41 data cleanup migration"
  - "Removed Cursor 'default' model fix from fix_conversation_models since cursor data is purged"

patterns-established: []

requirements-completed: [ING-01, ING-02, ING-03, ING-04, ING-05]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 42 Plan 01: Ingestion Pipeline Removal Summary

**Deleted 3 Cursor modules (~1700 lines) and stripped all Cursor processing from ingestion orchestrator and data migrations**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T20:59:29Z
- **Completed:** 2026-03-27T21:02:43Z
- **Tasks:** 2
- **Files modified:** 5 (3 deleted, 2 modified)

## Accomplishments
- Deleted cursor_parser.rs, cursor_normalizer.rs, cursor_file_discovery.rs (3 Cursor-specific modules)
- Stripped all Cursor module declarations, imports, and processing code from the ingestion orchestrator (mod.rs)
- Removed fix_cursor_projects() and fix_cursor_message_content() migration functions and Cursor 'default' model fix block
- Preserved purge_cursor_data() as the Phase 41 data cleanup migration
- All 85 tests pass, zero compilation errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete Cursor modules and strip mod.rs** - `5893bec` (feat)
2. **Task 2: Remove Cursor migrations from migration.rs** - `dc48d0c` (feat)

## Files Created/Modified
- `src-tauri/src/ingestion/cursor_parser.rs` - DELETED (Cursor DB parsing)
- `src-tauri/src/ingestion/cursor_normalizer.rs` - DELETED (Cursor conversation normalization)
- `src-tauri/src/ingestion/cursor_file_discovery.rs` - DELETED (Cursor DB file discovery)
- `src-tauri/src/ingestion/mod.rs` - Removed Cursor imports, module declarations, process_cursor_conversations(), and cursor ingestion section
- `src-tauri/src/ingestion/migration.rs` - Removed fix_cursor_projects(), fix_cursor_message_content(), Cursor 'default' model fix, cursor fields from MigrationResult
- `src-tauri/src/ingestion/id_generator.rs` - Removed matches_nodejs_cursor test

## Decisions Made
- Preserved purge_cursor_data() in migration.rs -- it is the Phase 41 data cleanup migration that runs on startup to clean any remnant cursor data
- Removed Cursor 'default' model fix block from fix_conversation_models() since cursor data is now purged before this runs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ingestion pipeline is now Claude Code-only, ready for Phase 43 (Watcher/Pricing Removal)
- The watcher module still has a `classify_event_vscdb_returns_cursor` test that will need removal in Phase 43

---
*Phase: 42-ingestion-pipeline-removal*
*Completed: 2026-03-28*
