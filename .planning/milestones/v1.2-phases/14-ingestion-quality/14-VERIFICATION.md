---
phase: 14-ingestion-quality
verified: 2026-03-05T17:43:30Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 14: Ingestion Quality Verification Report

**Phase Goal:** Conversations have accurate, meaningful titles and correct model attribution
**Verified:** 2026-03-05T17:43:30Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Newly ingested conversations show the first real user message as title, not system caveats or interruption notices | VERIFIED | `shouldSkipForTitle` in normalizer.ts:200 and cursor-normalizer.ts:161 skips "Caveat:" and "[Request interrupted" prefixes before returning a title |
| 2 | Conversations with only slash commands or system messages before real content still get a meaningful title from the first substantive user message | VERIFIED | Three-pass fallback in `deriveTitle`: (1) skip bad user messages, (2) XML-strip fallback, (3) assistant text fallback — confirmed in normalizer.ts:196-230 and cursor-normalizer.ts:157-184 |
| 3 | Conversations that previously showed NULL model now display the most common model derived from their messages or token usage data | VERIFIED | `deriveMostCommonModel ?? deriveMostCommonModelFromTokenUsage(tokenUsage)` at normalizer.ts:183-185; migration.ts fixes existing NULL-model claude-code conversations from token_usage |
| 4 | Cursor conversations with "default" model show the actual resolved model name or "unknown" instead of the literal string "default" | VERIFIED | `deriveModel` in cursor-normalizer.ts:186-216 skips "default" in modelConfig and bubble scan; returns "unknown" when no real model found. Per-message: rawModel === 'default' ? 'unknown' : rawModel at cursor-normalizer.ts:65-66 |

**Score:** 4/4 truths verified

### Required Artifacts (Plan 14-01)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/ingestion/title-utils.ts` | Shared title skip logic and assistant-snippet fallback | VERIFIED | 89 lines; exports `shouldSkipForTitle` and `deriveConversationTitle`; fully substantive with 5-rule ordered skip logic and 3-pass fallback chain |
| `packages/backend/src/ingestion/normalizer.ts` | Updated deriveTitle using shared utils, token_usage model fallback | VERIFIED | Imports `shouldSkipForTitle`; deriveTitle has 3-pass logic; `deriveMostCommonModelFromTokenUsage` helper with token_usage fallback at line 183-185 |
| `packages/backend/src/ingestion/cursor-normalizer.ts` | Updated deriveTitle using shared utils, "default" model handling | VERIFIED | Imports `shouldSkipForTitle`; deriveTitle has 3-pass logic; `deriveModel` skips "default" and returns "unknown"; per-message "default" -> "unknown" at line 65-66 |

### Required Artifacts (Plan 14-02)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/ingestion/migration.ts` | One-time data migration for title and model fixes | VERIFIED | 224 lines; exports `needsTitleFix`, `fixConversationTitles`, `fixConversationModels`, `runDataQualityMigration`; uses Drizzle ORM; idempotent by design |
| `packages/backend/src/ingestion/index.ts` | Migration hooked into ingestion startup | VERIFIED | `runDataQualityMigration` imported at line 12 and called at line 111 inside `runIngestion()`, before file processing begins; wrapped in non-fatal try/catch |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `normalizer.ts` | `title-utils.ts` | `import shouldSkipForTitle` | WIRED | Line 3: import; Line 200: active call in deriveTitle loop |
| `cursor-normalizer.ts` | `title-utils.ts` | `import shouldSkipForTitle` | WIRED | Line 2: import; Line 161: active call in deriveTitle loop |
| `migration.ts` | `title-utils.ts` | `import shouldSkipForTitle` | WIRED | Line 14: import; used in `needsTitleFix` and `fixConversationTitles` |
| `migration.ts` | `db/schema.ts` | `import conversations, messages, tokenUsage` | WIRED | Line 13: import; all three tables queried and updated in migration functions |
| `index.ts` | `migration.ts` | `call runDataQualityMigration` | WIRED | Line 12: import; Line 111: called at top of `runIngestion()` before any file processing |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TITLE-01 | 14-01, 14-02 | Title uses first real user message, skipping "Caveat: The messages below..." | SATISFIED | `shouldSkipForTitle` returns true for "Caveat:" prefix (title-utils.ts:28); confirmed by 18 title-utils tests + normalizer/cursor-normalizer tests + migration tests |
| TITLE-02 | 14-01, 14-02 | Title skips "[Request interrupted by user for tool use]" messages | SATISFIED | `shouldSkipForTitle` returns true for "[Request interrupted" prefix (title-utils.ts:31); test: `shouldSkipForTitle('[Request interrupted by user for tool use]') === true` |
| TITLE-03 | 14-01, 14-02 | Title skips /clear and other slash-only messages | SATISFIED | `shouldSkipForTitle` returns true for messages starting with "/" (title-utils.ts:25); migration test confirms "/clear" title gets recomputed |
| MODEL-01 | 14-01, 14-02 | Conversation-level model derived from most common model in messages/token_usage when NULL | SATISFIED | normalizer.ts:183-185 two-stage derivation; migration.ts fixConversationModels queries token_usage for claude-code NULL-model conversations |
| MODEL-02 | 14-01, 14-02 | Cursor "default" model handled gracefully | SATISFIED | cursor-normalizer.ts:187-213 deriveModel skips "default" in modelConfig and bubble scan; returns "unknown" when all "default". Per-message: line 65-66 replaces "default" with "unknown" |

**All 5 requirements from plans satisfied. No orphaned requirements detected.**

Requirements cross-referenced: TITLE-01, TITLE-02, TITLE-03 all map to Phase 14 in REQUIREMENTS.md (marked complete). MODEL-01, MODEL-02 map to Phase 14 (marked complete). No Phase 14 requirements appear in REQUIREMENTS.md that are not accounted for in the plans.

### Anti-Patterns Found

None. Scan of all 5 modified/created source files found:
- No TODO/FIXME/XXX/HACK/PLACEHOLDER comments
- No empty return stubs (`return null`, `return {}`, `return []`)
- No handler-only implementations
- No console.log-only implementations

### Human Verification Required

None. All behaviors are programmatically verifiable through the test suite. The following were confirmed automatically:

1. 18 title-utils tests pass — all skip patterns and fallback chain tested
2. 35 normalizer tests pass — includes 5 new skip/fallback/model-fallback cases
3. 47 cursor-normalizer tests pass — includes 9 new skip/default-model cases
4. 21 migration tests pass — covers all bad title patterns, NULL model, "default" model, idempotency, and per-message model fix

**Total: 121 tests pass, 0 failures**

### Test Run Evidence

```
 ✓ tests/ingestion/title-utils.test.ts (18 tests) 3ms
 ✓ tests/ingestion/cursor-normalizer.test.ts (47 tests) 7ms
 ✓ tests/ingestion/normalizer.test.ts (35 tests) 9ms
 ✓ tests/ingestion/migration.test.ts (21 tests) 23ms

 Test Files  4 passed (4)
      Tests  121 passed (121)
   Duration  617ms
```

### Commit Verification

All documented commit hashes exist in git history:
- `18b1848` — feat(14-01): add shared title-utils with skip logic and assistant fallback
- `d2801cf` — feat(14-01): update normalizers with shared skip logic and model fallback
- `ce6e0b6` — test(14-02): add failing tests for data quality migration
- `1d1a20a` — feat(14-02): implement data quality migration for titles and models
- `964c96c` — feat(14-02): hook data quality migration into ingestion startup

## Summary

Phase 14 goal is fully achieved. Both plans executed cleanly:

**Plan 14-01** delivered a shared `title-utils.ts` module with `shouldSkipForTitle` implementing five ordered skip rules (empty, slash commands, "Caveat:", "[Request interrupted", XML). Both the Claude Code and Cursor normalizers import and actively call this function in their `deriveTitle` paths. The Claude Code normalizer gained a `deriveMostCommonModelFromTokenUsage` fallback for NULL-model conversations. The Cursor normalizer correctly resolves "default" to either the actual model from bubbles or "unknown" at both conversation and per-message level.

**Plan 14-02** delivered an idempotent migration module (`migration.ts`) that retroactively corrects existing database records. It is wired into `runIngestion()` in `index.ts` at line 111, running before any file processing on every ingestion cycle. The migration is non-fatal (errors are caught and logged) and fast on subsequent runs (needsTitleFix guards prevent unnecessary updates).

All 5 requirements (TITLE-01, TITLE-02, TITLE-03, MODEL-01, MODEL-02) are satisfied with no gaps.

---

_Verified: 2026-03-05T17:43:30Z_
_Verifier: Claude (gsd-verifier)_
