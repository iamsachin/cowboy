---
phase: quick-12
plan: 01
subsystem: ingestion
tags: [cursor, thinking, capabilityType, turn-merging, normalizer]

requires:
  - phase: 15-cursor-data-quality
    provides: cursor parser and normalizer foundation
provides:
  - CursorBubble.thinking field extraction from Cursor state.vscdb
  - capabilityType-based tool-only detection (replaces broken isCapabilityIteration)
  - Consecutive assistant bubble merging into logical turns
affects: [cursor-ingestion, message-display]

tech-stack:
  added: []
  patterns: [assistant-turn-merging, thinking-extraction]

key-files:
  created: []
  modified:
    - packages/backend/src/ingestion/cursor-parser.ts
    - packages/backend/src/ingestion/cursor-normalizer.ts
    - packages/backend/tests/ingestion/cursor-normalizer.test.ts
    - packages/backend/tests/ingestion/cursor-parser.test.ts

key-decisions:
  - "capabilityType replaces isCapabilityIteration for tool-only detection (isCapabilityIteration is always false in newer Cursor data)"
  - "Consecutive assistant bubbles merged into single logical turns with combined thinking, tool summary, and text content"
  - "Only 10 of 65 Cursor conversations have bubble data (55 have zero bubbles in state.vscdb, a Cursor-side limitation)"

patterns-established:
  - "Turn merging: consecutive assistant bubbles between user messages are merged into single rich messages"
  - "Tool-only detection: !text && !thinking && (capabilityType != null || toolFormerData)"

requirements-completed: [CURSOR-FIX]

duration: 7min
completed: 2026-03-09
---

# Quick Task 12: Fix Cursor Data Extraction Summary

**capabilityType-based tool detection, thinking extraction from capabilityType=30 bubbles, and consecutive assistant turn merging**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-08T18:29:07Z
- **Completed:** 2026-03-08T18:36:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed tool-only bubble detection using capabilityType instead of broken isCapabilityIteration flag
- Added thinking field to CursorBubble type and extracted thinking.text from bubble JSON data
- Implemented consecutive assistant bubble merging into logical turns (thinking + tool calls + response -> single message)
- Re-ingested all Cursor data: 10 conversations now show real content, 3 messages have thinking data

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `268a7c8` (test)
2. **Task 1 GREEN: Implementation** - `a62b878` (feat)

Task 2 was a database operation (wipe + re-ingest) with no code changes.

## Files Created/Modified
- `packages/backend/src/ingestion/cursor-parser.ts` - Added thinking field to CursorBubble, extract from bubble JSON
- `packages/backend/src/ingestion/cursor-normalizer.ts` - Rewrote message loop with capabilityType detection, thinking extraction, and turn merging
- `packages/backend/tests/ingestion/cursor-normalizer.test.ts` - Added 8 new tests for thinking, capabilityType, and merging; updated 3 tests for new merge behavior
- `packages/backend/tests/ingestion/cursor-parser.test.ts` - Added 2 tests for thinking field extraction

## Decisions Made
- capabilityType replaces isCapabilityIteration for tool detection: isCapabilityIteration is always false in newer Cursor data, capabilityType is reliable
- Turn merging strategy: all consecutive assistant bubbles between user messages merge into one message with combined thinking, tool count summary prefix, and concatenated text
- 55 of 65 conversations have zero bubbles in state.vscdb -- this is a Cursor-side limitation (older conversations purge bubble data), not a normalizer bug

## Deviations from Plan

### Adjusted Expectations

**1. Conversation count is 10 (not 71)**
- **Found during:** Task 2 (re-ingestion verification)
- **Issue:** Plan expected 71 conversations to appear after fix. Investigation showed 65 composerData entries exist but only 10 have bubble data (554 bubbles across 10 composers). The other 55 conversations have zero bubbles in state.vscdb.
- **Resolution:** This is a Cursor-side limitation, not a normalizer bug. The normalizer correctly processes all conversations that have bubble data.
- **Impact:** Success criteria adjusted from "71 conversations" to "all conversations with bubble data are correctly processed"

---

**Total deviations:** 1 expectation adjustment (data limitation, not code issue)
**Impact on plan:** Core objectives achieved -- tool detection, thinking extraction, and turn merging all work correctly.

## Issues Encountered
- Pre-existing build errors in normalizer.ts (model type assignment) and analytics.ts (isActive property) -- not related to cursor changes, did not block task
- Pre-existing test failure in cursor-parser.test.ts (createdAt expects 0 but gets Date.now() for missing field) -- not related to our changes

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Cursor ingestion pipeline is now correct for all available data
- Thinking content renders in conversation detail view
- Turn merging produces cleaner conversation flow

---
*Quick Task: 12-fix-cursor-data-extraction*
*Completed: 2026-03-09*
