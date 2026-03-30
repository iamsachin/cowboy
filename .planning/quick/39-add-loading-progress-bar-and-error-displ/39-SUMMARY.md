---
phase: quick-39
plan: 01
subsystem: settings-ui, ingestion
tags: [progress-bar, error-handling, polling, daisyui]
dependency_graph:
  requires: []
  provides: [shared-ingestion-status, ingestion-progress-ui]
  affects: [settings-page, ingestion-pipeline, file-watcher]
tech_stack:
  added: []
  patterns: [shared-state-via-appstate, polling-composable, daisyui-progress]
key_files:
  created: []
  modified:
    - src-tauri/src/ingestion/types.rs
    - src-tauri/src/ingestion/mod.rs
    - src-tauri/src/server.rs
    - src-tauri/src/settings.rs
    - src-tauri/src/watcher.rs
    - packages/frontend/src/composables/useSettings.ts
    - packages/frontend/src/pages/SettingsPage.vue
decisions:
  - Used shared AppState field instead of per-route local status for ingestion tracking
  - 500ms polling interval balances responsiveness with server load
  - Success message shows stats inline rather than via toast
metrics:
  duration: 245s
  completed: "2026-03-30T13:58:30Z"
  tasks_completed: 2
  tasks_total: 2
  commits: 2
---

# Quick Task 39: Add Loading Progress Bar and Error Display Summary

Shared ingestion status on AppState with DaisyUI progress bar, error alerts, and auto-refreshing stats on the Settings page.

## What Was Done

### Task 1: Shared ingestion status on AppState (414c0f2)
- Added `error: Option<String>` field to `IngestionStatus` struct
- Added `ingestion_status: SharedStatus` to `AppStateInner` so all ingestion paths share one status
- Updated `routes()` in ingestion/mod.rs to use `State<AppState>` instead of route-local status
- Updated `refresh_db` in settings.rs to use shared status with 409 conflict check
- Updated `update_agent` in settings.rs to use shared status for re-ingestion
- Updated `watcher.rs` to use `state.ingestion_status` instead of creating a new one
- Updated `spawn_auto_ingest` to use shared status from AppState
- Error is set on status when ingestion fails, cleared on success

### Task 2: Frontend progress bar and error display (a9eabcc)
- Added `IngestionStatus` interface and `ingestionStatus` ref to useSettings composable
- Added polling functions: `startPollingIngestionStatus`, `stopPollingIngestionStatus`, `fetchIngestionStatus`
- Polling starts after successful POST to refresh-db, runs every 500ms, stops when ingestion completes
- Auto-refreshes DB stats when ingestion finishes
- Added DaisyUI progress bar showing "X / Y files" during ingestion
- Added error alert (red) when ingestion fails with error message
- Added success alert showing conversation count, files scanned, and duration
- Disabled Refresh buttons while ingestion is running
- Cleanup: poll timer cleared on component unmount

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `cargo build` compiles without errors (only pre-existing warnings)
- `npx vue-tsc --noEmit` passes cleanly
