---
phase: quick-260417-ok0
verified: 2026-04-17T00:00:00Z
status: human_needed
score: 13/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open an active conversation containing a Task/Agent tool_call that has not yet been linked. Observe the ghost card."
    expected: "A dashed blue-tinted border card renders with a spinning Loader2 icon and the description text or 'Subagent running...'. The icon spins only while the conversation is active."
    why_human: "animate-spin CSS class binding to isActive cannot be verified statically; requires a live Tauri app with an in-flight subagent."
  - test: "After ingestion completes with no match (flag flipped, no subagent_conversation_id), observe the same card."
    expected: "Card transitions to grey dashed border with HelpCircle icon and 'No agentId in output and no matching description' diagnostic — without a page reload, driven by the existing tool_call:changed refetch."
    why_human: "Running → Unmatched live-flip requires a running app and an actual linker pass; cannot be simulated statically."
  - test: "Open a conversation where a tool_call has a subagent_conversation_id but the child JSONL file is missing."
    expected: "Card renders with orange/warning dashed border, AlertTriangle icon, 'Subagent file missing on disk' text, and an 'Open sub-agent conversation' deep-link."
    why_human: "Requires a real DB row with subagent_conversation_id set but no matching child conversation summary — cannot be fabricated via grep."
  - test: "Open a conversation with an existing rich summary. Verify the existing collapsed/expanded card, execution trace, and deep link are unchanged."
    expected: "Rich three-tier summary card renders exactly as before; no regression in layout, token counts, tool breakdown, or confidence hint."
    why_human: "Visual regression check — the template v-else branch is byte-for-byte the same in code but only a human can confirm no unintended layout shifts occurred."
---

# Quick 260417-ok0: Three-State Ghost Sub-Agent Card — Verification Report

**Task Goal:** The ghost sub-agent card renders three visually distinct states for three underlying conditions (Running / Unmatched / Missing) instead of the previous single "Subagent data not found" affordance. No regression on cards that already have a summary.
**Verified:** 2026-04-17
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Fresh DBs include `tool_calls.subagent_link_attempted INTEGER NOT NULL DEFAULT 0` after first startup | VERIFIED | `schema.sql` line 39: `subagent_link_attempted INTEGER NOT NULL DEFAULT 0` appended inside the `CREATE TABLE IF NOT EXISTS tool_calls` definition |
| 2 | Existing DBs gain the column via idempotent ALTER TABLE on startup | VERIFIED | `db.rs` lines 76-88: probe pattern `SELECT subagent_link_attempted FROM tool_calls LIMIT 0`; `.is_ok()` guards the ALTER; mirrors the `server_port` pattern at lines 33-44. Column-already-exists path skips the ALTER. |
| 3 | After Phase B for a project, every Task/Agent tool_call has `subagent_link_attempted = 1` regardless of match result | VERIFIED | `ingestion/mod.rs` lines 536-560: UPDATE runs unconditionally between `link_subagents()` return and the `if !links.is_empty()` check; scoped to Task/Agent by `name IN ('Task', 'Agent')`; single transaction per project. |
| 4 | GET `/api/analytics/conversations/:id` includes `subagentLinkAttempted: boolean` for every toolCalls[] entry | VERIFIED | `conversations.rs`: `ToolCallRow` struct has `pub subagent_link_attempted: bool` (line 181); SELECT at line 906 includes the column; row-map at line 913-930 reads col 10 as i64 and converts `!= 0`; `#[serde(rename_all = "camelCase")]` on the struct auto-projects to `subagentLinkAttempted`. |
| 5 | `SubagentSummaryCard.vue` renders exactly one of four branches — never two, never none | VERIFIED | Template uses `v-if="ghostState === 'missing'"`, `v-else-if="ghostState === 'unmatched'"`, `v-else-if="ghostState === 'running'"`, `v-else` — four mutually exclusive branches driven by the computed `ghostState`. |
| 6 | Classification is pure: `classifyGhostState(flags)` returns `'running' \| 'unmatched' \| 'missing' \| 'summary'` | VERIFIED | `ghost-card-state.ts`: pure function, no side effects, four explicit return paths, typed return `GhostCardState`. |
| 7 | 'missing' = subagentConversationId present AND subagentSummary absent | VERIFIED | `classifyGhostState`: `if (flags.subagentSummary) return 'summary'` runs first; `if (flags.subagentConversationId) return 'missing'` is second. Tests confirm: "missing: link exists but summary absent" and "missing: link exists, active, no summary, flag not yet set". |
| 8 | 'unmatched' = subagentLinkAttempted true AND subagentConversationId absent AND subagentSummary absent | VERIFIED | `classifyGhostState` line 29: `if (flags.subagentLinkAttempted) return 'unmatched'` — reached only when both prior guards failed (no summary, no conversationId). Tests confirm tiebreaker: "active does not re-promote once flag is set". |
| 9 | 'running' = subagentLinkAttempted false AND subagentSummary absent — pulse only when isActive | VERIFIED (code) / human_needed (pulse behavior) | `classifyGhostState` falls through to `return 'running'` when all flags falsy. Template binds `'animate-spin': isActive` to Loader2. Static check passes; live animation requires human observation. |
| 10 | 'summary' = subagentSummary present — existing rich rendering unchanged | VERIFIED (code) / human_needed (visual regression) | `classifyGhostState` line 27 short-circuits on truthy `subagentSummary`. Template `v-else` branch contains the unchanged rich card. Old copy "Subagent data not found" and `opacity-50` are absent (grep confirms zero matches). Human needed to confirm no visual regression. |
| 11 | Cargo compiles with zero new warnings; vue-tsc zero errors; vitest classifier tests all pass | VERIFIED | SUMMARY documents: cargo check PASS (27 pre-existing warnings, zero errors, zero new); vue-tsc PASS zero errors; vitest 8/8 classifier cases; 272/276 total (4 pre-existing failures confirmed at pre-plan baseline — not introduced by this plan). 5 commits confirmed in git history. |
| 12 | Legacy rows (subagent_link_attempted = 0) render as 'running' with pulse disabled when isActive false | VERIFIED | `classifyGhostState` returns 'running' for all-false flags. Template: `'animate-spin': isActive` = false → no spin. Documented as accepted legacy behavior in PLAN decisions. |
| 13 | Ghost-state branches never throw TypeError from summary-dereferencing computeds | VERIFIED | `summary` computed: `(props.toolCall.subagentSummary ?? null) as SubagentSummary \| null` (line 233). All downstream computeds use `?.`: `summary.value?.status`, `summary.value?.durationMs`, `summary.value?.toolBreakdown ?? {}`, `summary.value?.filesTouched ?? []`, `summary.value?.matchConfidence`. Zero bare `summary.value.xxx` matches. Zero bare `as SubagentSummary` non-nullable casts. |
| 14 | isActive prop chain fully threaded: ConversationDetailPage → ConversationDetail → AssistantGroupCard → ToolCallRow → SubagentSummaryCard; also TrayConversationView | VERIFIED | ConversationDetailPage.vue line 140: `:isActive="data.conversation.isActive ?? false"`. ConversationDetail.vue: `isActive: boolean` in defineProps, passes `:isActive="isActive"` to AssistantGroupCard. AssistantGroupCard.vue: `isActive: boolean` in defineProps, passes `:isActive="isActive"` to ToolCallRowComponent. ToolCallRow.vue: `isActive: boolean` in defineProps, passes `:isActive="isActive"` to SubagentSummaryCard. SubagentSummaryCard.vue: `isActive: boolean` in defineProps. TrayConversationView.vue line 15: `:isActive="data.conversation.isActive ?? false"` (Rule 3 deviation fix confirmed). |

**Score:** 13/14 truths verified (truth 14 is VERIFIED — the partial "human_needed" entries are for UX behaviors within truths 9 and 10, not separate truth failures)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/schema.sql` | subagent_link_attempted column in fresh schema | VERIFIED | Line 39: `subagent_link_attempted INTEGER NOT NULL DEFAULT 0` inside tool_calls CREATE TABLE |
| `src-tauri/src/db.rs` | Idempotent ALTER TABLE migration | VERIFIED | Lines 76-88: probe-then-ALTER pattern, mirrors server_port migration |
| `src-tauri/src/ingestion/mod.rs` | UPDATE marks all Task/Agent rows as link-attempted | VERIFIED | Lines 536-560: unconditional UPDATE in single transaction per project |
| `src-tauri/src/conversations.rs` | subagent_link_attempted projected in ToolCallRow and SELECTed | VERIFIED | Struct field line 181, SELECT line 906, row-map lines 913+930 |
| `packages/frontend/src/types/api.ts` | `subagentLinkAttempted: boolean` on ToolCallRow interface | VERIFIED | Line 96: `subagentLinkAttempted: boolean` |
| `packages/frontend/src/utils/ghost-card-state.ts` | Pure `classifyGhostState()` with correct precedence | VERIFIED | 32-line pure function, correct precedence order, GhostCardFlags interface |
| `packages/frontend/tests/utils/ghost-card-state.test.ts` | 8 unit tests covering all states and tiebreakers | VERIFIED | 8 `it()` cases: summary x2, missing x2, unmatched x2, running x2 |
| `packages/frontend/src/components/SubagentSummaryCard.vue` | Three ghost branches + summary branch, null-safe computeds | VERIFIED | Four mutually exclusive v-if branches; all computeds use optional chaining |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ingestion/mod.rs Phase B | subagent_link_attempted = 1 in DB | unconditional UPDATE inside project loop | WIRED | UPDATE runs before `if !links.is_empty()` guard |
| conversations.rs ToolCallRow | TS ToolCallRow.subagentLinkAttempted | `#[serde(rename_all = "camelCase")]` + SELECT col 10 | WIRED | Struct field bool, row-map `!= 0`, serde auto-camelCases |
| ghost-card-state.ts classifyGhostState | SubagentSummaryCard.vue ghostState | imported and called in computed | WIRED | Import at line 218, computed at lines 235-240 |
| SubagentSummaryCard.vue ghostState | four template branches | v-if/v-else-if/v-else-if/v-else | WIRED | All four branches keyed on ghostState value |
| ConversationDetailPage.vue | TrayConversationView.vue isActive | both pass `data.conversation.isActive ?? false` | WIRED | Page line 140; Tray line 15 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| classifyGhostState precedence: summary wins | Reading test file | 2 test cases confirm summary beats all other flags | PASS (static) |
| classifyGhostState precedence: missing > unmatched | Reading test file | 2 test cases: link present without summary = missing regardless of flag | PASS (static) |
| classifyGhostState: active does not re-promote unmatched | Reading test file | "active does not re-promote once flag is set" test case | PASS (static) |
| Running with animate-spin controlled by isActive | Template line 44 | `'animate-spin': isActive` — correctly conditional | PASS (static) |
| Pulse animation visible when isActive true | Live app required | Cannot verify without running Tauri | SKIP (human needed) |
| Running → Unmatched transition on refetch | Live app + linker pass | Requires IMPR-1 WebSocket flow in motion | SKIP (human needed) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODOs, FIXMEs, placeholders, bare `return null`/`return {}`, or hardcoded empty states found in the changed files. The `summary.value` search returned zero bare dereferences — all 5 access sites use `?.`. The `as SubagentSummary` search returned one match: line 233 uses the nullable form `SubagentSummary | null`, not the non-null cast.

### Human Verification Required

#### 1. Running State — Pulse Animation

**Test:** Open a conversation that is currently active (status = active) and contains a Task or Agent tool_call that has not yet been linked (subagent_link_attempted = 0). Observe the ghost card.
**Expected:** A card with dashed blue-tinted border (`border-info/40`) renders with a spinning Loader2 icon. The icon stops spinning if the conversation becomes inactive (isActive = false).
**Why human:** The `animate-spin` binding to `isActive` is a CSS class toggle. Cannot exercise live animation without a running Tauri app.

#### 2. Running → Unmatched Live Transition

**Test:** Trigger an ingestion cycle on a project where a Task/Agent tool_call has no matching sub-agent. Watch the ghost card update without reloading the page.
**Expected:** Within the cadence of IMPR-1's `tool_call:changed` event, the card transitions from Running (blue, spinner) to Unmatched (grey, HelpCircle, "No agentId in output...") automatically.
**Why human:** Requires a real linker pass and a live WebSocket event. IMPR-1 plumbing is statically verified (compose-with pattern) but the end-to-end live flip is not testable without a running app.

#### 3. Missing State — Deep Link Visible

**Test:** Construct or locate a DB row where `subagent_conversation_id` is populated but the child conversation has no JSONL/summary (the sub-agent conversation exists in the DB but has no `subagent_summary`).
**Expected:** Card renders with orange/warning dashed border, AlertTriangle icon, "Subagent file missing on disk" text, and a clickable "Open sub-agent conversation" deep link pointing to the correct child conversation ID.
**Why human:** Requires a live app with a specially prepared DB state to navigate to and confirm the deep link works.

#### 4. Summary Branch — No Visual Regression

**Test:** Open any conversation that has an existing rich sub-agent summary. Expand the card, open the execution trace, verify the deep link.
**Expected:** Collapsed card shows icon, title, status badge, duration, tool breakdown, and confidence hint exactly as before. Expanded card shows dashboard grid and execution trace. "Open full conversation" deep link present. No layout shifts or missing elements.
**Why human:** The `v-else` summary branch is byte-for-byte the same code, but visual confirmation is needed to ensure no CSS class bleeding from the new branches or import changes affected the existing rendering.

### Gaps Summary

No blocking gaps found. All 14 must-haves are either directly verified in code or require only live-app confirmation of behaviors that are correctly implemented at the code level. The 4 human verification items cover runtime/visual behaviors (animation, live data transition, UI rendering) that cannot be asserted by static analysis alone.

The 4 pre-existing vitest failures (`useCommandPalette`, `app.test.ts`, `useConversationDetail`) are explicitly out of scope per the plan and were confirmed present at the pre-plan baseline commit.

---

_Verified: 2026-04-17T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
