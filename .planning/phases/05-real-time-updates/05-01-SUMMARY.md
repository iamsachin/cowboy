---
phase: 05-real-time-updates
plan: 01
subsystem: api, infra
tags: [websocket, fastify, chokidar, file-watcher, real-time, broadcast]

# Dependency graph
requires:
  - phase: 02-data-layer
    provides: ingestion plugin with runIngestion(), POST /ingest, GET /ingest/status
provides:
  - WebSocket plugin with /api/ws route and broadcast decorator
  - File watcher plugin with chokidar, 1s global debounce, clean shutdown
  - Ingestion onIngestionComplete callback hook
  - Vite dev proxy WebSocket upgrade support
affects: [05-real-time-updates plan 02, frontend composables]

# Tech tracking
tech-stack:
  added: ["@fastify/websocket ^11.2.0", "chokidar ^5.0.0", "ws ^8.19.0", "@types/ws ^8.18.1", "fastify-plugin"]
  patterns: [fp() for decorator propagation, chokidar file watcher as Fastify plugin, WebSocket broadcast decorator]

key-files:
  created:
    - packages/backend/src/plugins/websocket.ts
    - packages/backend/src/plugins/file-watcher.ts
    - packages/backend/tests/websocket.test.ts
    - packages/backend/tests/file-watcher.test.ts
  modified:
    - packages/backend/src/app.ts
    - packages/backend/src/ingestion/index.ts
    - packages/frontend/vite.config.ts
    - packages/backend/package.json

key-decisions:
  - "Used fp() (fastify-plugin) to break WebSocket plugin encapsulation so broadcast decorator propagates to root Fastify instance"
  - "Added ws as direct dependency to satisfy pnpm strict hoisting (transitive dep of @fastify/websocket)"
  - "Chokidar v5 installed (latest) instead of v4 -- same API, ESM-native, fewer dependencies"
  - "WebSocket route registered at /api/ws directly (not via prefix) to work with fp() encapsulation breaking"
  - "File watcher onFilesChanged uses app.inject POST /api/ingest to reuse existing ingestion route guards"

patterns-established:
  - "fp() wrapper for plugins that need decorators visible at root scope"
  - "Chokidar watcher as Fastify plugin with onClose hook for clean shutdown"
  - "Global debounce pattern for file system events (clear + reset setTimeout)"

requirements-completed: [INGEST-04, LIVE-01]

# Metrics
duration: 6min
completed: 2026-03-04
---

# Phase 5 Plan 1: Backend Real-Time Infrastructure Summary

**WebSocket broadcast and chokidar file watcher as Fastify plugins with ingestion callback wiring and Vite proxy**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-04T09:44:58Z
- **Completed:** 2026-03-04T09:50:56Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- WebSocket endpoint at /api/ws with connection confirmation and broadcast to all clients
- File watcher plugin detects new/modified .jsonl files with 1s global debounce
- Ingestion completion triggers broadcast of data-changed signal to all WebSocket clients
- Full test coverage: 7 new tests (3 WebSocket + 4 file watcher), all 127 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create WebSocket + file watcher plugins** - `2ebca96` (feat)
2. **Task 2: Wire plugins into app.ts, add ingestion callback, update Vite proxy, and write tests** - `8ca6104` (feat)

## Files Created/Modified
- `packages/backend/src/plugins/websocket.ts` - WebSocket plugin with /api/ws route, connected message, broadcast decorator via fp()
- `packages/backend/src/plugins/file-watcher.ts` - Chokidar file watcher plugin with 1s global debounce, .jsonl filtering, clean shutdown
- `packages/backend/src/app.ts` - Updated to register websocket (first), ingestion with onIngestionComplete, file-watcher with inject-based trigger
- `packages/backend/src/ingestion/index.ts` - Added onIngestionComplete callback to IngestionPluginOptions and finally block
- `packages/frontend/vite.config.ts` - Added ws: true to /api proxy for WebSocket upgrade forwarding
- `packages/backend/package.json` - Added @fastify/websocket, chokidar, ws, fastify-plugin, @types/ws
- `packages/backend/tests/websocket.test.ts` - 3 tests: connection confirmation, broadcast delivery, closed-client handling
- `packages/backend/tests/file-watcher.test.ts` - 4 tests: add detection, modify detection, non-jsonl filtering, debounce

## Decisions Made
- Used fp() (fastify-plugin) to break WebSocket plugin encapsulation so broadcast decorator propagates to root Fastify instance -- without this, broadcast was scoped and unavailable in app.ts
- Added ws as direct dependency for pnpm strict hoisting -- @fastify/websocket depends on ws but pnpm doesn't hoist transitive deps by default
- Chokidar v5 installed as latest -- research suggested v4 but v5 has same API with ESM-native and fewer dependencies
- WebSocket route registered directly at /api/ws path (not via prefix option) because fp() breaks encapsulation and ignores prefix
- File watcher callback uses app.inject to POST /api/ingest rather than calling runIngestion() directly -- reuses existing 409 concurrency guard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ws as direct dependency for pnpm strict hoisting**
- **Found during:** Task 2 (WebSocket tests)
- **Issue:** `import { WebSocket } from 'ws'` failed because ws is a transitive dependency of @fastify/websocket but not hoisted by pnpm
- **Fix:** `pnpm add ws` in backend package
- **Files modified:** packages/backend/package.json, pnpm-lock.yaml
- **Verification:** TypeScript compiles, all tests pass
- **Committed in:** 8ca6104 (Task 2 commit)

**2. [Rule 1 - Bug] Used fp() to fix broadcast decorator scoping**
- **Found during:** Task 2 (WebSocket tests)
- **Issue:** `app.broadcast` was undefined on root Fastify instance because websocketPlugin was registered as scoped plugin with prefix, keeping decorators encapsulated
- **Fix:** Wrapped websocketPlugin with fp() from fastify-plugin to break encapsulation; changed route to use full /api/ws path directly; registered without prefix
- **Files modified:** packages/backend/src/plugins/websocket.ts, packages/backend/src/app.ts
- **Verification:** All 3 WebSocket tests pass, broadcast works from root app
- **Committed in:** 8ca6104 (Task 2 commit)

**3. [Rule 3 - Blocking] Added fastify-plugin as dependency**
- **Found during:** Task 2 (fixing broadcast scoping)
- **Issue:** fastify-plugin needed but not installed
- **Fix:** `pnpm add fastify-plugin` in backend package
- **Files modified:** packages/backend/package.json, pnpm-lock.yaml
- **Verification:** TypeScript compiles, all tests pass
- **Committed in:** 8ca6104 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All fixes necessary for correct functionality. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend real-time infrastructure complete and tested
- Ready for Plan 02: frontend WebSocket composable with reconnection, connection status indicator, and composable integration
- WebSocket endpoint at /api/ws is live and broadcasts data-changed signals after ingestion
- Vite proxy configured for WebSocket upgrade in dev mode

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 05-real-time-updates*
*Completed: 2026-03-04*
