---
phase: 14-ingestion-quality
plan: 01
subsystem: ingestion
tags: [normalizer, title-derivation, model-attribution, cursor, claude-code]

# Dependency graph
requires: []
provides:
  - "Shared title skip logic (shouldSkipForTitle) for both normalizers"
  - "Assistant text fallback for conversation titles"
  - "Token usage model fallback for Claude Code normalizer"
  - "Cursor 'default' model resolution to actual model or 'unknown'"
affects: [ingestion, conversations-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared utility module for cross-normalizer logic (title-utils.ts)"
    - "Ordered skip-check pattern for content filtering"
    - "Multi-pass fallback chain for title derivation"

key-files:
  created:
    - packages/backend/src/ingestion/title-utils.ts
    - packages/backend/tests/ingestion/title-utils.test.ts
  modified:
    - packages/backend/src/ingestion/normalizer.ts
    - packages/backend/src/ingestion/cursor-normalizer.ts
    - packages/backend/tests/ingestion/normalizer.test.ts
    - packages/backend/tests/ingestion/cursor-normalizer.test.ts

key-decisions:
  - "Shared title-utils module rather than duplicating skip logic in each normalizer"
  - "XML fallback pass restricted to XML-starting messages only (not all messages)"
  - "Cursor 'default' model replaced with 'unknown' at both conversation and per-message level"

patterns-established:
  - "shouldSkipForTitle: ordered prefix-based skip checks for title derivation"
  - "Three-pass title fallback: user content -> XML-stripped -> assistant text"

requirements-completed: [TITLE-01, TITLE-02, TITLE-03, MODEL-01, MODEL-02]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 14 Plan 01: Title Skip Logic and Model Attribution Summary

**Shared title-utils with skip patterns for caveats/slash-commands/interruptions, assistant text fallback, and Cursor "default" model resolution**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T12:00:03Z
- **Completed:** 2026-03-05T12:05:19Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created shared title-utils module with shouldSkipForTitle and deriveConversationTitle functions
- Both normalizers now skip system caveats, interrupted requests, and slash commands when deriving titles
- Added assistant text fallback when all user messages are system/skippable content
- Claude Code normalizer falls back to token_usage records for model when no assistant messages exist
- Cursor normalizer resolves "default" model to actual model from bubbles or "unknown"
- 100 tests pass across all 3 test files with no regressions (336 total backend tests pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared title-utils with skip logic and assistant fallback** - `18b1848` (feat)
2. **Task 2: Update both normalizers to use shared title-utils and fix model attribution** - `d2801cf` (feat)

_Note: TDD tasks each include test + implementation in single commit_

## Files Created/Modified
- `packages/backend/src/ingestion/title-utils.ts` - Shared shouldSkipForTitle and deriveConversationTitle functions
- `packages/backend/tests/ingestion/title-utils.test.ts` - 18 tests for skip logic and fallback chain
- `packages/backend/src/ingestion/normalizer.ts` - Uses shouldSkipForTitle, assistant text fallback, token_usage model fallback
- `packages/backend/src/ingestion/cursor-normalizer.ts` - Uses shouldSkipForTitle, assistant text fallback, "default" model resolution
- `packages/backend/tests/ingestion/normalizer.test.ts` - 5 new tests for skip patterns and model fallback
- `packages/backend/tests/ingestion/cursor-normalizer.test.ts` - 9 new tests for skip patterns and "default" model handling

## Decisions Made
- Created a shared title-utils.ts module rather than duplicating skip logic in each normalizer
- XML fallback pass restricted to messages starting with "<" only (not applying XML strip to non-XML messages like "Caveat:")
- Cursor "default" model replaced with "unknown" at both conversation-level and per-message level, including token usage records
- Updated 3 existing tests that expected null titles to reflect new assistant text fallback behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed XML fallback pass applying to non-XML messages**
- **Found during:** Task 1 (title-utils implementation)
- **Issue:** XML fallback pass was iterating all messages and stripping tags from non-XML content like "Caveat: stuff", causing false positives
- **Fix:** Restricted XML fallback to only process messages starting with "<"
- **Files modified:** packages/backend/src/ingestion/title-utils.ts
- **Verification:** All 18 title-utils tests pass
- **Committed in:** 18b1848 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Title skip logic and model attribution fixes ready for use
- Re-ingestion of existing data may be needed to fix historical records (separate plan)

---
*Phase: 14-ingestion-quality*
*Completed: 2026-03-05*
