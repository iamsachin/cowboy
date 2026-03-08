---
phase: 21-plan-extraction-quality
plan: 01
subsystem: backend
tags: [plan-extraction, heuristics, regex, word-boundary, tdd]

# Dependency graph
requires: []
provides:
  - "cleanMarkdown() helper for stripping markdown artifacts from titles"
  - "conversationTitle fallback parameter in extractPlans()"
  - "Number sequence reset detection for list splitting"
  - "Action verb >50% threshold (replaces 100%)"
  - "Word boundary tool name matching in inferStepCompletion()"
  - "60% significant word overlap threshold for completion matching"
affects: [21-plan-extraction-quality]

# Tech tracking
tech-stack:
  added: []
  patterns: [word-boundary-regex, cleanMarkdown-helper, threshold-tuning]

key-files:
  created: []
  modified:
    - packages/backend/src/ingestion/plan-extractor.ts
    - packages/backend/tests/plans/plan-extractor.test.ts
    - packages/backend/tests/plans/completion-inference.test.ts
    - packages/backend/tests/fixtures/seed-plans.ts

key-decisions:
  - "cleanMarkdown strips #, **, __, backticks via regex chain"
  - "conversationTitle is optional 3rd param to extractPlans (backward-compatible)"
  - "Action verb threshold >50% (strict > not >=) matches plan spec"
  - "Word boundary regex with escaped tool name prevents substring matches"
  - "Completion threshold max(2, ceil(n*0.6)) ensures short steps still need 2 matches"

patterns-established:
  - "cleanMarkdown: reusable markdown artifact stripping for any title/label context"
  - "Word boundary tool matching: escape + \\b pattern for safe substring avoidance"

requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-10]

# Metrics
duration: 3min
completed: 2026-03-08
---

# Phase 21 Plan 01: Plan Extraction Heuristics Summary

**Fixed plan title markdown stripping, list splitting by prose/heading/number-reset, >50% action verb threshold, word boundary tool matching, and 60% completion word overlap**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T14:44:54Z
- **Completed:** 2026-03-08T14:47:49Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Plan titles now strip all markdown artifacts (#, **, backticks) via cleanMarkdown() helper
- Conversation title used as fallback when no heading found before list
- Separate numbered lists split by prose, headings, or number sequence resets produce separate plans
- Action verb threshold relaxed from 100% to >50% (accepts partial-action lists)
- Tool name matching uses word boundary regex (Write does not match rewrite/overwrite)
- Completion text matching raised from min(2,n) to max(2, ceil(n*0.6)) preventing false positives

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix extractPlans -- title stripping, list merge, action verb threshold**
   - `8c5c538` (test: RED -- failing tests for title/list/threshold)
   - `fbf1692` (feat: GREEN -- implementation passing all tests)
2. **Task 2: Fix inferStepCompletion -- word boundary matching and raised threshold**
   - `de48151` (test: RED -- failing tests for word boundary and threshold)
   - `a3004c3` (feat: GREEN -- implementation passing all tests)

_Note: TDD tasks have RED/GREEN commit pairs_

## Files Created/Modified
- `packages/backend/src/ingestion/plan-extractor.ts` - Added cleanMarkdown(), conversationTitle param, number reset detection, >50% action verb threshold, word boundary tool matching, 60% completion threshold
- `packages/backend/tests/plans/plan-extractor.test.ts` - 8 new test cases for title stripping, list splitting, action verb threshold
- `packages/backend/tests/plans/completion-inference.test.ts` - 5 new test cases for word boundary and raised threshold
- `packages/backend/tests/fixtures/seed-plans.ts` - 8 new test fixtures for markdown titles, split lists, partial action verbs

## Decisions Made
- cleanMarkdown strips heading prefixes, bold/italic markers, and backtick wrappers via sequential regex replacements
- conversationTitle is an optional third parameter to extractPlans (backward-compatible, no breaking changes)
- Action verb threshold uses strict > 0.5 (not >=) meaning exactly 50% is rejected, >50% accepted
- Word boundary regex escapes special characters in tool names for safe regex construction
- Completion threshold formula max(2, ceil(n*0.6)) ensures minimum 2 for short steps, 60% for longer ones

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan extraction heuristics are fixed and tested (76 total plan tests passing)
- Ready for remaining Phase 21 plans (re-ingestion, status display, sort mapping)

---
*Phase: 21-plan-extraction-quality*
*Completed: 2026-03-08*
