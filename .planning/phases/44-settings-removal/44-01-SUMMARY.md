---
phase: 44-settings-removal
plan: 01
subsystem: database, api, ui
tags: [sqlite, migration, rust, vue, settings]

requires:
  - phase: 43-watcher-pricing-cleanup
    provides: Watcher and pricing stripped of Cursor references
provides:
  - Settings table schema without cursor columns
  - DB migration to drop cursor columns from existing installs
  - Settings API (GET/PUT/POST) without Cursor fields
  - Settings page UI with Claude Code only
affects: [45-frontend-removal, 46-verification]

tech-stack:
  added: []
  patterns: [SQLite table-recreate migration for column removal]

key-files:
  created: []
  modified:
    - src-tauri/src/schema.sql
    - src-tauri/src/db.rs
    - src-tauri/src/settings.rs
    - packages/frontend/src/composables/useSettings.ts
    - packages/frontend/src/pages/SettingsPage.vue

key-decisions:
  - "Used table-recreate migration pattern (CREATE new, INSERT SELECT, DROP old, RENAME) since SQLite cannot DROP COLUMN in older versions"
  - "Removed sync_cursor column alongside cursor_path/cursor_enabled -- unused pagination field with confusing name"

patterns-established:
  - "SQLite column removal: recreate table pattern in db.rs migrations"

requirements-completed: [SET-01, SET-02, SET-03]

duration: 3min
completed: 2026-03-28
---

# Phase 44 Plan 01: Settings Removal Summary

**Stripped all Cursor configuration from settings: DB schema columns, Rust API structs/handlers, Vue settings page UI, with SQLite migration for existing installs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T09:08:31Z
- **Completed:** 2026-03-28T09:11:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Removed cursor_path, cursor_enabled, sync_cursor columns from settings table schema
- Added SQLite migration in db.rs that recreates settings table without cursor columns for existing databases
- Stripped Cursor fields from SettingsResponse, AgentSettingsBody structs and all API handlers
- Removed Cursor toggle, path input, validation, and debounce watcher from Settings page UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Cursor from DB schema, migration, and settings API** - `0d12a30` (feat)
2. **Task 2: Remove Cursor from Settings page UI and composable** - `a2ea532` (feat)

## Files Created/Modified
- `src-tauri/src/schema.sql` - Settings table without cursor_path, cursor_enabled, sync_cursor columns
- `src-tauri/src/db.rs` - Added migration to recreate settings table without cursor columns
- `src-tauri/src/settings.rs` - Removed Cursor fields from structs, handlers, SQL queries, validate_path
- `packages/frontend/src/composables/useSettings.ts` - Removed Cursor fields from SettingsResponse and saveAgentSettings
- `packages/frontend/src/pages/SettingsPage.vue` - Removed Cursor toggle/path/validation UI, cursorDebounce, form fields

## Decisions Made
- Used table-recreate migration pattern since SQLite cannot DROP COLUMN in older versions
- Removed sync_cursor column (unused pagination cursor with confusing name) alongside cursor_path/cursor_enabled

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Settings layer fully cleaned of Cursor references
- Ready for Phase 45 (frontend removal) to strip remaining Cursor UI references
- Only db.rs migration check references cursor_path (intentional -- detects old schema)

---
*Phase: 44-settings-removal*
*Completed: 2026-03-28*
