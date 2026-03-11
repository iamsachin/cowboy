---
phase: 36-tauri-scaffold-infrastructure
plan: 02
subsystem: database, infra, ui
tags: [tauri, rusqlite, tokio-rusqlite, sqlite, axum, splash-screen, vue]

# Dependency graph
requires:
  - phase: 36-01
    provides: "Tauri v2 project scaffold with axum server, Vite config, and CSP"
provides:
  - "Async SQLite database layer with tokio-rusqlite and WAL mode"
  - "Complete schema.sql with all 9 tables and 7 indexes matching Drizzle schema"
  - "Health endpoint with database connectivity verification"
  - "Startup splash screen polling /api/health until backend ready"
  - "Transparent title bar padding and drag region for macOS"
affects: [37-api-endpoints, 38-frontend-port, 39-ingestion-engine]

# Tech tracking
tech-stack:
  added: [tokio-rusqlite]
  patterns: [async-sqlite-via-call, splash-screen-health-poll, tauri-drag-region]

key-files:
  created:
    - src-tauri/src/db.rs
    - src-tauri/src/schema.sql
  modified:
    - src-tauri/src/lib.rs
    - src-tauri/src/server.rs
    - src-tauri/Cargo.toml
    - packages/frontend/src/App.vue
    - packages/frontend/src/components/AppSidebar.vue
    - packages/frontend/vite.config.ts

key-decisions:
  - "DB path uses Tauri identifier (com.cowboy.app) not product name for app data dir"
  - "tokio-rusqlite conn.call() pattern for all async DB operations"
  - "Splash screen polls /api/health every 500ms with 30s timeout"

patterns-established:
  - "Database access: Arc<tokio_rusqlite::Connection> as axum state, conn.call() for queries"
  - "Health check: /api/health returns {status, server, version, tables_ok} JSON"
  - "Splash screen: Vue reactive ref gates RouterView rendering until backend ready"

requirements-completed: [FOUND-04]

# Metrics
duration: 25min
completed: 2026-03-11
---

# Phase 36 Plan 02: Database + Splash Screen Summary

**Async SQLite database with tokio-rusqlite, 9-table schema, health endpoint with DB verification, and startup splash screen polling /api/health**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-11T06:10:00Z
- **Completed:** 2026-03-11T06:35:12Z
- **Tasks:** 4 (3 auto + 1 checkpoint)
- **Files modified:** 8

## Accomplishments
- Async SQLite database layer using tokio-rusqlite with WAL mode and foreign keys enabled
- Complete schema.sql with all 9 tables and 7 indexes matching existing Drizzle schema exactly
- Unit test validating schema creates 9 tables in-memory
- Axum health endpoint enhanced to query DB and return `tables_ok: true`
- Startup splash screen with cowboy hat and "Starting..." text, polls /api/health until backend ready
- Transparent title bar padding and draggable window region for macOS native feel
- End-to-end verified: splash screen, dashboard load, health JSON, SQLite DB with 9 tables

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database module with schema, unit test, and wire into axum** - `ee04e24` (feat)
2. **Task 2: Add transparent title bar CSS padding to sidebar** - `765fdbb` (feat)
3. **Task 3: Add startup splash screen that polls /api/health** - `f520770` (feat)
4. **Task 4: Verify Tauri app end-to-end** - checkpoint approved by user

## Files Created/Modified
- `src-tauri/src/db.rs` - Async database init with tokio-rusqlite, WAL mode, schema execution, unit tests
- `src-tauri/src/schema.sql` - Complete SQLite schema with 9 tables and 7 indexes
- `src-tauri/src/lib.rs` - Setup hook wiring DB init and passing Connection to axum
- `src-tauri/src/server.rs` - Health endpoint with DB state, tables_ok verification
- `src-tauri/Cargo.toml` - Added tokio-rusqlite dependency
- `packages/frontend/src/App.vue` - Splash screen with health polling and timeout
- `packages/frontend/src/components/AppSidebar.vue` - Traffic light padding and drag region
- `packages/frontend/vite.config.ts` - Fixed API proxy port to 3001

## Decisions Made
- DB path resolves via Tauri's `app.path().app_data_dir()` which uses the identifier `com.cowboy.app`, not the product name. Actual path: `~/Library/Application Support/com.cowboy.app/cowboy.db`
- Used `tauri::async_runtime::block_on()` in the synchronous setup hook to await async DB init
- Splash screen uses DaisyUI base colors for theme consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Vite proxy port from 3000 to 3001**
- **Found during:** Task 4 (E2E verification checkpoint)
- **Issue:** Vite dev proxy was pointing to port 3000 (Node.js backend) instead of 3001 (axum backend), causing health check to hit the wrong server during `cargo tauri dev`
- **Fix:** Updated `packages/frontend/vite.config.ts` proxy target from `:3000` to `:3001`
- **Files modified:** packages/frontend/vite.config.ts
- **Verification:** Health endpoint returns correct axum JSON via Vite proxy
- **Committed in:** `938dec1`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for Tauri dev workflow. No scope creep.

## Issues Encountered
None beyond the proxy port fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Database layer complete and verified, ready for API endpoint implementation in Phase 37
- Splash screen and health check pattern established for frontend-backend coordination
- Schema matches Drizzle exactly, enabling parallel migration testing
- Blocker note: CSP only manifests in `tauri build` not `tauri dev` -- needs verification before Phase 36 closes

## Self-Check: PASSED

- All 8 files verified present on disk
- All 4 commits verified in git history (ee04e24, 765fdbb, f520770, 938dec1)

---
*Phase: 36-tauri-scaffold-infrastructure*
*Completed: 2026-03-11*
