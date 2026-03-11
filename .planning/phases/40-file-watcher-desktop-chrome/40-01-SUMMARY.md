---
phase: 40-file-watcher-desktop-chrome
plan: 01
subsystem: infra
tags: [notify, file-watcher, debounce, axum, tauri, settings]

# Dependency graph
requires:
  - phase: 39-ingestion-engine
    provides: run_ingestion orchestrator, SharedStatus, ingestion modules
provides:
  - notify-based file watcher with debounce (1s Claude, 3s Cursor)
  - Configurable server port (default 8123) via settings table
  - Watcher restart on agent settings change
  - refresh-db endpoint triggers full ingestion
  - PUT /api/settings/port endpoint
  - Server Configuration UI section with port input and toast
affects: [40-02, 40-03, desktop-app]

# Tech tracking
tech-stack:
  added: [notify 8, tray-icon, image-png]
  patterns: [mpsc bridge from notify to tokio, debounce via tokio::select!, oneshot shutdown signal]

key-files:
  created:
    - src-tauri/src/watcher.rs
  modified:
    - src-tauri/src/server.rs
    - src-tauri/src/settings.rs
    - src-tauri/src/ingestion/mod.rs
    - src-tauri/src/schema.sql
    - src-tauri/src/db.rs
    - src-tauri/src/lib.rs
    - src-tauri/Cargo.toml
    - src-tauri/tauri.conf.json
    - packages/frontend/vite.config.ts
    - packages/frontend/src/pages/SettingsPage.vue
    - packages/frontend/src/composables/useSettings.ts

key-decisions:
  - "mpsc channel bridge from notify sync callback to tokio async runtime"
  - "Debounce via tokio::select! with per-agent timer (1s Claude, 3s Cursor)"
  - "oneshot channel for clean watcher shutdown on settings change"
  - "ALTER TABLE migration in db.rs for server_port column on existing databases"
  - "Port toast uses inline alert (3s auto-dismiss) rather than full toast system for simplicity"

patterns-established:
  - "FileWatcherHandle pattern: Drop impl sends shutdown signal via oneshot channel"
  - "classify_event pure function for testable path-to-agent mapping"
  - "Watcher stored in AppStateInner behind tokio::sync::Mutex for restart capability"

requirements-completed: [WATCH-01, WATCH-02]

# Metrics
duration: 7min
completed: 2026-03-11
---

# Phase 40 Plan 01: File Watcher and Port Configuration Summary

**notify-based file watcher with debounce triggering ingestion on .jsonl/vscdb changes, server port configurable via Settings (default 8123)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-11T11:19:15Z
- **Completed:** 2026-03-11T11:26:07Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- File watcher module with classify_event, debounce_key, debounce_duration -- all 6 unit tests pass
- Full notify watcher implementation with tokio debounce loop and clean shutdown
- Server port changed from 3001 to 8123 (configurable via settings table and PUT endpoint)
- Settings page gains Server Configuration section with port input and restart toast
- refresh-db endpoint now triggers actual ingestion (was 501 stub)
- Agent settings changes restart watcher and trigger re-ingestion

## Task Commits

Each task was committed atomically:

1. **Task 0: Watcher module skeleton with unit tests** - `c6c8ea2` (feat)
2. **Task 1: Config updates, port change, and full watcher implementation** - `85430c0` (feat)
3. **Task 2: Settings integration -- watcher restart, refresh-db, and port UI** - `2f50a29` (feat)

## Files Created/Modified
- `src-tauri/src/watcher.rs` - File watcher module: AgentKind, classify_event, start_watcher with debounce
- `src-tauri/src/server.rs` - Added watcher field to AppStateInner, configurable port from settings
- `src-tauri/src/settings.rs` - server_port field, PUT /api/settings/port, watcher restart, refresh-db wired
- `src-tauri/src/ingestion/mod.rs` - Made SharedStatus and new_shared_status pub
- `src-tauri/src/schema.sql` - Added server_port column to settings table
- `src-tauri/src/db.rs` - ALTER TABLE migration for existing databases
- `src-tauri/src/lib.rs` - Added mod watcher, updated port comment
- `src-tauri/Cargo.toml` - Added notify = "8", tray-icon and image-png features
- `src-tauri/tauri.conf.json` - CSP connect-src updated to :8123
- `packages/frontend/vite.config.ts` - Proxy target updated to :8123
- `packages/frontend/src/pages/SettingsPage.vue` - Server Configuration section with port input
- `packages/frontend/src/composables/useSettings.ts` - serverPort field, savePortSettings function

## Decisions Made
- Used mpsc channel bridge from notify's sync callback to tokio async runtime (notify 8 uses sync callbacks)
- Debounce implemented with tokio::select! and per-agent timers rather than external debounce crate
- FileWatcherHandle Drop sends shutdown signal via oneshot channel for clean lifecycle
- Added ALTER TABLE migration in db.rs since schema.sql uses CREATE TABLE IF NOT EXISTS (won't add column to existing tables)
- Port toast uses inline alert component with 3s auto-dismiss rather than the global toast system

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ALTER TABLE migration for server_port column**
- **Found during:** Task 1
- **Issue:** schema.sql uses CREATE TABLE IF NOT EXISTS, so existing databases would not gain the new server_port column
- **Fix:** Added migration in db.rs that checks for column existence and runs ALTER TABLE if missing
- **Files modified:** src-tauri/src/db.rs
- **Verification:** cargo build succeeds
- **Committed in:** 85430c0 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Kept spawn_auto_ingest call alongside watcher**
- **Found during:** Task 1
- **Issue:** Plan suggested replacing spawn_auto_ingest with watcher, but initial ingestion on startup is still needed (watcher only catches future changes)
- **Fix:** Keep both: watcher for future file changes, spawn_auto_ingest for initial data load
- **Files modified:** src-tauri/src/server.rs
- **Verification:** cargo build succeeds
- **Committed in:** 85430c0 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness with existing databases and initial data loading. No scope creep.

## Issues Encountered
- Rust type inference issue with nested unwrap_or on db.call results -- resolved by using .ok().flatten() pattern instead of .unwrap_or(Ok(None)).unwrap_or(None)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- File watcher operational, ready for Plan 02 (system tray) and Plan 03 (Chrome extension)
- tray-icon and image-png features already added to Cargo.toml for Plan 02

---
*Phase: 40-file-watcher-desktop-chrome*
*Completed: 2026-03-11*
