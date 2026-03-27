---
phase: 43-watcher-pricing-cleanup
plan: 01
subsystem: watcher, pricing
tags: [file-watcher, pricing, cursor-removal, rust]

# Dependency graph
requires:
  - phase: 42-ingestion-pipeline-removal
    provides: Ingestion pipeline with Cursor modules already removed
provides:
  - Claude-only file watcher with simplified classify_event
  - Anthropic-only model pricing table
affects: [44-settings-cleanup, 45-frontend-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns: [single-agent-watcher, simplified-debounce]

key-files:
  created: []
  modified:
    - src-tauri/src/watcher.rs
    - src-tauri/src/server.rs
    - src-tauri/src/settings.rs
    - src-tauri/src/pricing.rs

key-decisions:
  - "Removed AgentKind enum entirely since only one variant remains; classify_event returns bool instead"
  - "Removed debounce_key() and debounce_duration() methods; hardcoded 1s duration inline"
  - "Also updated settings.rs start_watcher call (not in plan but required for compilation)"

patterns-established:
  - "Single-agent watcher: no agent kind abstraction needed with one agent"

requirements-completed: [WATCH-01, WATCH-02, PRICE-01]

# Metrics
duration: 2min
completed: 2026-03-27
---

# Phase 43 Plan 01: Watcher and Pricing Cleanup Summary

**Removed Cursor from file watcher (AgentKind enum, vscdb detection, debounce) and pruned Cursor/OpenAI entries from MODEL_PRICING**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-27T21:17:27Z
- **Completed:** 2026-03-27T21:19:51Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Simplified watcher to single-agent design: removed AgentKind enum, classify_event returns bool for JSONL files only
- Removed all Cursor path watching, vscdb detection, and Cursor debounce timer from watcher loop
- Removed 10 Cursor/OpenAI pricing entries (2 Cursor aliases + 8 OpenAI models) from MODEL_PRICING
- All 82 tests pass, zero compilation errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Cursor from AgentKind, watcher, and server** - `9f3d774` (feat)
2. **Task 2: Remove Cursor and OpenAI model pricing entries** - `94565de` (feat)

## Files Created/Modified
- `src-tauri/src/watcher.rs` - Simplified to Claude-only file watcher with bool classify_event
- `src-tauri/src/server.rs` - Removed cursor_path/cursor_enabled from settings query and start_watcher calls
- `src-tauri/src/settings.rs` - Updated start_watcher call to omit Cursor parameters
- `src-tauri/src/pricing.rs` - Removed Cursor aliases and OpenAI model pricing entries

## Decisions Made
- Removed AgentKind enum entirely rather than keeping single-variant enum -- simpler API with classify_event returning bool
- Removed debounce_key() and debounce_duration() methods entirely -- hardcoded 1s duration inline since only one agent kind
- Updated settings.rs in addition to planned files (start_watcher caller not listed in plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated settings.rs start_watcher call**
- **Found during:** Task 1 (watcher/server cleanup)
- **Issue:** settings.rs also calls start_watcher with Cursor parameters, would not compile
- **Fix:** Updated the call to match new 3-parameter signature
- **Files modified:** src-tauri/src/settings.rs
- **Verification:** cargo build succeeds
- **Committed in:** 9f3d774 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Watcher and pricing are now Cursor-free
- Ready for Phase 44 (settings cleanup) to remove cursor_path, cursor_enabled from settings table and UI

---
*Phase: 43-watcher-pricing-cleanup*
*Completed: 2026-03-27*
