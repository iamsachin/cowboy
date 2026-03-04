---
phase: 08-plan-tracking
plan: 01
subsystem: ingestion
tags: [plan-extraction, heuristic-detection, completion-inference, drizzle, sqlite]

# Dependency graph
requires:
  - phase: 02-ingestion
    provides: "Ingestion pipeline, normalizer, id-generator, DB schema"
provides:
  - "Plan extractor module with 3 pattern types (numbered, checkbox, Step N)"
  - "Completion inference engine (checkbox > tool call > text > unknown)"
  - "plans and planSteps DB tables with migration"
  - "Shared PlanRow, PlanStepRow, PlanListResponse, PlanDetailResponse, PlanStatsResponse types"
  - "Plan extraction integrated into both Claude Code and Cursor ingestion pipelines"
affects: [08-plan-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Line-by-line text scanning for plan extraction (avoids multi-line regex pitfalls)"
    - "Action verb validation Set for numbered list filtering"
    - "Multi-signal completion inference with priority chain"
    - "insertExtractedPlans helper shared between Claude Code and Cursor transaction blocks"

key-files:
  created:
    - "packages/backend/src/ingestion/plan-extractor.ts"
    - "packages/backend/drizzle/0001_mighty_black_crow.sql"
    - "packages/backend/tests/plans/plan-extractor.test.ts"
    - "packages/backend/tests/plans/completion-inference.test.ts"
    - "packages/backend/tests/plans/plan-ingestion.test.ts"
    - "packages/backend/tests/fixtures/seed-plans.ts"
  modified:
    - "packages/shared/src/types/api.ts"
    - "packages/backend/src/db/schema.ts"
    - "packages/backend/src/ingestion/index.ts"
    - "packages/backend/tests/migration.test.ts"

key-decisions:
  - "Word-based text pattern matching for completion inference instead of substring slice (handles verb form differences)"
  - "STOPWORDS set in completion inference to filter common words and reduce false positive matches"
  - "Empty lines within step lists are tolerated (don't break list grouping)"

patterns-established:
  - "Plan extractor as pure function module: stateless text processing with typed inputs/outputs"
  - "insertExtractedPlans helper: shared plan insertion logic called from both ingestion paths"
  - "seed-plans.ts fixture: test data pattern for plan-related integration tests"

requirements-completed: [PLAN-01]

# Metrics
duration: 9min
completed: 2026-03-04
---

# Phase 8 Plan 1: Plan Extraction Engine Summary

**Heuristic plan extractor with 3 pattern types, completion inference priority chain, DB schema, and ingestion pipeline integration**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-04T13:31:47Z
- **Completed:** 2026-03-04T13:41:14Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Built plan extractor with line-by-line scanning for numbered action lists, checkbox lists, and Step N patterns
- Implemented completion inference engine with checkbox > tool call correlation > text pattern > unknown priority chain
- Created plans and planSteps DB tables with drizzle migration
- Integrated plan extraction into both Claude Code and Cursor ingestion transaction blocks
- Added 29 tests (10 extraction unit, 11 inference unit, 8 integration) with 100% pass rate

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared types, DB schema, plan extractor, and completion inference** - `143fd13` (feat)
2. **Task 2: Integrate plan extraction into ingestion pipeline** - `a5d43f9` (feat)

## Files Created/Modified
- `packages/backend/src/ingestion/plan-extractor.ts` - Plan extraction engine with extractPlans() and inferStepCompletion()
- `packages/backend/src/db/schema.ts` - Added plans and planSteps table definitions
- `packages/backend/drizzle/0001_mighty_black_crow.sql` - Migration for new tables
- `packages/shared/src/types/api.ts` - Added PlanRow, PlanStepRow, PlanListResponse, PlanDetailResponse, PlanStatsResponse, PlanTimeSeriesPoint
- `packages/backend/src/ingestion/index.ts` - Added insertExtractedPlans helper and calls in both transaction blocks
- `packages/backend/tests/plans/plan-extractor.test.ts` - 10 unit tests for extraction patterns
- `packages/backend/tests/plans/completion-inference.test.ts` - 11 unit tests for inference priority chain
- `packages/backend/tests/plans/plan-ingestion.test.ts` - 8 integration tests for DB storage and dedup
- `packages/backend/tests/fixtures/seed-plans.ts` - Test fixture with 6 conversations and test content strings
- `packages/backend/tests/migration.test.ts` - Updated table count assertion from 4 to 6

## Decisions Made
- Used word-based matching for text pattern completion inference instead of raw 30-char substring slice. The substring approach failed when verb forms differed (e.g., "create" in step vs "creating" in later message). Word-based matching with STOPWORDS filtering is more robust.
- Empty lines within step lists are tolerated and don't break list grouping. This handles the common pattern of blank lines between numbered steps in formatted messages.
- Title inference strips trailing colons for cleaner display (e.g., "Here's the setup plan:" becomes "Here's the setup plan").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed text pattern matching for completion inference**
- **Found during:** Task 1 (completion inference implementation)
- **Issue:** The research code example used `stepLower.slice(0, 30)` for step reference matching, but this fails when verb forms differ between step content and later messages (e.g., "create" vs "creating").
- **Fix:** Replaced with word-based matching: extract significant words (3+ chars, skip stopwords), require at least 2 matching words in later message for a reference match.
- **Files modified:** packages/backend/src/ingestion/plan-extractor.ts
- **Verification:** completion-inference.test.ts text pattern tests pass
- **Committed in:** 143fd13 (Task 1 commit)

**2. [Rule 1 - Bug] Updated migration test for new table count**
- **Found during:** Task 1 (running full test suite)
- **Issue:** Existing migration test asserted 4 tables, but adding plans and planSteps creates 6 tables.
- **Fix:** Updated assertion from 4 tables to 6, updated expected table names array.
- **Files modified:** packages/backend/tests/migration.test.ts
- **Verification:** migration.test.ts passes
- **Committed in:** 143fd13 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None - implementation followed established patterns from existing codebase.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan extraction engine ready, plans stored in DB on every ingestion run
- Next plan (08-02) can build API routes and query layer on top of plans/planSteps tables
- Backfill happens naturally via re-ingestion (POST /api/ingest)

## Self-Check: PASSED

All 8 created/modified files verified present. Both task commits (143fd13, a5d43f9) verified in git log.

---
*Phase: 08-plan-tracking*
*Completed: 2026-03-04*
