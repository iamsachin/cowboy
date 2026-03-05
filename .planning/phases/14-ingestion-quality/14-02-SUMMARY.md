---
phase: 14-ingestion-quality
plan: 02
subsystem: ingestion
tags: [migration, data-quality, title-fix, model-attribution, idempotent]

# Dependency graph
requires:
  - phase: 14-01
    provides: "Shared shouldSkipForTitle from title-utils.ts"
provides:
  - "One-time startup migration fixing bad titles and NULL/default models in existing data"
  - "Idempotent runDataQualityMigration hooked into ingestion cycle"
affects: [ingestion, conversations-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Startup migration pattern: idempotent fix runs at top of ingestion cycle"
    - "Three-pass title fallback: user message -> XML-stripped -> assistant text"
    - "Model frequency counting from token_usage and messages tables"

key-files:
  created:
    - packages/backend/src/ingestion/migration.ts
    - packages/backend/tests/ingestion/migration.test.ts
  modified:
    - packages/backend/src/ingestion/index.ts

key-decisions:
  - "Migration runs on every ingestion cycle rather than a one-time flag, relying on idempotency"
  - "Migration is non-fatal: errors are logged but do not block ingestion"
  - "Cursor per-message 'default' model also updated to 'unknown' alongside conversation model"

patterns-established:
  - "Idempotent startup migration: check needsFix before updating, safe to re-run"

requirements-completed: [TITLE-01, TITLE-02, TITLE-03, MODEL-01, MODEL-02]

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 14 Plan 02: Data Quality Migration Summary

**Startup migration that retroactively fixes bad titles and NULL/default models in existing conversations using three-pass fallback chain**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T12:07:44Z
- **Completed:** 2026-03-05T12:11:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created migration module with needsTitleFix, fixConversationTitles, fixConversationModels, and runDataQualityMigration
- Migration identifies and fixes conversations with bad titles (system caveats, interruption notices, slash commands, XML, NULL)
- Claude Code NULL-model conversations get model derived from most common token_usage model
- Cursor "default" model resolved to actual model from messages or "unknown" (both conversation and per-message level)
- Migration is idempotent: running twice produces same result with zero updates on second run
- Hooked into ingestion startup as non-fatal pre-processing step
- 21 new migration tests pass; 357 total backend tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration module with title and model fix logic** - `ce6e0b6` (test) + `1d1a20a` (feat)
2. **Task 2: Hook migration into ingestion startup** - `964c96c` (feat)

_Note: TDD task 1 has separate test and implementation commits_

## Files Created/Modified
- `packages/backend/src/ingestion/migration.ts` - Migration module with needsTitleFix, fixConversationTitles, fixConversationModels, runDataQualityMigration
- `packages/backend/tests/ingestion/migration.test.ts` - 21 tests covering all fix scenarios and idempotency
- `packages/backend/src/ingestion/index.ts` - Added migration import and call at top of runIngestion()

## Decisions Made
- Migration runs every ingestion cycle (not gated by a flag) since needsTitleFix check makes subsequent runs fast no-ops
- Migration errors are caught and logged as non-fatal to avoid blocking ingestion
- Cursor per-message "default" model updated to "unknown" alongside conversation-level fix for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All existing conversation data will be fixed on next server startup
- Title skip logic (plan 01) and retroactive migration (plan 02) complete the ingestion quality phase

---
*Phase: 14-ingestion-quality*
*Completed: 2026-03-05*
