---
phase: quick-260417-ok0
plan: 01
subsystem: schema + ingestion + frontend-rendering
tags: [subagent, schema-migration, ghost-card, three-state, impr-7, null-safety]
requires:
  - FINDINGS.md §2.6 (Running vs Unmatched indistinguishable)
  - FINDINGS.md §4.1c (unmatched ghost diagnostic)
  - FINDINGS.md §5 IMPROVEMENT-7 (whole vertical slice)
  - .planning/quick/260417-nwh-impr-1-emit-websocket-tool-call-changed-/260417-nwh-SUMMARY.md (running->unmatched transition via existing tool_call:changed refetch)
provides:
  - column: tool_calls.subagent_link_attempted INTEGER NOT NULL DEFAULT 0
  - api-field: ToolCallRow.subagentLinkAttempted boolean
  - util: classifyGhostState(flags) -> 'running' | 'unmatched' | 'missing' | 'summary'
  - render: SubagentSummaryCard.vue four v-if branches gated on ghostState
  - prop-chain: isActive from ConversationDetailPage -> ConversationDetail -> AssistantGroupCard -> ToolCallRow -> SubagentSummaryCard
  - type-hardening: SubagentSummaryCard `summary` computed is SubagentSummary | null, all summary-derived computeds null-safe
affects:
  - src-tauri/src/schema.sql
  - src-tauri/src/db.rs
  - src-tauri/src/ingestion/mod.rs
  - src-tauri/src/conversations.rs
  - packages/frontend/src/types/api.ts
  - packages/frontend/src/utils/ghost-card-state.ts (new)
  - packages/frontend/tests/utils/ghost-card-state.test.ts (new)
  - packages/frontend/src/components/SubagentSummaryCard.vue
  - packages/frontend/src/components/ToolCallRow.vue
  - packages/frontend/src/components/AssistantGroupCard.vue
  - packages/frontend/src/components/ConversationDetail.vue
  - packages/frontend/src/components/TrayConversationView.vue (Rule 3 deviation — second caller of ConversationDetail)
  - packages/frontend/src/pages/ConversationDetailPage.vue
tech-stack:
  added: []
  patterns:
    - "idempotent ALTER TABLE migration via `SELECT col FROM table LIMIT 0` + `is_ok()` probe (mirrored from server_port migration at db.rs:33-44)"
    - "pure state classifier with strict precedence (summary > missing > unmatched > running)"
    - "script-level null hardening for Vue computeds (eager re-evaluation safety)"
    - "serde `rename_all = camelCase` auto-projection of Rust bool to TS `subagentLinkAttempted`"
key-files:
  created:
    - packages/frontend/src/utils/ghost-card-state.ts
    - packages/frontend/tests/utils/ghost-card-state.test.ts
  modified:
    - src-tauri/src/schema.sql
    - src-tauri/src/db.rs
    - src-tauri/src/ingestion/mod.rs
    - src-tauri/src/conversations.rs
    - packages/frontend/src/types/api.ts
    - packages/frontend/src/components/SubagentSummaryCard.vue
    - packages/frontend/src/components/ToolCallRow.vue
    - packages/frontend/src/components/AssistantGroupCard.vue
    - packages/frontend/src/components/ConversationDetail.vue
    - packages/frontend/src/components/TrayConversationView.vue
    - packages/frontend/src/pages/ConversationDetailPage.vue
decisions:
  - "Option (a) for legacy rows: pre-migration tool_calls default to subagent_link_attempted=0 and render as 'running' until next ingestion cycle flips the flag — natural fix-forward cadence, no backfill migration needed"
  - "UPDATE runs unconditionally inside Phase B project loop (regardless of links.is_empty()) so unmatched == 'linker ran, found nothing' is distinguishable from running == 'linker has not run yet'"
  - "Script-level null hardening mandatory: Vue computeds re-evaluate eagerly via watchers/devtools, decoupled from template v-if — template guards alone are insufficient"
  - "Chose INTEGER NOT NULL DEFAULT 0 over BOOLEAN for the new column (project convention — matches claude_code_enabled, sync_enabled, last_sync_success)"
  - "No new WebSocket broadcast for subagent_link_attempted UPDATE — IMPR-1's existing tool_call:changed + conversation:changed events already trigger refetch at natural cadence; additional broadcast explicitly out of scope"
metrics:
  duration: ~12 minutes
  completed: 2026-04-17
requirements:
  - IMPR-7
---

# Quick 260417-ok0 Plan 01: Three-State Ghost Sub-Agent Card Summary

Closes FINDINGS.md §2.6 and §4.1c: the ambiguous "Subagent data not found" dashed-border ghost card is now split into three visually and semantically distinct states — Running (linker not yet run; pulses when parent isActive), Unmatched (linker ran, no match; diagnostic text), Missing (link exists but child JSONL gone; deep link) — plus the existing rich Summary branch unchanged. A new DB column `tool_calls.subagent_link_attempted` flipped by the Phase B linker pass drives the classification, projected end-to-end from SQLite through the Rust `ToolCallRow` struct, the `/api/analytics/conversations/:id` detail endpoint, the TS type, a pure `classifyGhostState(flags)` function with 8 vitest cases, and the Vue template.

## Commits

| # | Commit | Scope | Message |
| - | ------ | ----- | ------- |
| 1 | `ff19f54` | schema + migration | feat(quick-260417-ok0): add subagent_link_attempted column + idempotent migration (IMPR-7) |
| 2 | `d37a377` | backend write + API | feat(quick-260417-ok0): mark link-attempted flag + project through detail API (IMPR-7) |
| 3 | `6c070fa` | types + classifier + tests | feat(quick-260417-ok0): types + classifier + tests for three-state ghost card (IMPR-7) |
| 4 | `a3e35dc` | prop chain | feat(quick-260417-ok0): thread isActive prop through conversation chain (IMPR-7) |
| 5 | `8b362bc` | render + null-safety | feat(quick-260417-ok0): three-state render + null-safe computeds in SubagentSummaryCard (IMPR-7) |

## Schema + Migration (commit 1)

**schema.sql** — appended `subagent_link_attempted INTEGER NOT NULL DEFAULT 0` to the `tool_calls` CREATE TABLE (INTEGER per project convention; not BOOLEAN).

**db.rs** — added an idempotent migration block mirroring the `server_port` pattern at db.rs:33-44:

```rust
conn.call(|conn| {
    let has_column: bool = conn
        .prepare("SELECT subagent_link_attempted FROM tool_calls LIMIT 0")
        .is_ok();
    if !has_column {
        conn.execute_batch(
            "ALTER TABLE tool_calls ADD COLUMN subagent_link_attempted INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    Ok::<(), rusqlite::Error>(())
})
.await?;
```

Idempotency is structurally proven: the SELECT probe returns `Err(_)` only when the column is absent; `is_ok()` collapses to bool; the ALTER only runs on the missing path. Running on a DB that already has the column is a no-op (probe succeeds, branch skipped).

## Phase B Link-Attempted UPDATE (commit 2)

Inserted in `ingestion/mod.rs` `link_subagents_post_processing` between `link_subagents()` return and the `if !links.is_empty()` block — running unconditionally inside the project loop (gated only by the prior early-exit for empty parent/subagent file lists):

```rust
let parent_session_ids: Vec<String> = parent_files
    .iter()
    .map(|f| f.session_id.clone())
    .collect();
state
    .db
    .call(move |conn| {
        let tx = conn.transaction()?;
        for sid in &parent_session_ids {
            let parent_conv_id = generate_id(&["claude-code", sid]);
            tx.execute(
                "UPDATE tool_calls SET subagent_link_attempted = 1 \
                 WHERE conversation_id = ?1 AND name IN ('Task', 'Agent')",
                rusqlite::params![parent_conv_id],
            )?;
        }
        tx.commit()?;
        Ok::<_, tokio_rusqlite::Error>(())
    })
    .await?;
```

Single transaction per project (not per parent file). Filter `name IN ('Task', 'Agent')` matches `subagent_linker.rs:60-61`'s `SUBAGENT_TOOL_NAMES` set. Idempotent (re-runs set 1->1 with no effect).

## API Projection (commit 2)

`conversations.rs` `ToolCallRow` struct gained `pub subagent_link_attempted: bool`; the detail-query SELECT at line 906 appends `, subagent_link_attempted` to its column list; the row-mapping closure reads column 10 as `i64` and converts `!= 0` to bool. `#[serde(rename_all = "camelCase")]` auto-serializes to `subagentLinkAttempted`. Other `FROM tool_calls` queries (settings.rs counter, analytics.rs aggregate, linker's `ToolCallInfo` query, migration.rs, snapshot.rs) construct different structs and are unaffected.

## Classifier + Tests (commit 3)

`packages/frontend/src/utils/ghost-card-state.ts` exports a pure function:

```typescript
export function classifyGhostState(flags: GhostCardFlags): GhostCardState {
  if (flags.subagentSummary) return 'summary';
  if (flags.subagentConversationId) return 'missing';
  if (flags.subagentLinkAttempted) return 'unmatched';
  return 'running';
}
```

Precedence: summary > missing (link written, summary absent) > unmatched (flag set, no link) > running (flag not set).

**TDD cycle:** RED step confirmed (module-not-found error when running the test against the non-existent classifier), then GREEN step implementation passed all 8 vitest cases on first run — every state plus key tiebreakers (summary dominates everything; link dominates flag; active-ness does NOT re-promote unmatched back to running).

## Prop Chain (commit 4)

`isActive: boolean` threaded from `ConversationDetailPage.vue` (source: `data.conversation.isActive ?? false`) through:
- `ConversationDetail.vue` (defineProps + forward to AssistantGroupCard)
- `AssistantGroupCard.vue` (defineProps + forward to every `<ToolCallRowComponent>`)
- `ToolCallRow.vue` (defineProps + forward to SubagentSummaryCard)
- `SubagentSummaryCard.vue` (consumer)

**Deviation — Rule 3 (blocking type error):** vue-tsc surfaced a second caller of `ConversationDetail` — `TrayConversationView.vue` — that was missing the now-required `isActive` prop. Fixed inline by passing `data.conversation.isActive ?? false` (same source pattern as `ConversationDetailPage.vue`). Tracked here as deviation; no user decision needed (unambiguous follow-through of the prop-required-ness design choice).

## Render + Null-Safety (commit 5)

**Template** — four `v-if`/`v-else-if`/`v-else-if`/`v-else` branches gated on `ghostState`:
- `missing` — `border-warning/60` AlertTriangle + "Subagent file missing on disk" + deep link
- `unmatched` — `border-base-300` HelpCircle + "Unmatched sub-agent" + italic "No agentId in output and no matching description"
- `running` — `border-info/40` Loader2 + dynamic label (from `input.description` if present, fallback "Subagent running...") + optional elapsed-time counter (`>1s` only, only when `isActive`); `animate-spin` class bound to `isActive`
- `summary` (v-else) — existing rich card template unchanged

**Script null-hardening** (addresses the BLOCKER from planning iteration 1: Vue computeds re-evaluate eagerly via watchers/devtools/debug hooks, decoupled from template v-if — template guards alone cannot prevent `TypeError` on eager eval):

| Computed | Before | After |
| -------- | ------ | ----- |
| `summary` | `as SubagentSummary` (non-null cast lie) | `(x ?? null) as SubagentSummary \| null` |
| `isError` | `summary.value.status === ...` | `summary.value?.status === ...` |
| `formattedDuration` | `summary.value.durationMs` then math | `summary.value?.durationMs`; `if (ms == null) return null;` |
| `toolBreakdownEntries` | `Object.entries(summary.value.toolBreakdown)` | `Object.entries(summary.value?.toolBreakdown ?? {})` |
| `filesTouchedText` | `summary.value.filesTouched` | `summary.value?.filesTouched ?? []` |
| `confidenceHint` | `summary.value.matchConfidence` | `summary.value?.matchConfidence` |
| `statusIcon`, `statusBadgeClass`, `cardClasses` | read `isError.value` (boolean) | NO CHANGE (safe by transitivity after `isError` fix) |
| `cardTitle`, `subagentType`, `typeBadgeClass`, `subagentModel`, `toolBreakdownText` | never touched `summary.value` | NO CHANGE |

Template expressions `{{ summary.xxx }}` inside the `v-else` summary branch (status, lastError, inputTokens, outputTokens, filesTouched.length) were updated to use `?.` with safe fallbacks as an extra belt-and-suspenders layer (reads are only reachable when `ghostState === 'summary'`, but the expressions are re-evaluated by Vue's scheduler regardless of the v-branch).

## Verification

| Check | Result |
| ----- | ------ |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS — 27 pre-existing warnings (same baseline as IMPR-1 SUMMARY); zero errors; zero new warnings |
| `cargo test test_schema_creates_all_tables` | PASS — 9 tables, 7 indexes unchanged |
| `cargo test subagent_linker` | PASS — 7/7 existing linker tests still pass |
| `npx vue-tsc --noEmit` (frontend) | PASS — zero errors |
| `npx vitest run tests/utils/ghost-card-state.test.ts` | PASS — 8/8 new classifier cases |
| `npx vitest run` (full frontend suite) | 272/276 PASS — 4 pre-existing failures, all confirmed present on pre-plan baseline (`a3e35dc^`): 3 in `useCommandPalette`/`app.test.ts` (unrelated), 1 in `useConversationDetail` (known deferred from IMPR-1). Zero new failures introduced by this plan. |
| `grep -n "summary\\.value\\." SubagentSummaryCard.vue` | 5 matches, all using `?.` optional chaining; zero bare dereferences |
| `grep -n "as SubagentSummary\\b" SubagentSummaryCard.vue` | 1 match, line 233: `as SubagentSummary \| null` (nullable form, not bare) |
| `grep -n "Subagent data not found\|opacity-50" SubagentSummaryCard.vue` | Zero matches (old ghost copy + styling removed) |
| `grep -n "broadcast_event" src-tauri/src/ingestion/mod.rs` | 3 call sites — same as IMPR-1 baseline (per-file ~200, stale-timer ~269, Phase B ~619). No new broadcasts added. |
| `grep -n "subagent_link_attempted" src-tauri/src/` | 4 logical sites: schema.sql, db.rs (probe + ALTER), ingestion/mod.rs (UPDATE), conversations.rs (struct + SELECT + row map) |
| `grep -n "subagentLinkAttempted" packages/frontend/src/` | 5 matches across: types/api.ts (interface field), utils/ghost-card-state.ts (param type + docs + check), components/SubagentSummaryCard.vue (computed binding) — matches plan |

## Deviations from Plan

### Rule 3 (blocking) — second caller of ConversationDetail

**Found during:** Sub-task 3d (vue-tsc after prop chain edit).

**Issue:** `TrayConversationView.vue` renders `<ConversationDetail>` without the new required `isActive` prop. vue-tsc rejected the full prop-chain edit with `TS2345: Property 'isActive' is missing` at line 7 of TrayConversationView.vue.

**Fix:** Added `:isActive="data.conversation.isActive ?? false"` to the TrayConversationView call site, mirroring the pattern in `ConversationDetailPage.vue:141`. `useConversationDetail` (same composable the tray view already uses) already exposes `data.conversation.isActive` per the existing `ConversationDetailResponse` type.

**Files modified:** `packages/frontend/src/components/TrayConversationView.vue`.

**Commit:** bundled into `a3e35dc` (Sub-task 3d commit) so the prop chain is consistent across all callers.

**Rationale:** This is a classic Rule 3 deviation — fixing a blocking issue discovered during execution that prevents the current task from compiling. The fix is unambiguous (same source pattern, same semantics), no user decision needed, and keeping the two callers consistent is the clear right answer.

### No other deviations

Plan executed otherwise verbatim. All 5 commits match the plan's `<output>` cadence exactly (Tasks 1+2 each = 1 commit; Task 3 split 3a+3b+3c / 3d / 3e+3f).

## Deferred Items

- **Pre-existing vitest failures in `useCommandPalette`, `app.test.ts`, `useConversationDetail`** — 4 failures present on pre-plan baseline; out of scope per executor scope boundary. `useConversationDetail` failure is already documented as deferred in the IMPR-1 SUMMARY (test text still references DEBOUNCE_MS=500 but composable uses 150 since commit 22e393b). Recommend trivial follow-up to update test assertions.

- **Backfill migration for legacy rows** — documented as Option (a) in `edge_case_disposition`: pre-migration tool_calls default to `subagent_link_attempted = 0` and render as 'running' (with no pulse when `isActive=false`) until the next ingestion cycle naturally flips the flag. Fix-forward remediation recipe: "open any active Claude Code session" or "restart the app". Explicit follow-up available if users report UX papercuts from stale inactive conversations.

- **Live Tauri smoke test** — cargo check + vue-tsc + vitest cover the wiring; live behavior is guaranteed by IMPR-1's `tool_call:changed` precedent that this plan composes with. Not performed in automated pass per plan's "optional" marker.

## Threat Flags

None. This plan introduces a derived display-state flag on existing trust boundaries (DB column, read-only API projection, frontend classifier) — no new network endpoints, auth paths, file access patterns, or schema changes outside the explicitly-planned `tool_calls.subagent_link_attempted` column.

## Self-Check: PASSED

- FOUND: src-tauri/src/schema.sql (modified — line 39 new column)
- FOUND: src-tauri/src/db.rs (modified — migration block at lines 76-88)
- FOUND: src-tauri/src/ingestion/mod.rs (modified — UPDATE at lines 536-562)
- FOUND: src-tauri/src/conversations.rs (modified — struct line 181, SELECT+map lines 904-931)
- FOUND: packages/frontend/src/types/api.ts (modified — line 96 new field)
- FOUND: packages/frontend/src/utils/ghost-card-state.ts (created)
- FOUND: packages/frontend/tests/utils/ghost-card-state.test.ts (created)
- FOUND: packages/frontend/src/components/SubagentSummaryCard.vue (modified — four branches + null-safety)
- FOUND: packages/frontend/src/components/ToolCallRow.vue (modified — isActive prop)
- FOUND: packages/frontend/src/components/AssistantGroupCard.vue (modified — isActive prop)
- FOUND: packages/frontend/src/components/ConversationDetail.vue (modified — isActive prop)
- FOUND: packages/frontend/src/components/TrayConversationView.vue (modified — Rule 3 fix)
- FOUND: packages/frontend/src/pages/ConversationDetailPage.vue (modified — isActive source)
- FOUND: ff19f54 (Task 1 commit — schema + migration)
- FOUND: d37a377 (Task 2 commit — backend write + API projection)
- FOUND: 6c070fa (Sub-task 3a+3b+3c commit — types + classifier + tests)
- FOUND: a3e35dc (Sub-task 3d commit — prop chain + Rule 3 fix)
- FOUND: 8b362bc (Sub-task 3e+3f commit — render + null-safety)
