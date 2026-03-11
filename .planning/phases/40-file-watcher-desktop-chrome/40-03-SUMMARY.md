---
phase: 40-file-watcher-desktop-chrome
plan: 03
subsystem: infra
tags: [cleanup, monorepo, typescript, tauri, migration]

# Dependency graph
requires:
  - phase: 36-tauri-scaffold
    provides: Tauri app scaffold with frontend
  - phase: 39-ingestion-engine
    provides: Rust ingestion engine replacing Node.js backend
  - phase: 40-01
    provides: File watcher and port configuration
provides:
  - Clean monorepo with only packages/frontend and Rust backend
  - All shared types consolidated in packages/frontend/src/types/
  - cargo tauri dev as sole entry point
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Local type imports from src/types/ barrel (no cross-package dependencies)"

key-files:
  created:
    - packages/frontend/src/types/analytics.ts
    - packages/frontend/src/types/api.ts
    - packages/frontend/src/types/database.ts
    - packages/frontend/src/types/pricing.ts
    - packages/frontend/src/types/websocket-events.ts
    - packages/frontend/src/types/index.ts
  modified:
    - package.json
    - packages/frontend/package.json
    - packages/frontend/tsconfig.json

key-decisions:
  - "Kept pnpm-workspace.yaml as 'packages/*' since only frontend remains"
  - "Used relative imports without file extensions (Vite resolves both .ts and extensionless)"

patterns-established:
  - "Frontend types barrel: all shared types re-exported from packages/frontend/src/types/index.ts"

requirements-completed: [DESK-03]

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 40 Plan 03: Node.js Backend Removal Summary

**Migrated shared types to frontend, deleted Node.js backend/shared/scripts, cleaned configs so cargo tauri dev is sole entry point**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T11:28:59Z
- **Completed:** 2026-03-11T11:32:44Z
- **Tasks:** 2
- **Files modified:** 151 (36 import updates + 115 deletions/config changes)

## Accomplishments
- Copied 5 shared type files to packages/frontend/src/types/ with barrel index
- Updated 36 frontend files to use local relative imports instead of @cowboy/shared
- Deleted packages/backend (22,524 lines), packages/shared, and scripts/ entirely
- Cleaned root package.json: dev=cargo tauri dev, removed concurrently, db scripts, better-sqlite3
- Removed 159 npm packages from lockfile

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate shared types to frontend and update all imports** - `61df4f1` (feat)
2. **Task 2: Delete Node.js backend, shared package, scripts, and clean configs** - `f79e1fa` (feat)

## Files Created/Modified
- `packages/frontend/src/types/analytics.ts` - Granularity type and autoGranularity function
- `packages/frontend/src/types/api.ts` - All API response types (256 lines)
- `packages/frontend/src/types/database.ts` - Core DB entity types
- `packages/frontend/src/types/pricing.ts` - MODEL_PRICING table and calculateCost
- `packages/frontend/src/types/websocket-events.ts` - WebSocket event types and type guards
- `packages/frontend/src/types/index.ts` - Barrel re-export matching former shared/types/index.ts
- `packages/frontend/package.json` - Removed @cowboy/shared dependency
- `packages/frontend/tsconfig.json` - Removed project reference to ../shared
- `package.json` - Simplified scripts, removed concurrently and better-sqlite3
- `pnpm-lock.yaml` - Cleaned (-159 packages)

## Decisions Made
- Kept pnpm-workspace.yaml glob pattern `packages/*` unchanged (only frontend remains, so it resolves correctly)
- Removed `better-sqlite3` from onlyBuiltDependencies but kept `esbuild` (used by Vite)
- Used extensionless imports in barrel index.ts (Vite resolves .ts extensions automatically)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed tsconfig project reference to ../shared**
- **Found during:** Task 2 (Vite build failed after deleting shared package)
- **Issue:** packages/frontend/tsconfig.json had `"references": [{ "path": "../shared" }]` which caused vite build to fail with ENOENT
- **Fix:** Removed the references array from tsconfig.json
- **Files modified:** packages/frontend/tsconfig.json
- **Verification:** vite build succeeds after removal
- **Committed in:** f79e1fa (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix - build would not succeed without removing the stale tsconfig reference. No scope creep.

## Issues Encountered
- Pre-existing vue-tsc type errors (6 chart.js animation type issues, 1 boolean assignability) unrelated to this plan's changes. These existed before the migration and are out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Monorepo is clean: only packages/frontend + src-tauri remain
- `cargo tauri dev` is the sole entry point
- All frontend type imports are local, no cross-package dependencies
- Phase 40 is complete

---
*Phase: 40-file-watcher-desktop-chrome*
*Completed: 2026-03-11*
