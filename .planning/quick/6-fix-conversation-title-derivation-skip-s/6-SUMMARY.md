---
phase: quick-6
plan: 01
subsystem: ingestion
tags: [xml-parsing, title-derivation, normalizer, cursor-normalizer]

requires:
  - phase: 02-ingestion
    provides: normalizer.ts and cursor-normalizer.ts with deriveTitle functions
provides:
  - XML-skip logic in deriveTitle for both Claude Code and Cursor normalizers
  - stripXmlTags helper for fallback title extraction
affects: [ingestion, conversation-list-ui]

tech-stack:
  added: []
  patterns: [two-pass title derivation with XML-skip and fallback stripping]

key-files:
  created: []
  modified:
    - packages/backend/src/ingestion/normalizer.ts
    - packages/backend/src/ingestion/cursor-normalizer.ts
    - packages/backend/tests/ingestion/normalizer.test.ts
    - packages/backend/tests/ingestion/cursor-normalizer.test.ts

key-decisions:
  - "Two-pass approach: first skip XML-prefixed messages, then fallback to stripped text >10 chars"
  - "stripXmlTags is a local helper (not exported) using simple regex replacement"

patterns-established:
  - "XML-prefix detection: content.trim().startsWith('<') identifies system XML messages"

requirements-completed: [QUICK-6]

duration: 2min
completed: 2026-03-05
---

# Quick Task 6: Fix Conversation Title Derivation Summary

**Two-pass XML-skip logic in deriveTitle prevents raw XML system messages from becoming conversation titles**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T19:11:00Z
- **Completed:** 2026-03-04T19:13:29Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments
- deriveTitle in normalizer.ts now skips user messages starting with '<' (XML system content)
- deriveTitle in cursor-normalizer.ts has identical two-pass XML-skip logic
- Fallback pass strips XML tags and uses first message with >10 chars of cleaned text
- 8 new tests covering XML skip, fallback stripping, short-text null return, and plain-text regression

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED):** Add failing tests for XML-skip title derivation - `396e3db` (test)
2. **Task 1 (GREEN):** Implement XML-skip logic in both normalizers - `2fa0292` (feat)

## Files Created/Modified
- `packages/backend/src/ingestion/normalizer.ts` - Added stripXmlTags helper and two-pass deriveTitle with XML-skip logic
- `packages/backend/src/ingestion/cursor-normalizer.ts` - Added identical stripXmlTags helper and two-pass deriveTitle
- `packages/backend/tests/ingestion/normalizer.test.ts` - 5 new tests in 'deriveTitle XML handling' describe block
- `packages/backend/tests/ingestion/cursor-normalizer.test.ts` - 5 new tests in 'deriveTitle XML handling' describe block

## Decisions Made
- Two-pass approach: first pass skips messages starting with '<', second pass strips XML tags as fallback
- 10-character minimum for stripped fallback text prevents short/meaningless XML artifact titles
- stripXmlTags uses simple regex `/<[^>]*>/g` -- sufficient for system XML (not full HTML parser)
- Helper is local (not exported) since it's only needed within deriveTitle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Title derivation now correctly handles XML system messages in both normalizers
- Existing conversations will get corrected titles on next re-ingestion
- No blockers for future work

## Self-Check: PASSED

- All 5 files verified present on disk
- Commit 396e3db (RED) verified in git log
- Commit 2fa0292 (GREEN) verified in git log
- All 299 tests passing (0 failures)

---
*Quick Task: 6-fix-conversation-title-derivation-skip-s*
*Completed: 2026-03-05*
