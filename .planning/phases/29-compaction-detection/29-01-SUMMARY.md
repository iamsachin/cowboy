---
phase: 29-compaction-detection
plan: 01
subsystem: ingestion
tags: [compaction, jsonl, drizzle, sqlite, parser, token-delta]

requires:
  - phase: 25-data-quality-code-cleanup
    provides: ingestion pipeline with parser and normalizer patterns
provides:
  - compaction_events DB table with drizzle migration
  - Parser detection of isCompactSummary in JSONL
  - CompactionEventData type in ParseResult
  - stripCompactionPreamble and computeTokenDelta utilities
  - Normalizer mapping with preamble stripping and token delta
  - Conversation detail API compactionEvents array
  - Conversation list hasCompaction boolean flag
  - CompactionEvent shared type
affects: [29-02-PLAN, frontend-compaction-ui, useGroupedTurns]

tech-stack:
  added: []
  patterns: [compaction-event-detection, preamble-stripping, token-delta-computation]

key-files:
  created:
    - packages/backend/src/ingestion/compaction-utils.ts
    - packages/backend/tests/ingestion/compaction.test.ts
    - packages/backend/drizzle/0005_chunky_wolfsbane.sql
  modified:
    - packages/backend/src/db/schema.ts
    - packages/backend/src/ingestion/claude-code-parser.ts
    - packages/backend/src/ingestion/normalizer.ts
    - packages/backend/src/ingestion/index.ts
    - packages/backend/src/ingestion/cursor-normalizer.ts
    - packages/backend/src/db/queries/analytics.ts
    - packages/shared/src/types/api.ts
    - packages/shared/src/types/index.ts

key-decisions:
  - "New compaction_events table instead of flags on messages table (keeps schema clean)"
  - "Compaction user messages still processed as regular user messages (summary in expandable section)"
  - "Token delta = input_tokens + cache_read + cache_creation from surrounding assistant messages"

patterns-established:
  - "Compaction detection: check isCompactSummary on user JSONL lines before processUserLine"
  - "Preamble stripping: conservative regex with fallback to full text"

requirements-completed: [COMP-01]

duration: 6min
completed: 2026-03-09
---

# Phase 29 Plan 01: Compaction Detection Summary

**Backend compaction detection pipeline: DB schema, JSONL parser extraction, preamble stripping, token delta computation, and API serving of compaction events**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-09T10:54:06Z
- **Completed:** 2026-03-09T11:00:27Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- compaction_events table defined with drizzle migration (0005)
- Parser detects isCompactSummary: true on user JSONL lines and populates compactionEvents array
- Preamble stripping utility removes "This session is being continued..." boilerplate
- Token delta computation finds before/after input token counts from surrounding assistant messages
- Normalizer maps compaction events to DB-ready records with stripped preamble and computed deltas
- Ingestion inserts compaction events in same transaction as other data
- Conversation detail API returns compactionEvents array
- Conversation list includes hasCompaction boolean flag
- 10 dedicated compaction tests all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: DB schema, parser detection, and compaction utilities** - `9606608` (test) + `331f839` (feat)
2. **Task 2: Normalizer, ingestion, and API integration** - `bcd3f14` (feat)

## Files Created/Modified
- `packages/backend/src/db/schema.ts` - Added compactionEvents table definition
- `packages/backend/src/ingestion/claude-code-parser.ts` - CompactionEventData type, isCompactSummary detection
- `packages/backend/src/ingestion/compaction-utils.ts` - stripCompactionPreamble and computeTokenDelta
- `packages/backend/src/ingestion/normalizer.ts` - Compaction event normalization with preamble/delta
- `packages/backend/src/ingestion/index.ts` - Compaction events DB insert in transaction
- `packages/backend/src/ingestion/cursor-normalizer.ts` - Empty compactionEvents for Cursor compatibility
- `packages/backend/src/db/queries/analytics.ts` - Compaction query in detail, hasCompaction in list
- `packages/shared/src/types/api.ts` - CompactionEvent type, updated ConversationDetailResponse and ConversationRow
- `packages/shared/src/types/index.ts` - Export CompactionEvent type
- `packages/backend/drizzle/0005_chunky_wolfsbane.sql` - CREATE TABLE compaction_events migration
- `packages/backend/tests/ingestion/compaction.test.ts` - 10 tests for parser, preamble, and token delta

## Decisions Made
- New compaction_events table instead of flags on messages table (keeps schema clean, avoids widening frequently-queried messages table)
- Compaction user messages still processed as regular user messages -- compaction_events is supplementary metadata
- Token delta computed as input_tokens + cache_read_input_tokens + cache_creation_input_tokens from last assistant before and first assistant after compaction timestamp

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added compactionEvents to cursor-normalizer.ts**
- **Found during:** Task 2 (Normalizer integration)
- **Issue:** cursor-normalizer.ts returns NormalizedData but was missing the new compactionEvents field, causing TS error
- **Fix:** Added `compactionEvents: []` to cursor-normalizer return value
- **Files modified:** packages/backend/src/ingestion/cursor-normalizer.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** bcd3f14 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for type compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend compaction data pipeline complete, ready for Phase 29 Plan 02 (frontend CompactionDivider component)
- compactionEvents available in conversation detail API response
- hasCompaction flag available in conversation list for indicators

---
*Phase: 29-compaction-detection*
*Completed: 2026-03-09*
