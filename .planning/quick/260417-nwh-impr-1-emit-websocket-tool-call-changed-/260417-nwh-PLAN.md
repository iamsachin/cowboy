---
phase: quick-260417-nwh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/ingestion/mod.rs
  - packages/frontend/src/types/websocket-events.ts
  - packages/frontend/src/composables/useConversationDetail.ts
autonomous: true
requirements:
  - IMPR-1

must_haves:
  truths:
    - "After `summarize_subagent` UPDATE of `tool_calls.subagent_summary` completes, the backend emits a WebSocket event of type `tool_call:changed` carrying `{ conversationId, toolCallId }`."
    - "The emitted event payload's `conversationId` equals the PARENT conversation's id (parent_conversation_id on the SubagentLink), not the sub-agent's conversation id."
    - "An open `ConversationDetailPage.vue` whose route id matches `evt.conversationId` refetches its detail (via the existing `doFetch(false)` path used by `conversation:changed`) within ~1 second of the event arriving."
    - "Events for conversations OTHER than the currently-open one are ignored (no fetch fired) — matches the existing `conversation:changed` guard pattern."
    - "Existing behaviour preserved: per-file `broadcast_event` calls at mod.rs:197-203 still fire, `system:full-refresh` still works, `conversation:changed` still triggers the debounced refetch, stale-conversation timer still broadcasts `system:full-refresh`."
    - "Type safety preserved: every consumer of `WebSocketEvent` (and the discriminated `on<T>(type, cb)` helper in useWebSocket.ts) continues to compile; the new event is a first-class member of the `WebSocketEvent` union."
    - "Failure path preserved: if the UPDATE fails (`.ok()` at mod.rs:589 swallows the error today), the broadcast MUST NOT fire. Emission only happens on a successful UPDATE."
  artifacts:
    - path: "src-tauri/src/ingestion/mod.rs"
      provides: "tool_call:changed broadcast after each successful subagent_summary UPDATE"
      contains: "broadcast_event"
      location: "inside Phase B loop in link_subagents_post_processing, ~lines 579-589, gated on UPDATE success"
    - path: "packages/frontend/src/types/websocket-events.ts"
      provides: "ToolCallChangedEvent type + isToolCallChanged type guard"
      exports: ["ToolCallChangedEvent", "isToolCallChanged"]
      contains: "'tool_call:changed'"
    - path: "packages/frontend/src/types/index.ts"
      provides: "Re-export of the new event type and guard so existing consumers can import from 'types'"
      exports: ["ToolCallChangedEvent", "isToolCallChanged"]
    - path: "packages/frontend/src/composables/useConversationDetail.ts"
      provides: "Listener on 'tool_call:changed' that triggers debouncedRefetch when evt.conversationId === conversationId"
      contains: "on('tool_call:changed'"
    - path: "packages/frontend/tests/composables/useConversationDetail.test.ts"
      provides: "Test proving a tool_call:changed event on the matching conversation triggers a refetch, and is ignored for non-matching conversations"
      contains: "tool_call:changed"
  key_links:
    - from: "FINDINGS.md §1.5"
      to: "src-tauri/src/ingestion/mod.rs:387-604"
      via: "Documents zero `broadcast_event` calls inside `link_subagents_post_processing` — this plan closes that gap."
    - from: "FINDINGS.md §4.5a"
      to: "src-tauri/src/ingestion/mod.rs:550-600"
      via: "Identifies the exact site where the event should be emitted after the summary UPDATE."
    - from: "FINDINGS.md §5 IMPROVEMENT-1"
      to: "this plan"
      via: "Derived scope — backend emit + frontend type + frontend handler, P0, no schema change."
    - from: "src-tauri/src/ingestion/mod.rs:197-203"
      to: "src-tauri/src/ingestion/mod.rs:~585 (new)"
      via: "Emission pattern template: `broadcast_event(state, event_type, Some(event.clone()))`."
    - from: "packages/frontend/src/composables/useWebSocket.ts:126-136"
      to: "packages/frontend/src/composables/useConversationDetail.ts (new listener)"
      via: "Typed `on<T>(type, cb)` is the registration path; the new type must appear in the `WebSocketEvent` union or the `on('tool_call:changed', …)` call will not type-check."
    - from: "packages/frontend/src/composables/useConversationDetail.ts:128-132"
      to: "packages/frontend/src/composables/useConversationDetail.ts (new listener)"
      via: "Reuse of the existing `conversation:changed` guard-and-debounce pattern; mirror it for tool_call:changed."
---

<objective>
Close the live-UX regression documented in FINDINGS.md §1.5 and §4.5a: the subagent linker currently UPDATEs `tool_calls.subagent_summary` without emitting any WebSocket event, leaving open `ConversationDetailPage.vue` views showing the "Subagent data not found" ghost card until an unrelated change triggers `system:full-refresh`.

This plan wires a single, scoped, typed event — `tool_call:changed` — from the backend UPDATE site at `src-tauri/src/ingestion/mod.rs:~585` through a new frontend union member in `types/websocket-events.ts` to a listener in `useConversationDetail.ts`. The listener reuses the existing debounced refetch path (same as `conversation:changed`), so the ghost card flips to the rich `SubagentSummaryCard` within ~1 second of link completion, with no fetch triggered for unrelated conversations.

Purpose: fix the discovery problem in FINDINGS.md §5 IMPROVEMENT-1 (P0 priority, S size, no schema change, no new DB column — IMPR-7 explicitly out of scope).

Output: Three atomic file edits plus one new test case, with a clean compile + passing frontend tests as verification.
</objective>

<execution_context>
@/Users/sachin/Desktop/learn/cowboy/.claude/get-shit-done/workflows/execute-plan.md
@/Users/sachin/Desktop/learn/cowboy/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260417-mg3-use-research-skill-and-go-through-deeply/FINDINGS.md
@src-tauri/src/ingestion/mod.rs
@src-tauri/src/websocket.rs
@packages/frontend/src/types/websocket-events.ts
@packages/frontend/src/types/index.ts
@packages/frontend/src/composables/useConversationDetail.ts
@packages/frontend/src/composables/useWebSocket.ts
@packages/frontend/tests/composables/useConversationDetail.test.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase so no exploration is required. -->

From src-tauri/src/websocket.rs:22-38 (the broadcast function):
```rust
/// Broadcasts a typed event to all connected WebSocket clients via the broadcast channel.
/// Automatically adds `seq` and `timestamp` fields.
pub fn broadcast_event(state: &AppState, event_type: &str, extra: Option<serde_json::Value>) {
    // Injects { type, seq, timestamp } and merges any extra fields at the top level.
}
```

From src-tauri/src/ingestion/mod.rs:197-203 (the emission pattern template):
```rust
// Emit events immediately per-file for lower latency
for event in &events {
    if let Some(event_type) = event.get("type").and_then(|t| t.as_str()) {
        broadcast_event(state, event_type, Some(event.clone()));
    }
}
```
Note: for tool_call:changed we use the simpler form: `broadcast_event(state, "tool_call:changed", Some(json!({ "conversationId": ..., "toolCallId": ... })))`.

From src-tauri/src/ingestion/mod.rs:577-589 (the exact UPDATE site to wrap):
```rust
let tc_id = link.tool_call_id.clone();
let summary_str = summary_json.to_string();
state
    .db
    .call(move |conn| {
        conn.execute(
            "UPDATE tool_calls SET subagent_summary = ?1 WHERE id = ?2",
            rusqlite::params![summary_str, tc_id],
        )?;
        Ok::<_, tokio_rusqlite::Error>(())
    })
    .await
    .ok();
```
IMPORTANT: the `.ok()` discards errors. The broadcast must only fire on success. Replace `.ok()` with a match on `Ok(_)` that emits after success.

From src-tauri/src/ingestion/subagent_linker.rs (already in scope via use statements):
```rust
pub struct SubagentLink {
    pub tool_call_id: String,
    pub subagent_conversation_id: String,
    pub parent_conversation_id: String,
    pub match_confidence: MatchConfidence,
}
```
The `link` variable in the Phase B loop IS a `SubagentLink`, so `link.parent_conversation_id` and `link.tool_call_id` are the exact fields to emit.

From packages/frontend/src/types/websocket-events.ts (union shape to extend):
```typescript
export interface ConversationChangedEvent {
  type: 'conversation:changed';
  seq: number;
  conversationId: string;
  changes: ChangeType[];
  timestamp: string;
}
export type WebSocketEvent =
  | ConversationChangedEvent
  | ConversationCreatedEvent
  | SystemFullRefreshEvent
  | SettingsChangedEvent;
// All event variants have { type, seq, timestamp }; the new one adds { conversationId, toolCallId }.
```

From packages/frontend/src/composables/useWebSocket.ts:126-136 (type-safe registration path):
```typescript
type EventCallback<T extends WebSocketEventType> = (
  event: Extract<WebSocketEvent, { type: T }>
) => void;
function on<T extends WebSocketEventType>(type: T, callback: EventCallback<T>): () => void
```
The new `'tool_call:changed'` string literal MUST appear in `WebSocketEventType` (which is derived from `WebSocketEvent['type']`) or `on('tool_call:changed', …)` will fail compile.

From packages/frontend/src/composables/useConversationDetail.ts:127-132 (listener pattern to mirror):
```typescript
const { on } = useWebSocket();
on('conversation:changed', (evt) => {
  if (evt.conversationId === conversationId) {
    debouncedRefetch();
  }
});
```
The new listener sits next to this one and uses the identical shape.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Emit `tool_call:changed` after each successful `subagent_summary` UPDATE (backend)</name>
  <files>src-tauri/src/ingestion/mod.rs</files>
  <behavior>
    - After `UPDATE tool_calls SET subagent_summary = ?1 WHERE id = ?2` succeeds, `broadcast_event(state, "tool_call:changed", Some(json!({ "conversationId": link.parent_conversation_id, "toolCallId": link.tool_call_id })))` is called exactly once per link.
    - On UPDATE failure (the `tokio_rusqlite::Error` path), NO broadcast is emitted.
    - Per-file `broadcast_event` calls at ~lines 197-203 remain unchanged.
    - No other `broadcast_event` calls are added elsewhere in `link_subagents_post_processing` (Phase A filesystem linking and the `UPDATE tool_calls SET subagent_conversation_id` step stay silent — out of scope for this task; see IMPR-7 in FINDINGS.md §5).
  </behavior>
  <action>
    Modify `src-tauri/src/ingestion/mod.rs` inside the Phase B loop of `link_subagents_post_processing` (function body at lines 387-604). Target is the inner async DB call at **lines 577-589** that UPDATEs `subagent_summary`.

    Concrete edit:
    1. Locate the block that starts with `let tc_id = link.tool_call_id.clone();` (line 577) and ends with `.await.ok();` (line 589).
    2. Capture the values needed for the broadcast BEFORE the `state.db.call(move |conn| { … })` closure, because that closure moves its captures:
       - `let parent_conv_id = link.parent_conversation_id.clone();`
       - `let tool_call_id_for_event = link.tool_call_id.clone();`
       (Do NOT use `tc_id` directly after the `.call(move …)` — it is moved into the closure.)
    3. Replace the terminal `.await.ok();` with a proper match so the broadcast only fires on success. Example shape (keep whitespace consistent with the surrounding code):
       ```rust
       let update_result = state
           .db
           .call(move |conn| {
               conn.execute(
                   "UPDATE tool_calls SET subagent_summary = ?1 WHERE id = ?2",
                   rusqlite::params![summary_str, tc_id],
               )?;
               Ok::<_, tokio_rusqlite::Error>(())
           })
           .await;
       match update_result {
           Ok(_) => {
               crate::websocket::broadcast_event(
                   state,
                   "tool_call:changed",
                   Some(serde_json::json!({
                       "conversationId": parent_conv_id,
                       "toolCallId": tool_call_id_for_event,
                   })),
               );
           }
           Err(e) => {
               eprintln!(
                   "Error updating subagent_summary for {}: {}",
                   tool_call_id_for_event, e
               );
           }
       }
       ```
    4. Verify imports: `serde_json::json!` is already used in this file (line 565-575) and `broadcast_event` is callable via `crate::websocket::broadcast_event` (see stale-timer at line 269 for the same qualified call pattern). No new `use` statements needed.
    5. Do NOT add a broadcast inside the Phase A (parent_conversation_id) block at lines 406-445. Do NOT add a broadcast around the `UPDATE tool_calls SET subagent_conversation_id` at lines 539-552. Scope is strictly the `subagent_summary` write, per FINDINGS.md §4.5a.
    6. Do NOT change the function signature, the outer loop structure, or the error handling of other statements.

    Rationale: `link.parent_conversation_id` is the PARENT's conversation id — this is what open detail pages key on. Emitting the sub-agent's own conversation id instead would miss the open parent view and defeat the purpose. See FINDINGS.md §1.6 on the back-pointer direction.
  </action>
  <verify>
    <automated>cd /Users/sachin/Desktop/learn/cowboy && cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -30</automated>
    Also run: `cd /Users/sachin/Desktop/learn/cowboy && cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20` to confirm release-quality build. Grep must succeed: `grep -n "tool_call:changed" src-tauri/src/ingestion/mod.rs` returns exactly one line inside `link_subagents_post_processing`.
  </verify>
  <done>
    - `cargo check` passes with zero NEW warnings (the 10 pre-existing warnings from STATE.md Blockers are acceptable).
    - Exactly one occurrence of the string `tool_call:changed` exists in `src-tauri/src/ingestion/mod.rs`.
    - The broadcast is inside the `Ok(_)` arm of the update result (NOT unconditional).
    - Phase A and the `subagent_conversation_id` UPDATE remain without broadcast calls.
    - No other file in `src-tauri/` was modified.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add `ToolCallChangedEvent` to the frontend WebSocket event union</name>
  <files>packages/frontend/src/types/websocket-events.ts, packages/frontend/src/types/index.ts</files>
  <behavior>
    - `WebSocketEvent` union gains a new member `ToolCallChangedEvent`.
    - `WebSocketEventType` (derived via `WebSocketEvent['type']`) now includes the string literal `'tool_call:changed'`.
    - `isToolCallChanged(e): e is ToolCallChangedEvent` type guard is exported.
    - `WebSocketEventPayload` distributive-Omit chain gains the new variant (without `seq`) so existing callers constructing payloads by hand still type-check.
    - `types/index.ts` re-exports both the type and the guard so existing callers who import from `'../types'` work without touching their import paths.
  </behavior>
  <action>
    Edit `packages/frontend/src/types/websocket-events.ts`:
    1. After the existing `SettingsChangedEvent` interface (after line 44), add:
       ```typescript
       export interface ToolCallChangedEvent {
         type: 'tool_call:changed';
         seq: number;
         conversationId: string;
         toolCallId: string;
         timestamp: string;
       }
       ```
    2. Extend the `WebSocketEvent` union (currently at lines 46-50) to include `| ToolCallChangedEvent`. Maintain alphabetical/grouped order consistent with the existing list.
    3. Extend `WebSocketEventPayload` (currently at lines 55-59) to include `| Omit<ToolCallChangedEvent, 'seq'>`.
    4. After the existing `isSettingsChanged` guard (line 74-76), add:
       ```typescript
       export function isToolCallChanged(e: WebSocketEvent): e is ToolCallChangedEvent {
         return e.type === 'tool_call:changed';
       }
       ```

    Edit `packages/frontend/src/types/index.ts`:
    5. The line that currently re-exports types from `websocket-events`:
       ```typescript
       export type { ChangeType, ConversationChangedEvent, ConversationCreatedEvent, SystemFullRefreshEvent, SettingsChangedEvent, WebSocketEvent, WebSocketEventType, WebSocketEventPayload } from './websocket-events';
       ```
       Add `ToolCallChangedEvent` to that list.
    6. The line that re-exports the guard functions:
       ```typescript
       export { isConversationChanged, isConversationCreated, isSystemFullRefresh, isSettingsChanged } from './websocket-events';
       ```
       Add `isToolCallChanged` to that list.

    Do NOT rename or reorder existing members. Do NOT tighten or loosen `WebSocketEvent` elsewhere. Do NOT add `changes: ChangeType[]` — that field is specific to `conversation:changed` and not used here (the detail composable refetches the whole detail via the same path — scoping the refetch to "only toolCalls" was discussed in the task scope but the existing composable only exposes whole-detail refetch; see Task 3 rationale).
  </action>
  <verify>
    <automated>cd /Users/sachin/Desktop/learn/cowboy/packages/frontend && npx vue-tsc --noEmit 2>&1 | tail -30</automated>
    Also run: `cd /Users/sachin/Desktop/learn/cowboy/packages/frontend && grep -n "tool_call:changed\|ToolCallChangedEvent\|isToolCallChanged" src/types/websocket-events.ts src/types/index.ts` — should show the added interface, union member, guard, and both re-exports.
  </verify>
  <done>
    - `vue-tsc --noEmit` (full frontend typecheck) passes with zero new errors.
    - `ToolCallChangedEvent` is a member of `WebSocketEvent` (grep confirms the union line contains it).
    - `isToolCallChanged` is exported from both `websocket-events.ts` and re-exported from `types/index.ts`.
    - No other frontend file modified in this task.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Handle `tool_call:changed` in `useConversationDetail` + test</name>
  <files>packages/frontend/src/composables/useConversationDetail.ts, packages/frontend/tests/composables/useConversationDetail.test.ts</files>
  <behavior>
    - When a `tool_call:changed` event arrives whose `conversationId` equals the composable's `conversationId` argument, `debouncedRefetch()` is called — identical control flow to the existing `conversation:changed` handler.
    - When the event's `conversationId` does NOT match, NO refetch happens (no fetch call, no debounce timer scheduled).
    - The event listener composes with the existing listeners: `conversation:changed`, `system:full-refresh`. Adding tool_call:changed does not change how those behave.
    - Unit tests in `useConversationDetail.test.ts` prove both the match and mismatch cases using the existing `fireEvent` harness.
  </behavior>
  <action>
    Edit `packages/frontend/src/composables/useConversationDetail.ts`:
    1. Inside `useConversationDetail(conversationId: string)`, after the existing `on('conversation:changed', …)` block at lines 128-132, and before the `on('system:full-refresh', …)` block at line 135, insert:
       ```typescript
       // Sub-agent summaries land on tool_calls via the post-processing linker.
       // Emitted from src-tauri/src/ingestion/mod.rs after UPDATE of subagent_summary.
       on('tool_call:changed', (evt) => {
         if (evt.conversationId === conversationId) {
           debouncedRefetch();
         }
       });
       ```
    2. Do not change the `debouncedRefetch` body, the `doFetch` body, the `DEBOUNCE_MS` constant, or any other behaviour. The refetch intentionally re-fetches the full `ConversationDetailResponse` because:
       - The existing backend endpoint `/api/analytics/conversations/:id` returns the full detail; no "toolCalls-only" endpoint exists.
       - `conversation:changed` already uses this same full refetch; matching that pattern keeps both events composable and idempotent.
       - The 150ms debounce already coalesces bursts, so a swarm of N parallel sub-agents completing simultaneously triggers at most one refetch.
       (This is an intentional, documented departure from the task_scope note "ideally by re-running the existing detail fetch" — we reuse the same `debouncedRefetch`. That satisfies the "avoid triggering broader system:full-refresh" requirement.)
    3. No other edits in this file.

    Edit `packages/frontend/tests/composables/useConversationDetail.test.ts`:
    4. Use the existing `fireEvent(type, payload)` harness and `fetchSpy` already set up at lines 13-15 and 63-68.
    5. Add a new `describe` block (or two `it` blocks inside the existing outer describe) that cover:
       - **Match case:** Create composable for `conv-1`; advance past initial fetch (drain promises + flush timers like other tests do — inspect sibling tests for the exact pattern, e.g. `await flushPromises()` / `vi.advanceTimersByTime(…)` / `await vi.runAllTimersAsync()`). Reset `fetchSpy.mockClear()`. Fire `fireEvent('tool_call:changed', { type: 'tool_call:changed', seq: 1, conversationId: 'conv-1', toolCallId: 'tc-abc', timestamp: '2026-04-17T00:00:00Z' })`. Advance timers past 150ms. Assert `fetchSpy` was called once with the detail URL.
       - **Mismatch case:** Same setup, but fire with `conversationId: 'conv-OTHER'`. Assert `fetchSpy` was NOT called after the initial load (no additional fetches).
    6. Follow the existing test file's patterns for promise flushing and timer advancement verbatim — copy from the closest-matching test for `conversation:changed` if it exists, or model on the `system:full-refresh` test if not. Do not introduce new helpers.
  </action>
  <verify>
    <automated>cd /Users/sachin/Desktop/learn/cowboy/packages/frontend && npx vitest run tests/composables/useConversationDetail.test.ts 2>&1 | tail -30</automated>
    Also run full typecheck: `cd /Users/sachin/Desktop/learn/cowboy/packages/frontend && npx vue-tsc --noEmit 2>&1 | tail -20`. Grep confirms listener exists: `grep -n "tool_call:changed" src/composables/useConversationDetail.ts` returns one match inside `useConversationDetail`.
  </verify>
  <done>
    - `vitest run tests/composables/useConversationDetail.test.ts` passes all tests, including the two new cases (match + mismatch).
    - `vue-tsc --noEmit` passes with zero new errors.
    - New listener sits between `conversation:changed` and `system:full-refresh` blocks, is correctly scoped to `evt.conversationId === conversationId`.
    - No other composable or component file was modified.
  </done>
</task>

</tasks>

<verification>
Full-repo verification after all three tasks ship:

1. **Backend compile:** `cargo check --manifest-path src-tauri/Cargo.toml` — zero new warnings or errors.
2. **Frontend typecheck:** `cd packages/frontend && npx vue-tsc --noEmit` — zero new errors.
3. **Frontend tests:** `cd packages/frontend && npx vitest run` — all tests pass; new tests in `useConversationDetail.test.ts` prove the match + mismatch behaviour.
4. **Lint (if present):** `cd packages/frontend && npx eslint src/types/websocket-events.ts src/composables/useConversationDetail.ts` — no new errors.
5. **String presence checks:**
   - `grep -n "tool_call:changed" src-tauri/src/ingestion/mod.rs` → 1 match (inside Phase B success arm)
   - `grep -n "tool_call:changed" packages/frontend/src/types/websocket-events.ts` → ≥1 match (the interface literal + the guard)
   - `grep -n "tool_call:changed" packages/frontend/src/composables/useConversationDetail.ts` → 1 match (the `on('tool_call:changed', …)` call)
6. **Negative check:** `grep -rn "broadcast_event" src-tauri/src/ingestion/mod.rs` — should show exactly 2 call sites: the existing per-file loop at ~line 200 and the new one in Phase B. NO calls in Phase A (parent_conversation_id) and NO call around the `subagent_conversation_id` UPDATE — those are IMPR-7 territory.
7. **Manual smoke test (user, from task_scope goal):** Open `ConversationDetailPage.vue` for a conversation that is actively spawning sub-agents. Trigger ingestion (or simply wait for the normal watch cycle to pick up completed sub-agent JSONLs). Confirm the dashed-border "Subagent data not found" ghost card flips to the rich `SubagentSummaryCard` layout within ~1 second without any other page change.
</verification>

<success_criteria>
- IMPROVEMENT-1 from FINDINGS.md §5 is closed: completing sub-agents now emit `tool_call:changed`; open parent detail views refresh live.
- Zero schema changes (no ALTER TABLE, no new columns — IMPR-7 explicitly deferred).
- Zero new `broadcast_event` call sites beyond the single one added in Phase B.
- Frontend type safety maintained: `WebSocketEvent` union complete, typed `on<T>` still sound.
- Existing `conversation:changed`, `system:full-refresh`, and `settings:changed` flows untouched.
- New tests in `useConversationDetail.test.ts` lock in the match/mismatch semantics and will catch regressions.
- No unrelated files changed. Commit message should reference IMPR-1 and FINDINGS.md §1.5 / §4.5a.
</success_criteria>

<output>
After completion, create `.planning/quick/260417-nwh-impr-1-emit-websocket-tool-call-changed-/260417-nwh-SUMMARY.md` with:
- Three commits listed (one per task) with their hashes.
- Before/after snippet of the Phase B loop showing the added broadcast site.
- Confirmation that the manual smoke test in `<verification>` step 7 passed.
- Any deviations from this plan (there should be none — the plan is fully specified).
</output>
