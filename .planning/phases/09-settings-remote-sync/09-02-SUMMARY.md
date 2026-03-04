---
phase: 09-settings-remote-sync
plan: 02
subsystem: api, plugins
tags: [fastify, sync-scheduler, exponential-backoff, file-watcher, incremental-sync, fp-plugin]

# Dependency graph
requires:
  - phase: 09-settings-remote-sync
    provides: "Settings table, getSettings/updateSyncSettings/updateSyncStatus queries, settings API routes"
  - phase: 02-ingestion-pipeline
    provides: "File watcher plugin pattern, ingestion plugin, POST /api/ingest endpoint"
  - phase: 05-live-updates
    provides: "fp() plugin pattern from websocket plugin, broadcast decorator"
provides:
  - "sync-scheduler.ts Fastify plugin with interval scheduler, retry, and incremental payload"
  - "postWithRetry function with exponential backoff (3 retries, 5s/10s/20s delays)"
  - "buildSyncPayload function for category-filtered incremental sync data"
  - "File watcher restart capability via app.fileWatcher.restart()"
  - "Settings routes wired to scheduler and file watcher (start/stop/restart)"
  - "POST /settings/sync-now triggers immediate sync via scheduler"
affects: [09-03-settings-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Lazy dynamic import of DB module to avoid test side-effects", "fp() plugin pattern extended to file-watcher for decorator propagation", "syncing boolean guard to prevent overlapping async setInterval ticks"]

key-files:
  created:
    - packages/backend/src/plugins/sync-scheduler.ts
    - packages/backend/tests/settings/retry-backoff.test.ts
    - packages/backend/tests/settings/sync-payload.test.ts
    - packages/backend/tests/settings/sync-scheduler.test.ts
  modified:
    - packages/backend/src/plugins/file-watcher.ts
    - packages/backend/src/routes/settings.ts
    - packages/backend/src/app.ts
    - packages/backend/src/db/queries/settings.ts

key-decisions:
  - "Lazy dynamic import of getSettings in file-watcher to avoid DB connection side-effect during test module loading"
  - "File watcher uses opts.basePath presence as test-mode signal to skip DB settings lookup"
  - "syncCursor added to updateSyncStatus for incremental sync cursor advancement"

patterns-established:
  - "Lazy DB import pattern: use dynamic import() inside try/catch for plugins that may be loaded without DB"
  - "Test-mode detection: explicit opts.basePath signals test context, skipping production DB reads"
  - "Syncing guard pattern: boolean flag prevents overlapping async interval ticks"

requirements-completed: [SYNC-01, SYNC-02, SYNC-03]

# Metrics
duration: 9min
completed: 2026-03-04
---

# Phase 9 Plan 2: Sync Scheduler & Settings Wiring Summary

**Background sync scheduler with exponential backoff retry, incremental category-filtered payloads, and file watcher restart wired to settings changes**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-04T17:11:04Z
- **Completed:** 2026-03-04T17:20:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Sync scheduler Fastify plugin that POSTs incremental data to configured URL on schedule with syncing guard to prevent overlap
- postWithRetry with exponential backoff (3 retries, 5s/10s/20s delays, 30s timeout per request, jittered delays)
- buildSyncPayload selects only configured categories and filters by syncCursor for incremental sync
- File watcher refactored with fp() encapsulation breaking and restart capability for dynamic path changes
- Settings routes wired: PUT /settings/agent restarts file watcher, PUT /settings/sync starts/stops scheduler, POST /settings/sync-now triggers immediate sync
- 15 new tests plus all 280 existing tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Sync scheduler plugin with retry and incremental payload** - `ba2acf8` (feat, TDD)
2. **Task 2: Wire settings into file watcher and scheduler** - `1ad895d` (feat)

## Files Created/Modified
- `packages/backend/src/plugins/sync-scheduler.ts` - Fastify plugin with postWithRetry, buildSyncPayload, scheduler start/stop/syncNow, fp() wrapped
- `packages/backend/tests/settings/retry-backoff.test.ts` - 6 tests for exponential backoff retry logic
- `packages/backend/tests/settings/sync-payload.test.ts` - 4 tests for category filtering and incremental cursor
- `packages/backend/tests/settings/sync-scheduler.test.ts` - 5 tests for scheduler plugin lifecycle and sync execution
- `packages/backend/src/plugins/file-watcher.ts` - Refactored with fp(), restart capability, settings-aware paths, lazy DB import
- `packages/backend/src/routes/settings.ts` - Wired PUT /settings/agent to fileWatcher.restart(), PUT /settings/sync to scheduler start/stop, sync-now to syncNow()
- `packages/backend/src/app.ts` - Added syncSchedulerPlugin registration after file watcher
- `packages/backend/src/db/queries/settings.ts` - Added syncCursor to updateSyncStatus signature

## Decisions Made
- Lazy dynamic import of getSettings in file-watcher to avoid DB connection side-effect when tests import the module without a database
- File watcher uses presence of opts.basePath as test-mode signal: when provided, skips DB settings lookup to maintain test isolation
- Added syncCursor to updateSyncStatus (Rule 2 -- missing critical functionality needed for incremental sync cursor advancement)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added syncCursor to updateSyncStatus**
- **Found during:** Task 1 (sync scheduler implementation)
- **Issue:** updateSyncStatus did not accept syncCursor parameter, but scheduler needs to update the cursor after successful sync
- **Fix:** Added syncCursor as optional field to the updateSyncStatus data parameter
- **Files modified:** packages/backend/src/db/queries/settings.ts
- **Verification:** Sync scheduler tests verify syncCursor is updated after successful sync
- **Committed in:** ba2acf8 (Task 1 commit)

**2. [Rule 3 - Blocking] Lazy import of getSettings in file-watcher plugin**
- **Found during:** Task 2 (file watcher refactoring)
- **Issue:** Top-level import of getSettings triggered DB module side-effect (SQLite connection), breaking file-watcher tests that don't set DATABASE_URL
- **Fix:** Changed to dynamic import() inside try/catch blocks, only called at runtime when needed
- **Files modified:** packages/backend/src/plugins/file-watcher.ts
- **Verification:** All file-watcher tests pass (4/4), full suite passes (280/280)
- **Committed in:** 1ad895d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both fixes essential for correctness and test isolation. No scope creep.

## Issues Encountered
- File-watcher tests initially failed after fp() refactoring because getSettings import chain connected to SQLite at module load time, causing Cursor watchers to start on the real filesystem. Resolved by using lazy dynamic imports and test-mode detection via opts.basePath.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sync scheduler fully functional -- Plan 03 (frontend settings page) can trigger sync-now, display sync status, and manage sync configuration
- File watcher restart works -- Plan 03 can save agent paths and see watchers restart
- All 6 settings API endpoints are fully wired and ready for frontend consumption

## Self-Check: PASSED

All 8 files verified present. Both commits verified in git log (ba2acf8, 1ad895d).
