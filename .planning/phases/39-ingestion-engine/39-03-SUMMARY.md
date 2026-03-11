---
phase: 39-ingestion-engine
plan: 03
subsystem: ingestion
tags: [rust, cursor, vscdb, sqlite, bubble-merging, token-differencing, normalizer]

requires:
  - phase: 39-ingestion-engine-01
    provides: Shared types (NormalizedData, ConversationRecord, etc.), ID generator, title_utils
provides:
  - Cursor vscdb file discovery (platform-specific path resolution)
  - Cursor vscdb parser (readonly SQLite reader for composerData and bubbleId entries)
  - Cursor normalizer (bubble merging, tool extraction, token differencing)
affects: [39-04, ingestion-engine]

tech-stack:
  added: []
  patterns: [sync rusqlite for external DB reads, bubble merging into logical assistant turns, cumulative token differential]

key-files:
  created:
    - src-tauri/src/ingestion/cursor_file_discovery.rs
    - src-tauri/src/ingestion/cursor_parser.rs
    - src-tauri/src/ingestion/cursor_normalizer.rs
  modified:
    - src-tauri/src/ingestion/mod.rs

key-decisions:
  - "Used tokio_rusqlite::rusqlite re-export instead of standalone rusqlite dep (avoids version conflict with tokio-rusqlite 0.7)"
  - "Sync rusqlite for Cursor vscdb reads (separate readonly DB, no need for async overhead)"

patterns-established:
  - "Connection::open_with_flags(SQLITE_OPEN_READ_ONLY | SQLITE_OPEN_NO_MUTEX) for external DB reads"
  - "Bubble merging: collect consecutive type=2 bubbles into assistant groups, emit single MessageRecord"
  - "Token differential: when per-bubble tokenCount missing, use tokenCountUpUntilHere delta"

requirements-completed: [ING-03]

duration: 6min
completed: 2026-03-11
---

# Phase 39 Plan 03: Cursor vscdb Parser and Normalizer Summary

**Cursor vscdb ingestion pipeline with readonly SQLite parsing, consecutive bubble merging, tool extraction from toolFormerData, and cumulative token differencing**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-11T10:14:37Z
- **Completed:** 2026-03-11T10:21:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Ported Cursor file discovery with macOS/Linux platform-specific path resolution
- Ported Cursor vscdb parser opening state.vscdb readonly with SQLITE_OPEN_READ_ONLY | SQLITE_OPEN_NO_MUTEX
- Ported Cursor normalizer with consecutive assistant bubble merging into logical turns
- Tool call extraction from toolFormerData with status mapping (completed->success, error->error)
- Token usage computation with per-bubble counts and cumulative differential fallback
- 24 unit tests covering all cursor module behaviors

## Task Commits

Each task was committed atomically:

1. **Task 1: Cursor vscdb discovery and parser** - `131d157` (feat)
2. **Task 2: Cursor normalizer with bubble merging and token differencing** - `38220d6` (feat)

## Files Created/Modified
- `src-tauri/src/ingestion/cursor_file_discovery.rs` - Platform-specific Cursor vscdb path resolution
- `src-tauri/src/ingestion/cursor_parser.rs` - Readonly SQLite reader for composerData and bubbleId entries
- `src-tauri/src/ingestion/cursor_normalizer.rs` - Bubble merging, tool extraction, token differencing, timestamp normalization
- `src-tauri/src/ingestion/mod.rs` - Added module declarations for cursor_file_discovery, cursor_parser, cursor_normalizer

## Decisions Made
- Used tokio_rusqlite::rusqlite re-export instead of adding a standalone rusqlite dependency, avoiding version conflict (tokio-rusqlite 0.7 provides rusqlite 0.37)
- Used sync rusqlite for Cursor vscdb reads since it's a separate readonly database (wrap in spawn_blocking when called from async context)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all modules compiled and tests passed on first iteration.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Cursor ingestion pipeline complete from discovery through normalization
- Ready for orchestrator integration (Plan 04) which will call parse_cursor_db and normalize_cursor_conversation
- All Cursor-specific types correctly converted to unified NormalizedData schema

---
*Phase: 39-ingestion-engine*
*Completed: 2026-03-11*
