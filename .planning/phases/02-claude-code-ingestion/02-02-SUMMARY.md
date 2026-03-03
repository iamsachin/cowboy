---
phase: 02-claude-code-ingestion
plan: 02
subsystem: ingestion
tags: [jsonl, streaming-parser, normalizer, chunk-reconstruction, readline, tdd]

# Dependency graph
requires:
  - phase: 02-claude-code-ingestion
    plan: 01
    provides: ParsedLine types, ContentBlock types, generateId, deriveProjectName, JSONL test fixtures
  - phase: 01-project-foundation
    provides: Drizzle schema (conversations, messages, toolCalls, tokenUsage tables)
provides:
  - Streaming JSONL parser with assistant chunk reconstruction (parseJsonlFile)
  - Normalizer mapping parsed data to unified schema records (normalizeConversation)
  - ParseResult, UserMessageData, AssistantMessageData, ToolResultData types
  - NormalizedData type matching Drizzle table shapes
affects: [02-03-PLAN, ingestion-plugin, database-insertion, api-endpoints]

# Tech tracking
tech-stack:
  added: []
  patterns: [streaming-readline-parser, chunk-reconstruction-by-message-id, tool-result-matching-by-tool-use-id, content-block-concatenation]

key-files:
  created:
    - packages/backend/src/ingestion/claude-code-parser.ts
    - packages/backend/src/ingestion/normalizer.ts
    - packages/backend/tests/ingestion/parser.test.ts
    - packages/backend/tests/ingestion/normalizer.test.ts
  modified: []

key-decisions:
  - "Streaming text blocks from same message concatenated without separator; different block types use newline"
  - "Token usage captured exclusively from final chunk (non-null stop_reason) to avoid stale output_tokens"
  - "Empty JSONL lines counted as skipped -- consistent with malformed line handling"
  - "Tool result matching uses flat lookup map from all user messages' toolResults by tool_use_id"
  - "Assistant content extraction concatenates text blocks directly, separates thinking blocks with newlines"

patterns-established:
  - "Chunk reconstruction: group assistant lines by message.id, collect content blocks, take usage from final chunk"
  - "Content extraction: consecutive text blocks joined directly, different block types newline-separated"
  - "Tool flow: tool_use in assistant -> tool_result in next user message -> matched by tool_use_id"
  - "Normalizer null return: empty ParseResult produces null, caller must handle"

requirements-completed: [INGEST-01, INGEST-03, INGEST-06]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 2 Plan 2: JSONL Parser & Normalizer Summary

**Streaming JSONL parser with multi-chunk assistant reconstruction and schema normalizer mapping parsed data to conversations, messages, tool calls, and token usage records**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T23:01:09Z
- **Completed:** 2026-03-03T23:05:33Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Streaming JSONL parser reads files line-by-line using node:readline, never loading entire file into memory
- Multi-chunk assistant message reconstruction groups streaming chunks by message.id, collecting all content blocks
- Token usage extracted exclusively from the final chunk (non-null stop_reason) to avoid stale output_tokens values
- Normalizer produces deterministic records matching Drizzle schema shapes with generateId-based IDs
- Tool call records linked to tool results via tool_use_id matching across user/assistant messages
- 45 tests (20 parser + 25 normalizer) all passing with TDD RED-GREEN cycle

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing parser tests** - `a46c3b5` (test)
2. **Task 1 GREEN: JSONL parser implementation** - `33026a4` (feat)
3. **Task 2 RED: Failing normalizer tests** - `2b22f17` (test)
4. **Task 2 GREEN: Normalizer implementation** - `cc05a60` (feat)

_Both tasks followed TDD: RED (failing tests) then GREEN (implementation passing all tests)_

## Files Created/Modified
- `packages/backend/src/ingestion/claude-code-parser.ts` - Streaming JSONL parser with readline, assistant chunk reconstruction, tool use/result extraction (278 lines)
- `packages/backend/src/ingestion/normalizer.ts` - Maps ParseResult to NormalizedData matching Drizzle schema shapes with deterministic IDs (256 lines)
- `packages/backend/tests/ingestion/parser.test.ts` - 20 tests covering all 6 fixture files, streaming chunks, malformed lines, empty files, tool flows (175 lines)
- `packages/backend/tests/ingestion/normalizer.test.ts` - 25 tests covering conversation, message, tool call, token usage records, empty input, determinism (239 lines)

## Decisions Made
- Streaming text blocks from same message concatenated without separator (they are fragments of continuous text from streaming chunks); thinking blocks separated by newlines from text content
- Token usage captured only from the final chunk (where stop_reason is not null) -- intermediate chunks have stale output_tokens counters
- Empty lines in JSONL counted as skipped lines, consistent with malformed line handling
- Tool result matching uses a flat Map lookup from all user messages' toolResults, keyed by tool_use_id
- normalizeConversation returns null for empty ParseResult, pushing empty-file handling to the caller

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed text block concatenation in normalizer**
- **Found during:** Task 2 (normalizer implementation)
- **Issue:** extractAssistantContent joined all blocks with newlines, causing streaming text chunks "Hello" + " world" to become "Hello\n world" instead of "Hello world"
- **Fix:** Changed to concatenate consecutive text blocks directly without separator, only using newlines between different block types (text vs thinking)
- **Files modified:** packages/backend/src/ingestion/normalizer.ts
- **Verification:** All 25 normalizer tests pass including content concatenation test
- **Committed in:** cc05a60 (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Auto-fix necessary for correct text reconstruction from streaming chunks. No scope creep.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Parser and normalizer modules ready for Plan 03 (Fastify ingestion plugin with database insertion)
- parseJsonlFile and normalizeConversation exported and tested with all fixture types
- NormalizedData shape matches Drizzle schema, ready for direct database insertion
- No blockers for Phase 2 Plan 03

## Self-Check: PASSED

- All 4 created files verified on disk
- All 4 task commits verified in git log (a46c3b5, 33026a4, 2b22f17, cc05a60)

---
*Phase: 02-claude-code-ingestion*
*Completed: 2026-03-04*
