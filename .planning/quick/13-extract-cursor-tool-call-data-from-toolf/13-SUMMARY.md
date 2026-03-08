---
phase: quick-13
plan: 01
subsystem: ingestion
tags: [cursor, tool-calls, normalizer, parser]
dependency_graph:
  requires: [quick-12]
  provides: [cursor-tool-call-extraction]
  affects: [tool_calls-table, cursor-conversations]
tech_stack:
  patterns: [TDD, safe-json-parse, status-mapping]
key_files:
  created: []
  modified:
    - packages/backend/src/ingestion/cursor-parser.ts
    - packages/backend/src/ingestion/cursor-normalizer.ts
    - packages/backend/tests/ingestion/cursor-normalizer.test.ts
decisions:
  - "toolFormerData type updated as backward-compatible union (preserves additionalData field)"
  - "safeJsonParseWithFallback returns raw string for non-JSON result data (e.g., terminal output)"
  - "Status mapping: completed->success, error->error, null->null, other->passthrough"
  - "Tool call messageId linked to merged assistant message (firstBubble of group)"
metrics:
  duration: 218s
  completed: "2026-03-09T00:29:00Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 9
  tests_total: 73
---

# Quick Task 13: Extract Cursor Tool Call Data from toolFormerData

Cursor tool call extraction from toolFormerData into normalized toolCalls array with JSON parsing, status mapping, and proper messageId linking -- 296 tool calls extracted across 10 conversations on re-ingestion.

## Task Completion

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update CursorBubble type and extract tool calls in normalizer (TDD) | d767ae3, 94314c1 | cursor-parser.ts, cursor-normalizer.ts, cursor-normalizer.test.ts |
| 2 | Wipe Cursor data and re-ingest, verify tool calls in DB | (operational) | data/cowboy.db (296 tool calls) |

## What Changed

### CursorBubble Type Update (cursor-parser.ts)
- Expanded `toolFormerData` type from `{ additionalData? }` to include `name`, `status`, `params`, `result`, `rawArgs`, `toolCallId` fields
- Backward-compatible: existing `additionalData` field preserved

### Tool Call Extraction (cursor-normalizer.ts)
- During assistant group merging loop, collect bubbles with `toolFormerData.name`
- After merged messageId is computed, push tool call records to `normalizedToolCalls`
- Added `safeJsonParse` for params/rawArgs input parsing (null on failure)
- Added `safeJsonParseWithFallback` for result output parsing (returns raw string on failure)
- Added `mapToolStatus` to normalize status values (completed->success, error->error)

### Test Coverage (cursor-normalizer.test.ts)
- 9 new tests in `tool call extraction` describe block
- Covers: basic extraction, JSON parsing, messageId linking, multiple tool calls per turn, null/missing fields, rawArgs fallback, status mapping, invalid JSON fallback, conversationId correctness

## Verification Results

- All 73 tests pass (9 new + 64 existing)
- Re-ingestion produced 296 tool calls across 10 Cursor conversations
- Tool names include: read_file, edit_file, list_dir, run_terminal_cmd
- Input/output JSON properly parsed, status correctly mapped to success/error

## Deviations from Plan

None - plan executed exactly as written.
