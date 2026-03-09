---
phase: 25-data-quality-code-cleanup
plan: 01
subsystem: ingestion
tags: [parser, streaming, dedup, xml-sanitization, migration, sqlite]

# Dependency graph
requires: []
provides:
  - "Streaming chunk dedup via replace-not-append in parser"
  - "Backend XML tag stripping with SYSTEM_TAG_PATTERN allowlist"
  - "Idempotent migration to clean existing assistant content"
  - "Fixed getTurnContent passthrough bug in AssistantGroupCard"
affects: [26-tool-viewer-upgrade, 27-display-improvements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cumulative streaming: replace content blocks per chunk, not append"
    - "Allowlist XML stripping: only strip known system tags, preserve user XML"
    - "Belt-and-suspenders sanitization: backend at ingestion + frontend at display"

key-files:
  created:
    - packages/backend/tests/fixtures/streaming-conversation.jsonl
  modified:
    - packages/backend/src/ingestion/claude-code-parser.ts
    - packages/backend/src/ingestion/normalizer.ts
    - packages/backend/src/ingestion/migration.ts
    - packages/backend/src/ingestion/index.ts
    - packages/frontend/src/components/AssistantGroupCard.vue
    - packages/backend/tests/fixtures/streaming-assistant.jsonl
    - packages/backend/tests/ingestion/parser.test.ts

key-decisions:
  - "Streaming chunks are cumulative (replace, not append) matching Claude Code JSONL format"
  - "XML stripping uses allowlist pattern (SYSTEM_TAG_PATTERN) to avoid stripping legitimate user XML"
  - "Migration strips XML from existing assistant content rather than attempting content block dedup"

patterns-established:
  - "SYSTEM_TAG_PATTERN: shared allowlist regex for system-injected XML tags"
  - "stripSystemXmlTags: reusable function for backend XML cleanup"

requirements-completed: [DATA-01, DATA-02, DATA-03]

# Metrics
duration: 6min
completed: 2026-03-09
---

# Phase 25 Plan 01: Data Quality Fixes Summary

**Streaming dedup via replace-not-append, backend XML tag stripping with allowlist, migration for existing content, and getTurnContent passthrough fix**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-09T07:28:08Z
- **Completed:** 2026-03-09T07:34:11Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Parser now replaces (not appends) content blocks per streaming chunk, eliminating duplicate tool calls and inflated content
- Backend normalizer strips known system XML tags before storing in SQLite, preventing raw XML from reaching the display layer
- Idempotent startup migration cleans existing assistant message content of system XML tags
- Fixed one-line bug where getTurnContent passed raw content to parseContent instead of already-cleaned content

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix parser streaming dedup and add test fixtures** - `1ade98e` (feat) - pre-existing commit included parser fix
2. **Task 2: Add backend XML sanitization and fix getTurnContent bug** - `75cf88a` (feat)
3. **Task 3: Add migration to fix existing duplicated content in database** - `1dace4b` (feat)

## Files Created/Modified
- `packages/backend/src/ingestion/claude-code-parser.ts` - Replace-not-append for streaming content blocks
- `packages/backend/src/ingestion/normalizer.ts` - Backend XML tag stripping with SYSTEM_TAG_PATTERN allowlist
- `packages/backend/src/ingestion/migration.ts` - fixDuplicateContentBlocks migration function
- `packages/backend/src/ingestion/index.ts` - Updated migration result logging for contentFixed
- `packages/frontend/src/components/AssistantGroupCard.vue` - Fixed getTurnContent to pass cleaned content
- `packages/backend/tests/fixtures/streaming-conversation.jsonl` - Test fixture with 3 cumulative streaming chunks
- `packages/backend/tests/fixtures/streaming-assistant.jsonl` - Updated to cumulative format
- `packages/backend/tests/ingestion/parser.test.ts` - 4 new streaming dedup tests

## Decisions Made
- Streaming chunks are cumulative (each contains full content up to that point), so replace-not-append is correct
- XML stripping uses an allowlist of known system tags rather than stripping all XML, preserving legitimate user XML content
- Migration focuses on XML tag cleanup for existing data rather than attempting to detect/fix duplicated content blocks (parser fix prevents new duplicates)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated streaming-assistant.jsonl fixture to cumulative format**
- **Found during:** Task 1 (parser fix)
- **Issue:** Existing fixture used delta-style chunks (each with unique content). The replace-not-append fix broke existing tests because the old fixture format was not how Claude Code actually streams.
- **Fix:** Updated fixture to cumulative format where each chunk contains all content up to that point
- **Files modified:** packages/backend/tests/fixtures/streaming-assistant.jsonl
- **Verification:** All 24 parser tests pass
- **Committed in:** 1ade98e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fixture update was necessary to match real Claude Code streaming behavior. No scope creep.

## Issues Encountered
- Task 1 parser fix and test fixture were already committed in a prior session (commit 1ade98e, bundled with 25-02 work). Verified changes are correct and tests pass.
- Pre-existing test failures in cursor-parser, cursor-ingest, analytics, and app.test.ts -- all unrelated to this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All downstream features (tool viewers, display improvements) can now rely on clean, deduplicated content in the database
- New ingestions produce correct content blocks (no duplicates, no system XML)
- Existing data cleaned via startup migration

---
*Phase: 25-data-quality-code-cleanup*
*Completed: 2026-03-09*
