---
phase: 15-cursor-data-quality
verified: 2026-03-05T18:30:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 15: Cursor Data Quality Verification Report

**Phase Goal:** Cursor conversations display complete, accurate data comparable to Claude Code conversations
**Verified:** 2026-03-05T18:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Cursor assistant bubbles with text content produce messages with that content (not "Empty response") | VERIFIED | `cursor-normalizer.ts` line 101-110: `content: bubble.text \|\| null` for non-tool-only bubbles; test "produces message with text content (not null) for assistant bubble with text" passes |
| 2 | Cursor assistant bubbles that are pure tool executions (no text) show a descriptive summary instead of empty content | VERIFIED | `cursor-normalizer.ts` lines 57-90: groups consecutive tool-only bubbles into `"Executed N tool call(s)"` summary; 8 tests covering this behavior all pass (53/53 tests pass) |
| 3 | ConversationBrowser agent filter dropdown includes "Cursor" option alongside "Claude Code" | VERIFIED | `ConversationBrowser.vue` line 11: `<option v-for="a in AGENTS" :key="a" :value="a">{{ AGENT_LABELS[a] \|\| a }}</option>`; `agent-constants.ts` exports `AGENTS = ['claude-code', 'cursor']`; frontend builds cleanly |
| 4 | Newly ingested Cursor conversations have workspace directory name as project instead of literal "Cursor" | VERIFIED | `index.ts` line 189: `const cursorProject = conv.workspacePath ? basename(conv.workspacePath) : 'Cursor'`; parser sets `workspacePath` from composerData fields (line 65) |
| 5 | Existing Cursor conversations with project="Cursor" get updated to workspace directory name where possible | VERIFIED | `migration.ts` lines 222-268: `fixCursorProjects` queries `agent='cursor' AND project='Cursor'`, uses `generateId` reverse-lookup to map DB IDs to composerIds, calls `path.basename(workspacePath)`; idempotency test passes |
| 6 | Existing Cursor messages with null content get re-derived content from the Cursor DB | VERIFIED | `migration.ts` lines 279-363: `fixCursorMessageContent` re-reads bubbles via `getBubblesForConversation`, matches by `generateId(conversationId, bubbleId)`, falls back to `"Executed tool call"`; 5 tests including re-derive from DB all pass |
| 7 | Migration is idempotent and runs alongside existing title/model fixes on every startup | VERIFIED | `runDataQualityMigration` returns `{titlesFixed, modelsFixed, cursorProjectsFixed, cursorMessagesFixed}`; `index.ts` line 113 includes cursor counts in log condition; idempotency tests confirm second run returns 0 on already-fixed records |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/src/ingestion/cursor-parser.ts` | Workspace path extraction from composerData | VERIFIED | Line 65: `workspacePath: data?.workspacePath ?? data?.workspaceFolder ?? data?.rootDir ?? data?.context?.workspacePath ?? null` — four-field fallback chain; `CursorConversation` interface includes `workspacePath: string \| null` at line 15 |
| `packages/backend/src/ingestion/cursor-normalizer.ts` | Improved assistant bubble content extraction and tool activity summary | VERIFIED | Lines 54-90 implement `isToolOnly` detection and grouped tool summary generation; `content: bubble.text \|\| null` at line 105 preserves text content |
| `packages/backend/src/ingestion/index.ts` | Dynamic project name from workspace path instead of hardcoded "Cursor" | VERIFIED | Line 189: `const cursorProject = conv.workspacePath ? basename(conv.workspacePath) : 'Cursor'`; `basename` imported from `node:path` at line 13 |
| `packages/frontend/src/components/ConversationBrowser.vue` | Agent filter with both claude-code and cursor options | VERIFIED | Line 11: dynamic `v-for` over `AGENTS`; line 160: `import { AGENTS, AGENT_LABELS } from '../utils/agent-constants'` (relative path, not alias) |
| `packages/backend/src/ingestion/migration.ts` | Cursor-specific migration functions for project names and message content | VERIFIED | `fixCursorProjects` at line 222, `fixCursorMessageContent` at line 279; `runDataQualityMigration` extended at line 371 to call both and return cursor counts |
| `packages/backend/tests/ingestion/cursor-normalizer.test.ts` | Tests for content extraction, tool summaries, workspace path | VERIFIED | 53 tests across 8 describe blocks; covers tool-call bubble handling, assistant content extraction, workspace path derivation, model "default" handling |
| `packages/backend/tests/ingestion/migration.test.ts` | Tests for Cursor migration functions | VERIFIED | 33 tests total; `fixCursorProjects` (4 tests), `fixCursorMessageContent` (5 tests), Cursor migration idempotency (2 tests), `runDataQualityMigration` (3 tests including cursor counts) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `cursor-parser.ts` | `index.ts` | `parseCursorDb` returns conversations with `workspacePath`; `index.ts` calls `basename(conv.workspacePath)` | WIRED | `index.ts` line 183: `parseCursorDb(cursorDbPath)`; line 189: `conv.workspacePath ? basename(conv.workspacePath) : 'Cursor'` |
| `cursor-normalizer.ts` | `frontend turn-helpers` | Non-null message content prevents "Empty response" in UI | WIRED | Normalizer produces `"Executed N tool call(s)"` for tool-only bubbles (never null); assistant text bubbles use `bubble.text \|\| null` — null only when bubble has no text AND no tool flags (backward compat case) |
| `migration.ts` | `cursor-parser.ts` | Re-reads Cursor state.vscdb to derive workspace paths and re-extract bubble content | WIRED | `migration.ts` line 17: `import { parseCursorDb, getBubblesForConversation } from './cursor-parser.js'`; used at lines 237 and 334 |
| `migration.ts` | `index.ts` | `runDataQualityMigration` called during ingestion startup | WIRED | `index.ts` line 12: `import { runDataQualityMigration } from './migration.js'`; line 112: `const migrationResult = runDataQualityMigration(db)` called at startup before ingestion loop |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| CURSOR-01 | 15-01, 15-02 | Cursor assistant responses display actual content instead of "Empty response" | SATISFIED | Normalizer produces tool activity summaries for empty-text tool bubbles; migration re-derives content for existing null messages; 8 dedicated tests pass |
| CURSOR-02 | 15-01 | Cursor agent appears in the conversation filter dropdown | SATISFIED | ConversationBrowser.vue uses dynamic `v-for` over `AGENTS` constant; `agent-constants.ts` includes `'cursor'`; frontend build passes |
| CURSOR-03 | 15-01, 15-02 | Cursor project shows workspace path instead of literal "Cursor" | SATISFIED | Parser extracts `workspacePath` from 4 composerData fields; `index.ts` uses `basename(workspacePath)`; `fixCursorProjects` migration fixes existing data; idempotency verified |

All three CURSOR requirements satisfied. No orphaned requirements — REQUIREMENTS.md marks all three as `[x] Complete | Phase 15`.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `cursor-normalizer.ts` | 105 | `content: bubble.text \|\| null` | Info | For non-tool-only bubbles with empty text and no capability flags, content is stored as null. This is the documented backward-compat case (test: "keeps type 2 bubbles with no capability flag and no toolFormerData even with empty text"). The migration's `fixCursorMessageContent` will fill these in with "Executed tool call" retroactively. |

No blockers. No stubs. No placeholder implementations.

---

### Test Results

| Test File | Tests | Result |
|-----------|-------|--------|
| `tests/ingestion/cursor-normalizer.test.ts` | 53/53 | PASS |
| `tests/ingestion/migration.test.ts` | 33/33 | PASS |
| `pnpm --filter frontend build` | — | PASS (built in 2.34s) |

The only failing test in the full suite is `tests/file-watcher.test.ts` (timing-based, 1 flaky assertion), which is pre-existing and unrelated to phase 15.

---

### Human Verification Required

None blocking. The following are informational items for optional manual confirmation:

1. **"Empty response" no longer shown in UI**
   - Test: Start server, navigate to a Cursor conversation that was previously showing "Empty response" for assistant messages
   - Expected: Messages show either actual response text or "Executed N tool call(s)"
   - Why human: Requires live Cursor DB data and UI rendering check

2. **Agent filter shows Cursor in dropdown**
   - Test: Open Conversations page, click the agent filter dropdown
   - Expected: Dropdown shows "All Agents", "Claude Code", "Cursor" options
   - Why human: Browser rendering check

3. **Cursor project name reflects workspace directory**
   - Test: After server startup (which triggers migration), check that existing Cursor conversations show real project names instead of "Cursor"
   - Expected: Project column shows directory names like "myapp", "cowboy", etc.
   - Why human: Requires live Cursor DB data with `workspacePath` present

---

### Commit Verification

All four phase 15 commits exist in git history:

- `e3a0854` — feat(15-01): fix cursor assistant content extraction and workspace path derivation
- `709e244` — feat(15-01): add cursor to ConversationBrowser agent filter dropdown
- `666e0d2` — test(15-02): add failing tests for Cursor project and content migration
- `b9ba1ce` — feat(15-02): implement Cursor project and content migration fixes

---

### Summary

Phase 15 goal is fully achieved. All seven observable truths are verified against actual code. The implementation:

1. **Normalizer** (15-01): Tool-only assistant bubbles produce grouped summaries ("Executed N tool call(s)") instead of null content. Text-bearing assistant bubbles produce their text content verbatim.

2. **Parser** (15-01): `CursorConversation` interface extended with `workspacePath: string | null`. Four-field fallback chain extracts workspace from composerData.

3. **Index** (15-01): Cursor ingestion uses `basename(conv.workspacePath)` with `'Cursor'` fallback instead of hardcoding.

4. **ConversationBrowser** (15-01): Agent filter uses dynamic `v-for` over `AGENTS` constant, automatically showing both Claude Code and Cursor. Relative import path (`../utils/agent-constants`) resolves correctly in Vite build.

5. **Migration** (15-02): `fixCursorProjects` and `fixCursorMessageContent` retroactively fix existing data using deterministic ID reverse-lookup. Both are idempotent. `runDataQualityMigration` extended to include cursor fix counts in return value and startup log.

---

_Verified: 2026-03-05T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
