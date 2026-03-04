---
phase: 06-cursor-integration-agent-comparison
plan: 01
subsystem: ingestion, api
tags: [cursor, vscdb, better-sqlite3, agent-filter, model-pricing, gpt, openai]

# Dependency graph
requires:
  - phase: 02-ingestion-pipeline
    provides: "Normalizer, ID generator, ingestion plugin, file discovery patterns"
  - phase: 03-analytics-dashboard
    provides: "getOverviewStats, getTimeSeries, analytics routes, calculateCost"
provides:
  - "Cursor state.vscdb parser (parseCursorDb, getBubblesForConversation)"
  - "Cursor normalizer transforming vscdb data to NormalizedData"
  - "Cursor file discovery for macOS and Linux"
  - "Agent-filtered getOverviewStats and getTimeSeries queries"
  - "getModelDistribution query for per-model usage breakdown"
  - "Model-distribution API endpoint"
  - "Cursor model aliases and GPT model pricing in MODEL_PRICING"
  - "File watcher monitoring Cursor globalStorage directory"
  - "ModelDistributionEntry shared type"
affects: [06-02-frontend-agent-pages, 07-settings-configuration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cursor vscdb readonly parsing via better-sqlite3 with CAST(value AS TEXT) for BLOB values"
    - "Agent-filtered analytics queries with optional agent parameter (backward compatible)"
    - "Dual file watcher: Claude Code (1s debounce) + Cursor (3s debounce)"
    - "Deterministic Cursor IDs via generateId('cursor', composerId)"

key-files:
  created:
    - "packages/backend/src/ingestion/cursor-file-discovery.ts"
    - "packages/backend/src/ingestion/cursor-parser.ts"
    - "packages/backend/src/ingestion/cursor-normalizer.ts"
    - "packages/backend/tests/ingestion/cursor-parser.test.ts"
    - "packages/backend/tests/ingestion/cursor-normalizer.test.ts"
    - "packages/backend/tests/ingestion/cursor-ingest.test.ts"
    - "packages/backend/tests/analytics/comparison.test.ts"
  modified:
    - "packages/shared/src/types/pricing.ts"
    - "packages/shared/src/types/api.ts"
    - "packages/shared/src/types/index.ts"
    - "packages/backend/src/ingestion/index.ts"
    - "packages/backend/src/db/queries/analytics.ts"
    - "packages/backend/src/routes/analytics.ts"
    - "packages/backend/src/plugins/file-watcher.ts"

key-decisions:
  - "Cursor normalizer is separate module (not modifying existing normalizer) to keep Claude Code pipeline untouched"
  - "GPT model pricing includes estimated cache rates based on OpenAI prompt caching documentation"
  - "Cursor cacheReadTokens and cacheCreationTokens set to 0 (Cursor does not expose cache data)"
  - "File watcher uses 3s debounce for Cursor vs 1s for Claude Code due to Cursor's frequent writes"
  - "Static project name 'Cursor' for all Cursor conversations (Cursor lacks per-project directory structure)"

patterns-established:
  - "Optional agent parameter on analytics queries for backward-compatible agent filtering"
  - "Separate cursor-parser/cursor-normalizer modules paralleling claude-code-parser/normalizer"
  - "Multiple file watchers with independent debounce timers per data source"

requirements-completed: [INGEST-02, DASH-04, DASH-05]

# Metrics
duration: 7min
completed: 2026-03-04
---

# Phase 6 Plan 01: Cursor Ingestion + Agent API Filtering Summary

**Cursor state.vscdb parser with normalizer, agent-filtered analytics API, GPT/Cursor model pricing, and DASH-05 comparison validation**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-04T11:43:04Z
- **Completed:** 2026-03-04T11:50:44Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Cursor state.vscdb parsed into conversations, messages, and token_usage with deterministic dedup
- API overview and timeseries endpoints accept optional `agent` query parameter for per-agent filtering
- New model-distribution endpoint returns per-model usage breakdown
- MODEL_PRICING extended with Cursor Claude aliases and 8 GPT/OpenAI models
- File watcher monitors Cursor globalStorage for state.vscdb changes with 3s debounce
- 55 new tests including DASH-05 comparison validation (182 total backend tests, all passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Cursor parser, file discovery, normalizer, and pricing** - `ca6e118` (feat)
2. **Task 2: Wire Cursor ingestion, extend API, comparison test** - `76a6b11` (feat)

## Files Created/Modified
- `packages/backend/src/ingestion/cursor-file-discovery.ts` - Platform-specific state.vscdb path discovery
- `packages/backend/src/ingestion/cursor-parser.ts` - Parse cursorDiskKV composerData + bubbleId entries
- `packages/backend/src/ingestion/cursor-normalizer.ts` - Transform Cursor data into NormalizedData with agent='cursor'
- `packages/shared/src/types/pricing.ts` - Added Cursor Claude aliases and GPT model pricing
- `packages/shared/src/types/api.ts` - Added ModelDistributionEntry type
- `packages/shared/src/types/index.ts` - Export ModelDistributionEntry
- `packages/backend/src/ingestion/index.ts` - Integrated Cursor ingestion after Claude Code
- `packages/backend/src/db/queries/analytics.ts` - Added agent filter to overview/timeseries, added getModelDistribution
- `packages/backend/src/routes/analytics.ts` - Extended routes with agent param and model-distribution endpoint
- `packages/backend/src/plugins/file-watcher.ts` - Added Cursor globalStorage watcher with 3s debounce
- `packages/backend/tests/ingestion/cursor-parser.test.ts` - 12 parser tests
- `packages/backend/tests/ingestion/cursor-normalizer.test.ts` - 26 normalizer tests
- `packages/backend/tests/ingestion/cursor-ingest.test.ts` - 6 integration tests with dedup verification
- `packages/backend/tests/analytics/comparison.test.ts` - 11 DASH-05 comparison validation tests

## Decisions Made
- Cursor normalizer is a separate module rather than modifying existing Claude Code normalizer -- keeps pipelines independent and avoids risk to existing functionality
- GPT model pricing includes estimated prompt caching rates based on OpenAI documentation
- Cursor conversations use static project name 'Cursor' since Cursor doesn't organize by project directory
- Cursor cacheReadTokens/cacheCreationTokens always 0 because Cursor doesn't expose cache data in vscdb
- File watcher uses 3s debounce for Cursor (longer than Claude Code's 1s) because Cursor writes to state.vscdb more frequently

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed totalTokens column reference in ORDER BY**
- **Found during:** Task 2 (getModelDistribution query)
- **Issue:** SQLite `ORDER BY totalTokens DESC` failed because Drizzle aliases are not visible in ORDER BY
- **Fix:** Referenced the full SQL expression in orderBy instead of the alias name
- **Files modified:** packages/backend/src/db/queries/analytics.ts
- **Verification:** comparison.test.ts model distribution tests pass
- **Committed in:** 76a6b11 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor SQL syntax issue, no scope creep.

## Issues Encountered
None beyond the auto-fixed SQL alias issue.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend fully ready for Phase 06 Plan 02 (frontend agent pages and comparison views)
- All API endpoints support agent filtering: overview, timeseries, model-distribution, conversations
- Cursor ingestion automatically runs alongside Claude Code on boot and file changes
- 182 backend tests all green, zero regressions

---
*Phase: 06-cursor-integration-agent-comparison*
*Completed: 2026-03-04*
