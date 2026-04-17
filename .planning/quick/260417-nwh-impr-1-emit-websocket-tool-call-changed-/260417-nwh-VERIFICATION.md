---
phase: quick-260417-nwh
verified: 2026-04-17T00:00:00Z
status: human_needed
score: 6/7
overrides_applied: 0
human_verification:
  - test: "Ghost card flip — manual smoke test"
    expected: "Open ConversationDetailPage.vue for a conversation actively spawning sub-agents. After ingestion picks up completed sub-agent JSONLs, the dashed-border 'Subagent data not found' ghost card should flip to the rich SubagentSummaryCard layout within ~1 second without any other page change."
    why_human: "Timing and visual rendering cannot be verified by static code inspection. Wiring is fully confirmed (backend emits -> type union -> listener -> debouncedRefetch). The ~1 second timing claim requires a live Tauri app with an active Claude Code sub-agent run."
---

# Quick 260417-nwh: Emit WebSocket tool_call:changed — Verification Report

**Task Goal:** After the change, when a sub-agent completes post-ingestion, the open `ConversationDetailPage.vue` replaces the "Subagent data not found" ghost card with the rich `SubagentSummaryCard` layout within ~1 second, without any unrelated change firing.

**Verified:** 2026-04-17T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Backend emits `tool_call:changed` with `{ conversationId, toolCallId }` after a successful `subagent_summary` UPDATE | VERIFIED | `mod.rs:591-601` — `match update_result { Ok(_) => { broadcast_event(state, "tool_call:changed", Some(json!({ "conversationId": parent_conv_id, "toolCallId": tool_call_id_for_event }))) } }` |
| 2 | Emitted `conversationId` is the PARENT conversation id (`link.parent_conversation_id`), not the sub-agent's own id | VERIFIED | `mod.rs:579` — `let parent_conv_id = link.parent_conversation_id.clone();` used in the payload. `link.tool_call_id` is stored separately as `tool_call_id_for_event`. |
| 3 | Open `ConversationDetailPage.vue` whose route id matches `evt.conversationId` refetches within ~1 second | WIRED (timing needs human) | `useConversationDetail.ts:136-140` — `on('tool_call:changed', (evt) => { if (evt.conversationId === conversationId) { debouncedRefetch(); } })`. The 150ms debounce mirrors `conversation:changed`. Timing implies ~150ms+network, well within 1s. Human smoke test needed to confirm visual flip. |
| 4 | Events for conversations OTHER than the currently-open one are ignored (no fetch fired) | VERIFIED | `useConversationDetail.ts:137` — `if (evt.conversationId === conversationId)` guard identical to `conversation:changed`. Test at line 369-384 of test file (`ignores tool_call:changed events for other conversations`) confirms zero fetches for `conv-OTHER`. |
| 5 | Existing behaviour preserved: per-file broadcast loop (~line 200), `system:full-refresh` stale-timer (~line 269), `conversation:changed` debounce, stale-conversation timer all unchanged | VERIFIED | `grep broadcast_event mod.rs` → 4 lines: line 23 (import), line 200 (per-file loop), line 269 (stale-timer), line 593 (new Phase B). No other call sites added. Phase A (`parent_conversation_id` UPDATE at ~406-444) and `subagent_conversation_id` UPDATE (~539-552) remain silent. |
| 6 | Type safety preserved: `ToolCallChangedEvent` is a first-class member of `WebSocketEvent` union; `on<T>` typed helper still sound | VERIFIED | `websocket-events.ts:46-52` — interface defined. `websocket-events.ts:54-59` — union includes `\| ToolCallChangedEvent`. `websocket-events.ts:88-90` — `isToolCallChanged` guard exported. `types/index.ts:7-8` — both type and guard re-exported. |
| 7 | Failure path preserved: broadcast does NOT fire on UPDATE failure; emission only on `Ok(_)` arm | VERIFIED | `mod.rs:591-608` — `match update_result { Ok(_) => { broadcast_event(…) } Err(e) => { eprintln!(…) } }`. The previous `.await.ok()` (which silently swallowed errors) is replaced by an explicit match; the `Err` arm logs but does not broadcast. |

**Score:** 6/7 truths fully verified by static analysis; truth #3 wiring is confirmed but the ~1 second visual flip requires a human smoke test.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/ingestion/mod.rs` | `tool_call:changed` broadcast after each successful `subagent_summary` UPDATE, gated on `Ok(_)` | VERIFIED | Lines 577-608: `parent_conv_id` captured before closure, `match update_result { Ok(_) => broadcast_event(…) }`. Exactly 1 occurrence of `"tool_call:changed"` in the file (line 595). |
| `packages/frontend/src/types/websocket-events.ts` | `ToolCallChangedEvent` type + `isToolCallChanged` guard, `'tool_call:changed'` literal in union | VERIFIED | Lines 46-52 (interface), 59 (union member), 69 (`WebSocketEventPayload` member), 88-90 (guard). All four additions present. |
| `packages/frontend/src/types/index.ts` | Re-exports `ToolCallChangedEvent` and `isToolCallChanged` | VERIFIED | Line 7 — type export includes `ToolCallChangedEvent`. Line 8 — value export includes `isToolCallChanged`. |
| `packages/frontend/src/composables/useConversationDetail.ts` | Listener on `'tool_call:changed'` guarded by `evt.conversationId === conversationId` | VERIFIED | Lines 134-140 — listener inserted between `conversation:changed` (line 128) and `system:full-refresh` (line 143) blocks, exactly as specified. Guard is present. |
| `packages/frontend/tests/composables/useConversationDetail.test.ts` | Two new test cases: match triggers refetch; mismatch does not | VERIFIED | Lines 348-367 (`refetches on tool_call:changed events for the matching conversation`) and lines 369-384 (`ignores tool_call:changed events for other conversations`). Both use correct `tool_call:changed` payloads with `toolCallId: 'tc-abc'` / `conv-OTHER`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `mod.rs` Phase B UPDATE `Ok(_)` arm | `broadcast_event(state, "tool_call:changed", …)` | `match update_result` | VERIFIED | `mod.rs:591-601` confirms broadcast is inside `Ok(_)` arm only |
| Payload `conversationId` | `link.parent_conversation_id` | `parent_conv_id` clone at line 579 | VERIFIED | Correct direction: parent, not sub-agent |
| `WebSocketEvent` union | `on<T>` typed helper accepting `'tool_call:changed'` | `ToolCallChangedEvent` in union at `websocket-events.ts:59` | VERIFIED | `WebSocketEventType` is derived as `WebSocketEvent['type']`; new literal is included |
| `on('tool_call:changed', …)` listener | `debouncedRefetch()` | `evt.conversationId === conversationId` guard | VERIFIED | `useConversationDetail.ts:136-140` |
| `conversation:changed` guard pattern | `tool_call:changed` listener | Mirror pattern | VERIFIED | Both use `if (evt.conversationId === conversationId) { debouncedRefetch(); }` — identical control flow |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `useConversationDetail.ts` | `data` (ConversationDetailResponse) | `doFetch(false)` → `fetch('/api/analytics/conversations/${conversationId}')` | Yes — backend DB query (pre-existing endpoint, unmodified) | FLOWING |

The `tool_call:changed` listener routes through `debouncedRefetch()` → `doFetch(false)` → the same fetch call used by `conversation:changed`. The backend endpoint is pre-existing and known to return real data. No new data path was introduced.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `tool_call:changed` in `mod.rs` is exactly one occurrence | `grep -c "tool_call:changed" src-tauri/src/ingestion/mod.rs` | 1 | PASS |
| Broadcast call site count in `mod.rs` | `grep -n "broadcast_event" src-tauri/src/ingestion/mod.rs` | 4 lines: import (23), per-file loop (200), stale-timer (269), Phase B (593) | PASS |
| Phase A UPDATE (~406-444) has no broadcast | Lines 406-444 read directly | No `broadcast_event` present | PASS |
| `subagent_conversation_id` UPDATE (~539-552) has no broadcast | Lines 539-552 read directly | No `broadcast_event` present | PASS |
| New test cases exist in test file | Lines 348-384 | Two `it(…)` blocks with `tool_call:changed` events | PASS |
| Listener position in `useConversationDetail.ts` | Lines 134-140 | Between `conversation:changed` (128-132) and `system:full-refresh` (143) blocks | PASS |
| Ghost card flips to SubagentSummaryCard within ~1 second | Runtime smoke test required | Not testable statically | SKIP — route to human |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| IMPR-1 | Backend emits `tool_call:changed` after successful `subagent_summary` UPDATE; frontend refetches open parent detail | SATISFIED | All five modified files implement the three-layer chain: backend emit → frontend type → frontend listener |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `useConversationDetail.test.ts` | 93 | Test title says "500ms" but DEBOUNCE_MS is 150 and timer advances use 400ms/200ms | Info (pre-existing) | Pre-existing failure unrelated to IMPR-1. The two new `tool_call:changed` tests use 200ms advances (correct for 150ms debounce). No impact on IMPR-1 verification. |

No blockers found. The pre-existing `debounces conversation:changed events by 500ms` test title mismatch is noted per task instructions as out-of-scope.

---

### Human Verification Required

#### 1. Ghost card flip — manual smoke test

**Test:** With a Tauri app running, open `ConversationDetailPage.vue` for a conversation that has recently spawned a sub-agent whose JSONL is not yet fully ingested (or stage one for testing). Trigger ingestion (manually or via the watch cycle). Observe the sub-agent tool call card.

**Expected:** The dashed-border "Subagent data not found" ghost card is replaced by the rich `SubagentSummaryCard` layout within approximately 1 second of the sub-agent JSONL being picked up — no `system:full-refresh` and no manual page reload required.

**Why human:** Static code analysis confirms the full wiring chain: backend UPDATE succeeds → `broadcast_event("tool_call:changed", { conversationId: parentId, toolCallId })` fires → frontend receives via WebSocket → `on('tool_call:changed', …)` listener checks `evt.conversationId === conversationId` → `debouncedRefetch()` → `doFetch(false)` → `ConversationDetailPage.vue` re-renders. However, the ~1 second timing bound and the visual transition from ghost card to `SubagentSummaryCard` require a live runtime to confirm. The existing `conversation:changed` precedent makes this behaviour highly likely, but the smoke test is the only way to confirm end-to-end.

---

### Gaps Summary

No blocking gaps found. All seven must-have truths are either fully verified by static analysis (6/7) or have their wiring fully confirmed with only a runtime timing check remaining (1/7, routed to human). The implementation exactly matches the plan specification with zero deviations.

The single human verification item (ghost card flip timing) is a runtime concern — the underlying code path is fully wired. Once the smoke test confirms the visual behaviour, this task can be marked fully passed.

---

_Verified: 2026-04-17T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
