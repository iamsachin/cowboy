---
phase: 21-plan-extraction-quality
plan: 02
subsystem: database
tags: [drizzle, sqlite, ingestion, sorting]

requires:
  - phase: 21-plan-extraction-quality
    provides: "Plan extraction and schema context"
provides:
  - "Delete-then-insert re-ingestion for plans (replaces onConflictDoNothing)"
  - "Full sort column mapping covering all 6 plan table columns"
affects: [plan-extraction-quality]

tech-stack:
  added: []
  patterns: ["delete-before-insert for idempotent re-ingestion"]

key-files:
  created: []
  modified:
    - packages/backend/src/ingestion/index.ts
    - packages/backend/src/db/queries/plans.ts

key-decisions:
  - "Delete planSteps first (FK dependency), then delete plans, then insert fresh"
  - "Keep totalSteps mapping for backwards compat alongside new steps mapping"

patterns-established:
  - "Delete-then-insert pattern for re-ingestion instead of onConflictDoNothing"

requirements-completed: [PLAN-06, PLAN-07]

duration: 1min
completed: 2026-03-08
---

# Phase 21 Plan 02: Re-ingestion Delete+Insert and Sort Column Mapping Summary

**Delete-before-insert plan re-ingestion replacing onConflictDoNothing, plus full sort column mapping for steps/agent/project columns**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-08T14:44:50Z
- **Completed:** 2026-03-08T14:45:51Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Plan re-ingestion now deletes existing plans/planSteps before inserting, so improved extraction logic applies on re-ingest
- Sort column mapping expanded to cover all 6 frontend table columns: title, steps, status, agent, project, date
- All 62 existing plan tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete-then-insert re-ingestion and expanded sort mapping** - `ebd6436` (feat)

## Files Created/Modified
- `packages/backend/src/ingestion/index.ts` - Added delete-before-insert logic in insertExtractedPlans, imported eq from drizzle-orm, removed onConflictDoNothing from plan/planStep inserts
- `packages/backend/src/db/queries/plans.ts` - Added sort mappings for 'steps', 'agent', and 'project' columns

## Decisions Made
- Delete planSteps before plans to respect foreign key dependency order
- Keep 'totalSteps' sort mapping alongside new 'steps' mapping for backwards compatibility
- 'date' sort falls through to default createdAt (no explicit mapping needed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Re-ingestion and sort fixes complete
- Ready for any subsequent plan extraction quality improvements

---
*Phase: 21-plan-extraction-quality*
*Completed: 2026-03-08*
