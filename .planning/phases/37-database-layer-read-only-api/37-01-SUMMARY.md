---
phase: 37-database-layer-read-only-api
plan: 01
subsystem: api
tags: [axum, rusqlite, tokio-rusqlite, serde, chrono, pricing, conversations]

requires:
  - phase: 36-tauri-scaffold-infrastructure
    provides: "Axum server on :3001 with Arc<Connection> state and health endpoint"
provides:
  - "AppError enum with IntoResponse (404, 400, 500, serialize)"
  - "DateRangeParams and PaginationParams shared extractors"
  - "pricing.rs with 23-model LazyLock pricing map and calculate_cost"
  - "Conversation list endpoint with search, sort, cost sort, children, pagination"
  - "Conversation detail endpoint with messages, tool_calls, token_summary, compactions"
  - "AppState type alias exported from server.rs"
  - "Router::merge pattern for domain sub-routers"
affects: [37-02, 37-03, analytics, plans]

tech-stack:
  added: [chrono]
  patterns: [domain-module-with-sub-router, db-call-closure, per-model-cost-aggregation, cost-sort-in-rust]

key-files:
  created:
    - src-tauri/src/error.rs
    - src-tauri/src/extractors.rs
    - src-tauri/src/pricing.rs
    - src-tauri/src/conversations.rs
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/server.rs
    - src-tauri/src/lib.rs

key-decisions:
  - "LazyLock for MODEL_PRICING HashMap (stable Rust 1.80+, zero rebuild per call)"
  - "serde_json::Value for tool_call input/output/subagentSummary (flexible JSON parsing)"
  - "Return Json<serde_json::Value> for conversation_list to support both search and non-search response shapes"
  - "AppError extended with SerializeError variant for serde_json::Error conversion"

patterns-established:
  - "Domain module exports routes() -> Router<AppState> sub-router"
  - "server.rs composes via .merge(module::routes())"
  - "Dynamic SQL WHERE construction with Vec<Box<dyn ToSql>> for variable filter sets"
  - "Two db.call() pattern: main query + children query to keep closure sizes manageable"

requirements-completed: [API-01]

duration: 5min
completed: 2026-03-11
---

# Phase 37 Plan 01: Conversation Endpoints Summary

**Rust conversation list/detail API with 23-model pricing, search snippets, cost sort, and child nesting on axum :3001**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-11T07:14:17Z
- **Completed:** 2026-03-11T07:19:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Foundation modules (error.rs, extractors.rs, pricing.rs) establishing patterns for all future domain modules
- Conversation list endpoint with full query parity: search with mark-tag snippets, cost sort in Rust, NULLS LAST for nullable columns, child nesting, per-model cost aggregation
- Conversation detail endpoint with messages, tool calls (JSON-parsed input/output/subagentSummary), token summary with hasCost flag, compaction events, parent title lookup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared foundation modules** - `75b38d8` (feat)
2. **Task 2: Port conversation list and detail endpoints** - `9aedcb7` (feat)

## Files Created/Modified
- `src-tauri/src/error.rs` - AppError enum (NotFound, DbError, BadRequest, SerializeError) with IntoResponse
- `src-tauri/src/extractors.rs` - DateRangeParams and PaginationParams with resolve() defaults
- `src-tauri/src/pricing.rs` - 23-entry MODEL_PRICING LazyLock HashMap + calculate_cost with fuzzy matching
- `src-tauri/src/conversations.rs` - Conversation list (search, sort, cost sort, children, pagination) + detail (messages, tools, tokens, compactions)
- `src-tauri/src/server.rs` - AppState type alias, Router::merge for conversation routes
- `src-tauri/src/lib.rs` - Module declarations for conversations, error, extractors, pricing
- `src-tauri/Cargo.toml` - Added chrono dependency

## Decisions Made
- Used LazyLock (stable since Rust 1.80) for the pricing HashMap instead of rebuilding per call
- Extended AppError with SerializeError variant for serde_json::Error -- needed for serde_json::to_value in conversation_list
- Used Json<serde_json::Value> return type for conversation_list to support polymorphic response (ConversationListResponse vs SearchConversationListResponse)
- tool_call input/output stored as TEXT in SQLite, parsed to serde_json::Value for flexible JSON passthrough

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added SerializeError variant to AppError**
- **Found during:** Task 2 (conversation list endpoint)
- **Issue:** serde_json::to_value() returns serde_json::Error which had no From impl for AppError
- **Fix:** Added SerializeError(serde_json::Error) variant and From<serde_json::Error> impl
- **Files modified:** src-tauri/src/error.rs
- **Verification:** cargo check passes
- **Committed in:** 9aedcb7 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed rusqlite prepared statement temporary lifetime**
- **Found during:** Task 2 (per-model token queries)
- **Issue:** pm_stmt.query_map().collect() had temporary lifetime issue -- expression result dropped before closure completed
- **Fix:** Saved query_map result into local variable before returning from if block
- **Files modified:** src-tauri/src/conversations.rs
- **Verification:** cargo check passes
- **Committed in:** 9aedcb7 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Foundation modules (error, extractors, pricing) ready for analytics.rs and plans.rs to follow same patterns
- AppState type alias and Router::merge pattern established for remaining domain modules
- Plan 02 (analytics endpoints) and Plan 03 (plan endpoints) can proceed

---
*Phase: 37-database-layer-read-only-api*
*Completed: 2026-03-11*
