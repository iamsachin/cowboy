---
phase: quick-53
plan: 01
subsystem: architecture
tags: [watcher, ingestion, websocket, real-time, pipeline, debounce, sqlite]

# Dependency graph
requires: []
provides:
  - "End-to-end data flow documentation from filesystem to UI"
  - "6 concrete improvement opportunities with code locations"
affects: [ingestion, websocket, frontend-composables]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "Analysis only - no code changes, documenting pipeline for future optimization"

patterns-established: []

requirements-completed: [QUICK-53]

# Metrics
duration: 3min
completed: 2026-04-03
---

# Quick Task 53: Understand the Data Flow Summary

**Full real-time pipeline traced from notify::RecommendedWatcher through ingestion/snapshot/WebSocket to Vue composable consumers, with 6 improvement opportunities identified**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T12:36:48Z
- **Completed:** 2026-04-03T12:39:48Z
- **Tasks:** 1
- **Files modified:** 0 (analysis only)

## Accomplishments
- Traced the complete 5-stage real-time data pipeline end-to-end
- Identified 6 concrete improvement opportunities with exact code locations
- Documented latency budget: minimum ~1.5s + ingestion time + network from file change to UI update

## Complete Data Flow Analysis

### Stage 1: File System Detection (`src-tauri/src/watcher.rs`)

- `notify::RecommendedWatcher` watches `~/.claude/projects/` recursively (line 66)
- `classify_event()` (line 11) filters for `.jsonl` file extensions only
- Events sent via `mpsc::channel` (capacity 100) to a tokio debounce loop (line 45)
- 1-second debounce timer: each qualifying event resets the timer (lines 96-99)
- On debounce fire: `trigger_ingestion()` calls `ingestion::run_ingestion()` (line 119)
- Drop semantics: `FileWatcherHandle` sends shutdown via oneshot channel (lines 21-28)

### Stage 2: Ingestion Pipeline (`src-tauri/src/ingestion/mod.rs`)

`run_ingestion()` (line 107) orchestrates the full pipeline:

1. Ensures `ingested_files` cache table exists (lines 135-148)
2. Runs data quality migration (non-fatal, lines 151-170)
3. `discover_jsonl_files()` finds all JSONL files (line 175)
4. For each file, `process_claude_code_file()` (line 249):
   - Checks mtime/size cache in `ingested_files` table - skips if unchanged (lines 265-284)
   - `parse_jsonl_file()` parses the entire JSONL file (line 287)
   - `normalize_conversation()` produces `NormalizedData` (lines 290-298)
   - DB transaction: `insert_conversation_data()` + `insert_extracted_plans_sql()` (lines 314-316)
   - `snapshot_conversation()` takes pre-insert DB snapshot (counts of messages, tool_calls, tokens, plans, plus status/title/model) (line 311)
   - `track_changes()` compares post-insert counts vs snapshot, produces WebSocket event payloads (line 318)
   - Updates `ingested_files` cache (lines 324-337)
5. Post-processing: `link_subagents_post_processing()` (line 198)
6. Marks stale active conversations as completed (5-min threshold, lines 203-216)
7. **Events are batched**: ALL events collected into `all_events` Vec, then broadcast AFTER all files processed (lines 218-223)

### Stage 3: WebSocket Broadcast (`src-tauri/src/websocket.rs`)

- `broadcast_event()` (line 22) adds `seq` (monotonic via `AtomicU64`) and `timestamp` to each event
- Sends via `tokio::broadcast` channel to all connected clients (line 37)
- Event types emitted: `conversation:created`, `conversation:changed` (with changes array)
- WebSocket handler sends `{"type":"connected"}` handshake on connect (line 53)
- Client messages are drained but not processed (line 70)

### Stage 4: Frontend WebSocket (`packages/frontend/src/composables/useWebSocket.ts`)

- Singleton WebSocket connection to `/api/ws` (module-level state, lines 13-19)
- Gap detection: if `seq` jumps past `lastSeq + 1`, fires synthetic `system:full-refresh` (lines 70-71)
- Routes events to type-specific listener callbacks via `Map<string, Set<callback>>` (line 78)
- Reconnect strategy (lines 23-31):
  - First 2 attempts: 500ms fast retry (server likely already up on hard refresh)
  - Then: exponential backoff 1s-5s with 30% jitter
- Visibility change (lines 108-124): reconnects and fires `system:full-refresh` when tab becomes visible

### Stage 5: Frontend Data Consumers

**`useConversations.ts`** (conversation list page):
- 500ms debounce on WS events (lines 119-126), then full re-fetch of paginated list via `/api/analytics/conversations`
- Listens to: `conversation:created`, `conversation:changed`, `system:full-refresh` (lines 129-131)
- Tracks new row IDs for UI highlight animation (2s auto-clear, lines 33-56)

**`useConversationDetail.ts`** (single conversation view):
- 500ms debounce (line 31), re-fetches full conversation detail
- Scoped: only refetches when `evt.conversationId === conversationId` (line 129)
- In-flight queue: if fetch already running, queues ONE pending refetch (lines 45-47, 100-104)
- Tracks new group keys for UI highlights (lines 76-87)
- `system:full-refresh` bypasses debounce entirely (lines 135-145)

**`useAnalytics.ts`** (overview/dashboard page):
- 500ms debounce (lines 69-76), re-fetches ALL 3 endpoints in parallel:
  - `/api/analytics/overview`
  - `/api/analytics/timeseries`
  - `/api/analytics/model-distribution`
- Listens to: `conversation:changed`, `conversation:created`, `system:full-refresh` (lines 79-81)

### Event Type Definitions (`packages/frontend/src/types/websocket-events.ts`)

- `ConversationChangedEvent`: includes `conversationId` and `changes: ChangeType[]`
- `ChangeType` values: `messages-added`, `tool-calls-added`, `tokens-updated`, `plan-updated`, `status-changed`, `metadata-changed`
- `ConversationCreatedEvent`: includes `conversationId` and `summary` (title, agent, project, createdAt)
- `SystemFullRefreshEvent`: synthetic, no payload

## Improvement Opportunities

### 1. Batched Event Emission Delays Real-Time Updates

**Location:** `src-tauri/src/ingestion/mod.rs` lines 172, 218-223
**Problem:** Events are collected into `all_events: Vec<Value>` during the full ingestion run and only broadcast AFTER all files are processed. For large ingestion runs with many changed files, this adds significant latency -- the first conversation's changes are held until the last file finishes processing.
**Solution:** Emit events per-file immediately after each file's transaction commits. Move the broadcast call inside the `for file in &files` loop, right after `process_claude_code_file()` returns events. This would make event delivery incremental rather than batched.
**Impact:** High for initial ingestion (many files); low for steady-state (usually 1 file changed).

### 2. Full Re-Fetch on Every Change (No Delta/Incremental Fetch)

**Location:** `useConversations.ts` line 78, `useConversationDetail.ts` line 67, `useAnalytics.ts` lines 50-51
**Problem:** Every WS event triggers a complete API re-fetch. The `conversation:changed` event includes a `changes` array (e.g., `["messages-added", "tokens-updated"]`) but consumers ignore it -- they just re-fetch everything. For `useConversationDetail`, this means re-fetching the entire conversation (all messages, tool calls, tokens) when only 1 new message was appended.
**Solution options:**
  - Delta/incremental fetch: API could accept a `since` timestamp or `after_message_id`, return only new data
  - Include the new data directly in the WebSocket event payload (for small changes like single message appends)
  - For conversation list: include updated summary fields in the WS event so the list can be patched without re-fetch
**Impact:** Medium-high. Each active conversation generates multiple re-fetches per minute during active coding sessions.

### 3. Triple Parallel API Calls on Analytics for Every Change

**Location:** `useAnalytics.ts` lines 42-57, 79-81
**Problem:** `useAnalytics` fires all 3 endpoints (overview + timeseries + model-distribution) on every `conversation:changed` event. Most conversation changes (new message, tool call) do not affect timeseries aggregation or model distribution. Only token updates affect overview stats, and only new conversations affect distribution/timeseries.
**Solution:** Use the `changes` array from `conversation:changed` to conditionally fetch:
  - `tokens-updated` -> fetch overview only
  - `messages-added` / `tool-calls-added` -> fetch overview only
  - `status-changed` -> fetch overview only
  - `conversation:created` -> fetch all three
  - Skip timeseries/model-distribution unless conversation was created or date range changed
**Impact:** Medium. Reduces API load by ~67% for most WS events on the analytics page.

### 4. Debounce Stacking Creates ~1.5s Minimum Latency

**Location:** `watcher.rs` line 97 (1s), `useConversations.ts` line 125 (500ms), `useConversationDetail.ts` line 31 (500ms), `useAnalytics.ts` line 75 (500ms)
**Problem:** Watcher has 1s debounce, then each frontend consumer adds 500ms debounce. Total minimum latency from file change to UI update: ~1.5s + ingestion time + network round-trip. The 1s watcher debounce is sensible for coalescing rapid filesystem writes (Claude Code writes multiple lines quickly), but the additional 500ms per consumer could be reduced.
**Solution:** For the currently-viewed conversation detail, reduce frontend debounce to 100-200ms or eliminate it entirely (the in-flight queue already coalesces). Keep 500ms for list/analytics views where rapid updates are less important. The watcher debounce alone provides sufficient coalescing.
**Impact:** Low-medium. Improves perceived responsiveness for the conversation being actively watched.

### 5. File-Level Cache Granularity Forces Full Re-Parse

**Location:** `src-tauri/src/ingestion/mod.rs` lines 254-284
**Problem:** `ingested_files` tracks by mtime+size. If a file is modified (new message appended), the ENTIRE file is re-parsed and ALL data re-inserted (with INSERT OR IGNORE). For long conversations with hundreds of messages and thousands of tool calls, this is wasteful -- the parser re-reads and re-inserts all existing data just to pick up 1 new message at the end.
**Solution:** Track byte offset of last processed position. On change, seek to saved offset, parse only new lines, insert only new records. JSONL is append-only for Claude Code conversations, making this safe. The `ingested_files` table would gain a `last_offset INTEGER` column.
**Impact:** Medium-high for long-running conversations. Could reduce ingestion time from O(n) to O(1) for incremental updates, where n = total messages in conversation.

### 6. Stale Conversation Marking Only Runs During Ingestion

**Location:** `src-tauri/src/ingestion/mod.rs` lines 203-216
**Problem:** The 5-minute timeout for marking active conversations as "completed" runs inside `run_ingestion()`. This means if no file changes happen (user stops coding), stale conversations stay "active" indefinitely until the next filesystem change triggers ingestion. The UI continues showing a blinking green "active" indicator.
**Solution:** Move stale conversation marking to a separate periodic timer (e.g., run every 60 seconds via `tokio::time::interval`). This decouples status cleanup from the ingestion trigger, ensuring conversations are marked completed promptly regardless of filesystem activity.
**Impact:** Low. Correctness issue -- active indicators remain stale, but no data loss or incorrect data.

## Latency Budget Summary

| Stage | Component | Latency | Location |
|-------|-----------|---------|----------|
| 1 | FS event to debounce fire | 1000ms (debounce) | watcher.rs:97 |
| 2 | Ingestion (per file) | ~5-50ms (varies) | ingestion/mod.rs:186 |
| 2 | Event batching wait | 0ms (single file) to seconds (many files) | ingestion/mod.rs:218 |
| 3 | WS broadcast | <1ms | websocket.rs:37 |
| 4 | WS delivery | <5ms (local) | useWebSocket.ts:64 |
| 5 | Consumer debounce | 500ms | useConversations.ts:125 |
| 5 | API re-fetch | 10-100ms | varies |
| **Total** | **Best case** | **~1.5s** | |
| **Total** | **Worst case (many files)** | **3-5s+** | |

## Task Commits

1. **Task 1: Trace the full data flow and document findings** - Analysis only, documented in this summary

## Files Created/Modified
- None (analysis-only task)

## Decisions Made
- None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Analysis complete; any of the 6 improvements can be pursued as independent quick tasks
- Improvement #1 (per-file event emission) and #5 (incremental parsing) offer the highest impact for real-time responsiveness
- Improvement #3 (selective analytics fetch) is the simplest to implement

---
*Phase: quick-53*
*Completed: 2026-04-03*
