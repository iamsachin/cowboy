# Sub-Agent Discovery & Display — Research Findings (260417-mg3)

**Quick task:** 260417-mg3
**Date:** 2026-04-17
**Status:** Research complete; no production code changes.

All claims are grounded in direct source reads (not inferences). Research skill methodology was applied: three angles (backend identification, frontend display, prior art) prosecuted in parallel by reading all referenced files, then synthesized.

---

## 1. Identification Pipeline

A sub-agent begins life as a **Task** or **Agent** tool_use block inside a parent JSONL, and ends life as a child `conversations` row plus a JSON blob persisted on the parent's `tool_calls.subagent_summary` column. The pipeline is four phases long, runs post-ingestion, and degrades gracefully through three confidence levels.

### 1.1 Pipeline diagram

```
~/.claude/projects/<slug>/*.jsonl
  ├── <parentSessionId>.jsonl       (parent conversation)
  └── <agentSessionId>.jsonl        (one per sub-agent invocation)
                │
                ▼
  file_discovery::discover_jsonl_files()
     → Vec<DiscoveredFile> { file_path, project_dir, is_subagent,
       session_id, parent_session_id }.  is_subagent set from on-disk layout.
     src-tauri/src/ingestion/file_discovery.rs
                │
                ▼
  run_ingestion  (ingestion/mod.rs:107-239)
     For each file → process_claude_code_file() →
     parse_jsonl_file_incremental() → normalize_conversation() → DB insert.
     Every tool_use block (Task, Agent, Read, Edit, …) lands in tool_calls
     with input/output JSON.
                │
                ▼ (all files ingested)
  link_subagents_post_processing  (ingestion/mod.rs:387-604)

   Phase A — filesystem link  (mod.rs:397-445)
     parent_session_id → UPDATE conversations
       SET parent_conversation_id = <parentConvId> WHERE id = <subConvId>

   Phase B — tool-call link   (mod.rs:448-601)
     Per project group, call subagent_linker::link_subagents()
                │
                ▼
  subagent_linker::link_subagents  (subagent_linker.rs:70-251)
     Phase 1 HIGH   — regex /agentId:\s*([a-f0-9]+)/ on tool_result output
                      exact sessionId match               (linker:112-149)
     Phase 2 MEDIUM — input.description (or input.prompt) first line ==
                      sub-agent first user-message first line  (linker:151-213)
     Phase 3 LOW    — timestamp-ordered positional pairing    (linker:215-247)
     Filter: "acompact-*" session_ids excluded               (linker:84-88)
                │
                ▼
  DB writes  (ingestion/mod.rs:536-600)
     UPDATE tool_calls SET subagent_conversation_id = ?
     UPDATE tool_calls SET subagent_summary = <json blob>
     Blob produced by summarize_subagent() (subagent_summarizer.rs:39-130):
       toolBreakdown, filesTouched, totalToolCalls, status, durationMs,
       inputTokens, outputTokens, lastError, matchConfidence (injected at
       serialization site, mod.rs:574 — NOT produced by summarizer itself).
```

### 1.2 Key structures and shapes

- **`DiscoveredFile`** (`src-tauri/src/ingestion/types.rs:162-169`): `{ file_path, project_dir, is_subagent, session_id, parent_session_id }`. The discoverer already knows whether a JSONL is a sub-agent, and which file spawned it, before the linker runs. The linker then refines the mapping from *file-level* to *tool-call-level* granularity.
- **`ToolCallInfo`** (`subagent_linker.rs:24-31`): `{ id, name, input: serde_json::Value, output: Option<String>, created_at }`.
- **`SubagentLink`** (`subagent_linker.rs:33-39`): `{ tool_call_id, subagent_conversation_id, parent_conversation_id, match_confidence }`. `MatchConfidence` is `High | Medium | Low` (`subagent_linker.rs:41-56`).
- **`SubagentSummary`** (`subagent_summarizer.rs:9-19`): persisted into `tool_calls.subagent_summary`. Mirrored on the frontend as `SubagentSummary` in `packages/frontend/src/types/api.ts:3-13`.
- **`SubagentStatus`** (`subagent_summarizer.rs:21-36`): `success | error | interrupted`. Computed from the *last* tool_result `is_error` flag and the final assistant `stop_reason` (`subagent_summarizer.rs:66-83`). No assistant messages at all → `interrupted`.
- **DB columns** on `tool_calls`: `subagent_conversation_id TEXT NULL`, `subagent_summary TEXT NULL` (JSON blob). Fetched by the detail query at `src-tauri/src/conversations.rs:905` (`SELECT id, …, subagent_conversation_id, subagent_summary FROM tool_calls WHERE conversation_id = ?`).

### 1.3 The three-phase algorithm in detail

This is the decision codified in PROJECT.md Key Decisions table (line 180) — "Three-phase subagent matching (agentId → description → position)".

| Phase | Confidence | Signal | Where | Failure → |
|-------|-----------|--------|-------|-----------|
| 1 | **High** | Tool-result text contains `agentId: <hex>` matching a sub-agent session_id | `subagent_linker.rs:112-149` | Phase 2 |
| 2 | **Medium** | `input.description` (fallback `input.prompt`) first line exactly equals sub-agent's first user-message first line (or the latter starts with the former) | `subagent_linker.rs:151-213` | Phase 3 |
| 3 | **Low** | Timestamp-sorted positional pairing of any tool_call and sub-agent left unmatched in the same project | `subagent_linker.rs:215-247` | Orphaned (no link) |

Each phase mutates two dedup sets — `matched_tool_call_ids` and `matched_subagent_session_ids` (`subagent_linker.rs:97-98`) — so a tool call or file is linked only once, and higher-confidence phases win. Phase 2 is skipped entirely if the caller passes `None` for `get_first_user_message` (verified by `phase3_positional_low_confidence` test at `subagent_linker.rs:369-411`).

### 1.4 Summary generation

`summarize_subagent` (`subagent_summarizer.rs:39-130`) parses the sub-agent's JSONL again to build the JSON blob:

- **`tool_breakdown`**: `HashMap<String, u32>` — count per tool name across all assistant messages (`subagent_summarizer.rs:40-63`).
- **`files_touched`**: `HashSet<String>` of distinct `file_path` / `path` / `filePath` values from tool_use inputs (`subagent_summarizer.rs:42, 51-60`).
- **`status`**: Error requires that the *last* tool_result be `is_error=true`, not just any error in the trace (`subagent_summarizer.rs:66-83`). Interrupted fires when there are no assistant messages or `stop_reason != "end_turn"`.
- **`duration_ms`**: last timestamp − first timestamp via `chrono::DateTime::parse_from_rfc3339` (`subagent_summarizer.rs:85-104`).
- **`input_tokens` / `output_tokens`**: summed across all assistant usage blocks (`subagent_summarizer.rs:106-114`).
- **`last_error`**: `content` of the most recent errored tool_result (`subagent_summarizer.rs:116-118`).
- **`matchConfidence`** is injected at the serialization site in `ingestion/mod.rs:574`, not produced by `summarize_subagent`.

### 1.5 Known failure modes and edge cases

- **Unmatched sub-agents.** A sub-agent whose session_id appears in no `agentId:` output, whose first message matches no description, and which has no unmatched peer to position-pair with, will have its `parent_conversation_id` set (via Phase A, if `parent_session_id` was known) but **no `tool_calls.subagent_conversation_id` back-link**. The parent conversation renders a "Subagent data not found" ghost card (`SubagentSummaryCard.vue:1-11`).
- **Background compaction agents.** Files with `acompact-*` session IDs are filtered out of the matching pool (`subagent_linker.rs:84-88` + test at `subagent_linker.rs:413-456`). They exist as conversations but never attach to a Task tool_call.
- **Streaming / mid-flight.** While a sub-agent is still running, its JSONL is incomplete and the linker runs only after full ingestion of the current batch (`ingestion/mod.rs:214-217`). The in-progress tool_call has no `subagent_summary` and renders as the ghost card. Per-file `broadcast_event` calls fire at `ingestion/mod.rs:197-203`, but the **subagent-link UPDATEs inside `link_subagents_post_processing` do NOT emit a WebSocket event** — confirmed by inspecting `ingestion/mod.rs:387-604`: zero `broadcast_event` calls. The UI does not refresh cards until another conversation-level change triggers `system:full-refresh`. This is observable (see Section 4.5).
- **Ambiguous description match.** If two sibling sub-agents both start with "Fix the login bug" (same description), Phase 2 links the first pair it encounters; the second falls through to Phase 3. No ambiguity detection or warning.
- **Input mutation across retries.** Because `matched_tool_call_ids` is rebuilt each run and `UPDATE tool_calls` overwrites unconditionally (`ingestion/mod.rs:543-547`), the latest state wins.
- **Low-confidence banner.** Frontend warns only on Low matches ("matched by position — may be inaccurate", `SubagentSummaryCard.vue:263-268`); Medium shows "matched by description"; High is silent.

### 1.6 Back-pointer direction — two redundant but independently populated links

1. `conversations.parent_conversation_id` — set by Phase A filesystem linking (`ingestion/mod.rs:432-438`). Drives the expandable child rows in the browser/overview tables (`ConversationBrowser.vue:174-183`, `ConversationTable.vue:170-185`) and the "Parent: …" back-link in the detail header (`ConversationDetailPage.vue:40-48`).
2. `tool_calls.subagent_conversation_id` — set by Phase B tool-call matching (`ingestion/mod.rs:539-552`). Drives the "Open full conversation" link inside a sub-agent card (`SubagentSummaryCard.vue:158-165`) and the timeline-event jump target.

The two are redundant on happy paths but can diverge: a sub-agent may have a filesystem-inferred `parent_conversation_id` (Phase A) without having a `subagent_conversation_id` on any of the parent's tool calls (Phase B found no match).

---

## 2. Display Pipeline

### 2.1 From API response to rendered card

```
GET /api/analytics/conversations/:id
  └─ src-tauri/src/conversations.rs::conversation_detail (~L855)
     ConversationDetailResponse with toolCalls[] including
     { subagentConversationId, subagentSummary }
              │
              ▼
  useConversationDetail(id)  composable
              │
              ▼
  ConversationDetailPage.vue
    ├── header bar (title, project, agent badge, tokens, cost,
    │    parent back-link if parentConversationId)
    ├── ConversationDetail
    │     └── useGroupedTurns()  → GroupedTurn[]
    │         ├── UserTurn / AssistantGroup / SystemGroup / …
    │         └── AgentPromptTurn (user-role msgs that are the
    │              replayed Task prompt, detected via
    │              useGroupedTurns.ts:134-142, 294-300)
    │     └── AssistantGroupCard
    │         └── ToolCallRow  (per tool_use)
    │             └── if name ∈ {Task, Agent}:
    │                 SubagentSummaryCard   (ToolCallRow.vue:2-3, 78-80)
    │             else:
    │                 tool-viewers (Edit/Read/Write/Bash/JSON)
    └── ConversationTimeline  (right-side panel)
         └── extractTimelineEvents(turns)
             → user / assistant-group / subagent / compaction events
             (useTimeline.ts:17-81)
```

### 2.2 The SubagentSummaryCard component tree

**Path:** `packages/frontend/src/components/SubagentSummaryCard.vue` (318 lines, single component).
**Props:** `toolCall: ToolCallRow`. No emits.
**Local state:** `expanded`, `showTrace`, `loadingDetail`, `subagentToolCalls`, plus a module-scoped `fetched` flag to make the detail fetch fire exactly once per card instance.

Three-tier layout:

| Tier | Anchor | Always visible? | Contents |
|------|--------|-----------------|----------|
| 0 — Ghost | `SubagentSummaryCard.vue:2-11` | When `!toolCall.subagentSummary` | Dashed border, "Subagent data not found". Rendered for unmatched or mid-flight sub-agents. No link to child. |
| 1 — Collapsed | `SubagentSummaryCard.vue:20-56` | Default | Chevron, Bot icon, title (`input.description` → truncated `input.prompt` → "Subagent task", `:225-234`), status badge (`:194-202`), status icon, duration, tool breakdown line, last error line, confidence hint |
| 2 — Expanded dashboard | `SubagentSummaryCard.vue:59-92` | On chevron click | 2-column grid: Type, Model, Duration, Status, Input/Output tokens, Files touched (count + first five) |
| 3 — Execution Trace | `SubagentSummaryCard.vue:94-155` | On trace toggle | BaseExpandableItem; lazy-loaded sub-agent tool_call list via `fetch(/api/analytics/conversations/<subagentConvId>)` at `:281-295` |
| 3b — Trace fallback | `SubagentSummaryCard.vue:139-154` | When fetch fails or returns empty | Iterate `summary.toolBreakdown` and show `name ×N` lines |
| 4 — Deep link | `SubagentSummaryCard.vue:157-166` | When `subagentConversationId` exists | `<router-link>` "Open full conversation" with ExternalLink icon |

Visual cues:
- Error state uses `border-l-4 border-l-error bg-error/5`; success uses `border-l-info bg-info/5` (`:204-208`).
- Type badge: `Task → badge-info`, `Agent → badge-warning` (`:215-217`).
- `.tooltip` on `lastError` shows the full error on hover (`:45-50`).
- Duration formatting: `<1s → "NNNms"`, `<60s → "NNs"`, else `"Mm Ss"` (`:236-244`).

### 2.3 Where sub-agents surface, by UI surface

| Surface | File | Sub-agent representation | Discovery affordances |
|---------|------|--------------------------|-----------------------|
| **Conversation detail — inline** | `SubagentSummaryCard.vue` via `ToolCallRow.vue:2-3` | Rich three-tier card per Task/Agent tool call | Expand chevron, execution trace, deep link to child, confidence hint, error badge |
| **Conversation detail — timeline sidebar** | `ConversationTimeline.vue:58-62`, events from `useTimeline.ts:44-66` | Indented `Workflow` icon line with description and `· N tools` suffix | Click scrolls parent assistant group into view, then to the specific tool_call via `data-tool-call-id` (`ConversationDetailPage.vue:310-317`) |
| **Conversation list (`/conversations` page)** | `ConversationBrowser.vue:100-148`, rendered via `displayRows` at `:224-239` | Sub-agents appear as **indented child rows** beneath their parent. Bot icon + `pl-8` indent (`:117-121`). Agent and Project cells blank for children (quick-69). | User sees parent + children together. Cannot filter to "only sub-agents"; search finds them but displayed as child rows. |
| **Overview table (same shape)** | `ConversationTable.vue:40-109` | Identical child-row pattern. Agent badge and project text conditionally hidden via `v-if="!row._isChild"` (`:78-79`, quick-69). | Same as list — child rows, no sub-agent-only filter. |
| **Tray panel — list** | `TrayPanelPage.vue:98-109` | **Hidden.** Explicit filter: `rows.filter((r) => !r.parentConversationId)` (`TrayPanelPage.vue:105`). Primary conversations only. | None. Sub-agents invisible in the tray. |
| **Tray panel — detail** | `TrayConversationView.vue` (referenced at `TrayPanelPage.vue:48`) | Reduced view; not inspected in depth in this pass. | Not a sub-agent discovery surface. |
| **Overview dashboard** | `OverviewPage.vue` + widgets like `TopConversationsWidget.vue` | **No sub-agent-specific widget.** Child token rollup exists in list/overview tables (`_childrenTokens`) but not dashboard stat widgets. | None at the dashboard level. |
| **Search / command palette** | Search embedded in `ConversationBrowser.vue:29-49` (server `q=`). No command palette. | Search hits return sub-agent content as child rows. `subagent_summary` JSON is not indexed by FTS. | Very limited. |

### 2.4 User journey: parent → child

1. Land on `/conversations/:parentId` (`ConversationDetailPage.vue`).
2. Scroll to an assistant turn that invoked `Task`.
3. `ToolCallRow.vue:78-80` checks `isSubagentCall` → renders `SubagentSummaryCard` instead of a generic tool row. Standard I/O `<details>` skipped entirely.
4. See collapsed card: title, status, duration, tool mix.
5. Click card → Level 1 expansion: metadata dashboard.
6. Click "Execution Trace" → `SubagentSummaryCard.vue:281-295` fetches `/api/analytics/conversations/<subagentConvId>` and renders the nested list.
7. Click "Open full conversation" → router navigates to `/conversations/<subagentConvId>`. `App.vue`'s `:key="$route.fullPath"` (quick-32) forces remount.
8. On the child page, `ConversationDetailPage.vue:40-48` renders `ArrowUpLeft "Parent: <title>"` back-link.

**Parallel path — timeline sidebar:** click a sub-agent event (`ConversationTimeline.vue:7-34`) → `handleTimelineNavigate` (`ConversationDetailPage.vue:290-321`) → `expandGroup(groupKey)` → scrolls to `[data-tool-call-id="<tc.id>"]`. This is in-page, not a route change, and is the quickest way to scan for sub-agents.

### 2.5 Parallel sub-agent rendering (quick-75 postmortem)

Quick-75's actual subject was fixing `useScrollTracker` late-binding (its SUMMARY title drifted from the directory name). Parallel sub-agents are displayed through the same pipeline with no special grouping. Multiple `Task` tool_calls inside one assistant message → one `AssistantGroupCard` with N `SubagentSummaryCard` instances stacked vertically (`useGroupedTurns.ts:218-237` — tool_calls held flatly on `AssistantTurn`, no sibling clustering). Timeline sidebar likewise shows N separate `subagent` events under one `assistant-group` event (`useTimeline.ts:44-66`). **No visual cue that these N cards are siblings executed in parallel** — user must infer from timestamps.

### 2.6 State representation by sub-agent lifecycle

| Lifecycle state | Data condition | Rendered by |
|-----------------|----------------|-------------|
| Running (file growing, no link yet) | `subagentSummary` null | Ghost card ("Subagent data not found", `SubagentSummaryCard.vue:2-11`). No deep link. |
| Complete — High confidence | `matchConfidence === 'high'`, `status ∈ {success, error, interrupted}` | Full card, no confidence hint (`:263-268`) |
| Complete — Medium confidence | `matchConfidence === 'medium'` | Full card + italic "matched by description" |
| Complete — Low confidence | `matchConfidence === 'low'` | Full card + italic "matched by position — may be inaccurate" |
| Errored | `status === 'error'` | Red left border, red status badge, `AlertCircle`, `lastError` row with tooltip |
| Interrupted | `status === 'interrupted'` | Same red treatment as error (via `isError` at `:194-196`) |
| Unmatched (link failed entirely) | `subagentSummary` null AND no `subagentConversationId` | Same ghost card as Running — **indistinguishable from running** |

The last row is a notable UX gap: the same affordance is used for "still running" and "permanently unmatched". See Section 4.1.

---

## 3. Prior Art & Known Gaps

### 3.1 Decisions and inheritance from claude-devtools (quick-28, quick-30)

| Topic | claude-devtools approach | Cowboy approach | Status |
|-------|--------------------------|-----------------|--------|
| Subagent card decomposition | `SubagentItem` + `MetricsPill` + `ExecutionTrace` (quick-30 SUMMARY §2) — three components, two-level expansion | Single `SubagentSummaryCard.vue` with two-level expansion (quick-31) | **Adopted partially** |
| Multi-phase context breakdown | Phase 1/2/3 peak-token breakdown when spanning compaction (quick-30 §2 lines 126-137) | Not implemented | **Gap — P2** |
| Main-vs-isolated token attribution | Separate "Main Context impact" (parent-side spawn cost) from "Subagent Context" (isolated usage) (quick-30 §2 lines 122-125) | Only sub-agent's own `inputTokens`/`outputTokens` shown | **Gap — P1** |
| Team-member color coding | Distinct color per team member, propagated through badges/left borders (quick-30 §2 lines 128-133) | Only `Task` vs `Agent` type colorization | **Gap — P2** |
| Reply-link spotlight | Hovering reply badge dims unrelated items to 20% opacity (quick-30 §3 lines 141-172) | Not implemented | **Gap — P2** |
| Last-output pattern | Always-visible final output block (quick-28 SUMMARY #2, quick-30 §1) | Not applied to sub-agents | **Gap — P1** |
| Notification color propagation | Trigger colors thread through UI (quick-30 §9) | Not implemented | Nice-to-have |
| Virtualization | `@tanstack/react-virtual`, 120+ items (quick-28 #10) | Pagination only | Deferred by quick-28 author |

### 3.2 Cowboy-local decisions (PROJECT.md)

- **`SubagentSummary` as JSON column on `tool_calls`** (`.planning/PROJECT.md:179`): chosen for 1:1 simplicity, avoids extra table/join. **Consequence:** not queryable with SQL (e.g., "top conversations by total sub-agent duration" requires JSON extraction). Rated "Good (v2.0)".
- **Three-phase sub-agent matching** (`.planning/PROJECT.md:180`): graceful degradation via confidence levels. Rated "Good (v2.0)". Surfaces as hints at `SubagentSummaryCard.vue:263-268`.

### 3.3 Previously-rejected or out-of-scope ideas

- **Virtualization of the conversation view** (quick-28 #10): deferred because pagination is simpler to maintain. Caps cards-per-page.
- **`@path` mention badges** (quick-28 #9, quick-30 §5): requires IPC validation; rejected. Side effect: sub-agent descriptions with `@path` show as plain text.
- **Multi-tab session viewing** (quick-30 §7): future architecture, not implemented.

### 3.4 Open issues / papercuts traceable across summaries

1. **"Open full conversation" link was broken** — quick-32 SUMMARY. Root cause: `ConversationDetailPage.vue` captured `route.params.id` once at setup. Fix: `:key="$route.fullPath"` on `<RouterView />` in `App.vue`. **Fixed.**
2. **Subagent rows showing redundant agent/project columns** — quick-69. Fixed by `v-if="!row._isChild"` on `AgentBadge` and project cell (`ConversationTable.vue:78-79`). Same pattern in `ConversationBrowser.vue:136-138`.
3. **`useScrollTracker` late-binding bug** — quick-75. Fixed by `watch(containerRef, …, { immediate: true })`. Indirect sub-agent impact: before the fix, new sub-agent tool_calls during streaming didn't auto-scroll.
4. **Sub-agent summary refresh does not emit a WebSocket event** — **new finding surfaced by this task** (§1.5). When an ingestion pass completes post-processing, `subagent_summary` and `subagent_conversation_id` updates happen *after* per-file `broadcast_event` calls. Open `ConversationDetailPage` won't refresh its cards until another change triggers `system:full-refresh`. Evidence: `ingestion/mod.rs:387-604` — zero `broadcast_event` calls inside `link_subagents_post_processing`.
5. **Tray panel actively hides sub-agents** — `TrayPanelPage.vue:105`. Deliberate (noise reduction) but cuts off an entire surface.
6. **Parallel sub-agents lack sibling grouping** (§2.5).
7. **Unmatched sub-agents indistinguishable from running ones** (§2.6).
8. **Sub-agent summary JSON invisible to FTS search** — SQLite FTS does not index JSON columns by default and no trigger exists to index `subagent_summary`. "Failed Bash" won't find a sub-agent whose only error was a Bash failure unless sub-agent messages themselves contain the text.

### 3.5 Prior tasks touching sub-agents

| # | Date | One-liner | Impact on discovery |
|---|------|-----------|---------------------|
| 28 | 2026-03-28 | Research claude-devtools conversation display | Identified 10 gaps incl. "richer subagent cards" |
| 30 | 2026-03-28 | Deep source-level analysis of claude-devtools | Mapped SubagentItem + MetricsPill + ExecutionTrace + multi-phase breakdown |
| 31 | 2026-03-28 | Implement token popover, expandable item, subagent dashboard | Shipped current two-level `SubagentSummaryCard` |
| 32 | 2026-03-28 | Fix "Open full conversation" link | `:key="$route.fullPath"` — deep link now functions |
| 69 | 2026-04-04 | Hide agent/project for subagent rows | Cosmetic cleanup of list/overview child-row display |
| 75 | 2026-04-06 | Fix useScrollTracker late-binding | Indirect — live-update scroll fix |

---

## 4. Gap Analysis

Organised by surface. Each gap cites the file that would need to change and contrasts current observed behavior with ideal behavior. No fixes proposed here — those live in Section 5.

### 4.1 Conversation detail — inline

- **Gap 4.1a — No conversation-level "sub-agent" summary.** The detail page header (`ConversationDetailPage.vue:51-128`) lists Project/Agent/Model/Date/Duration/Tokens/Cost but never surfaces "3 sub-agents spawned (2 success, 1 error)". A user must scroll the whole turn list to learn whether sub-agents even exist. Ideal: a single-line counter chip near the header, with a click-to-jump affordance to the first sub-agent card. **File to change:** `ConversationDetailPage.vue` header bar.
- **Gap 4.1b — Timeline sidebar gives no state cue on subagent events.** `ConversationTimeline.vue:58-62` uses the same `Workflow` icon colour (`text-info`) regardless of success/error/running. A failed sub-agent looks identical to a successful one in the sidebar. **File to change:** `ConversationTimeline.vue:58-76` (`iconConfig`, `labelClass`).
- **Gap 4.1c — Unmatched sub-agents share the "running" ghost card.** `SubagentSummaryCard.vue:2-11` renders the same dashed-border affordance for both "file still appending" (transient) and "linker found no match" (permanent). Ideal: a permanent-unmatched ghost should offer a diagnostic hint ("no agentId in output and no matching description") and a link to the sub-agent conversation if a filesystem-level parent link exists. **File:** `SubagentSummaryCard.vue:2-11`.
- **Gap 4.1d — No "jump to next sub-agent" keyboard shortcut.** Users with many sub-agents must scroll. `ConversationDetailPage.vue` handles keyboard nav but has no explicit sub-agent stepper. **File:** `ConversationDetailPage.vue` + potentially a new composable `useSubagentStepper.ts`.
- **Gap 4.1e — Execution Trace fetch is silently lossy.** `SubagentSummaryCard.vue:281-295` swallows errors. On 404 or slow network the card falls back to `toolBreakdown` entries with no indication that the rich trace failed to load. **File:** `SubagentSummaryCard.vue:281-295`.

### 4.2 Conversation list, browser, and tray

- **Gap 4.2a — No "sub-agent only" filter in `ConversationBrowser.vue`.** Filters are `agent`, `project`, `searchQuery` (`ConversationBrowser.vue:4-49`). Sub-agent rows appear only as children of their parents. Cannot surface "all sub-agents that errored this week". **File:** `ConversationBrowser.vue`, `useConversationBrowser.ts`, and the backend query in `conversations.rs` (likely add a `?only=subagents` or `?kind=subagent` param).
- **Gap 4.2b — No per-parent sub-agent count indicator in the list.** The parent row shows total tokens and a `+_childrenTokens` hint (`ConversationBrowser.vue:145-146`) but no count of sub-agents. Ideal: `3 sub-agents` pill next to the title cell. **File:** `ConversationBrowser.vue:107-130`, plus backend child-count aggregation in `conversations.rs:467-575` (already fetches children — just needs `.len()`).
- **Gap 4.2c — Tray completely hides sub-agents.** `TrayPanelPage.vue:105`. Currently deliberate, but a user who just saw a parallel sub-agent swarm in their session cannot peek from the tray. Ideal: show count-only chip on the parent row. **File:** `TrayPanelPage.vue:95-109`.
- **Gap 4.2d — Search snippet does not surface the sub-agent that matched.** `ConversationBrowser.vue:124-129` shows a `snippet` highlight on the row, but if the hit came from a sub-agent, the parent row is returned with no indication of *which* sub-agent contained the hit. **File:** backend search in `conversations.rs` and browser render at `ConversationBrowser.vue:122-131`.

### 4.3 Overview / dashboard

- **Gap 4.3a — No aggregate sub-agent widget.** `TopConversationsWidget.vue` exists (surfaced in file listing) but there is no "most sub-agent-heavy conversations this week", "sub-agent success rate", or "average sub-agent duration by description". **Files:** a new widget under `packages/frontend/src/components/` + a backend `GET /api/analytics/subagents/overview` in `src-tauri/src/conversations.rs` or a new `subagents.rs` module.
- **Gap 4.3b — Dashboard stat widgets do not attribute cost to sub-agents.** `OverviewStats` (`types/api.ts:21-37`) has `estimatedCost`, `totalTokens`, etc., but no way to ask "of the $X spent this week, how much was sub-agents?". **File:** backend overview query + new API field.
- **Gap 4.3c — No "top tools used by sub-agents" breakdown.** `ToolStatsChart.vue` / `ToolStatsTable.vue` exist for top-level tool stats but are not faceted by "in a sub-agent" vs "in a main conversation". **File:** `conversations.rs` tool-stats handler + frontend widgets.

### 4.4 Search / command palette

- **Gap 4.4a — No command palette at all.** Search is embedded in the browser page. No Cmd+K. Users cannot "go to sub-agent #3 of current conversation". **Files:** new `components/CommandPalette.vue` + a global `useCommandPalette` composable.
- **Gap 4.4b — `subagent_summary` JSON not in FTS index.** A user searching for "Permission denied" will not find a sub-agent whose only error was that string, unless the string also appears in the sub-agent's messages. **File:** ingestion-time FTS-trigger wiring, wherever the FTS virtual table is created (likely `src-tauri/src/ingestion/migration.rs` or a schema-setup module).
- **Gap 4.4c — Cannot search by sub-agent description.** The title of a sub-agent (`input.description`) lives inside `tool_calls.input` JSON and is not FTS-indexed. **File:** same as 4.4b.

### 4.5 Streaming / live updates

- **Gap 4.5a — Sub-agent card does not update mid-flight.** §1.5 confirmed no `broadcast_event` inside `link_subagents_post_processing` (`ingestion/mod.rs:387-604`). When a sub-agent completes, an open detail page shows the ghost card until another event forces a refetch. **File:** `ingestion/mod.rs:550-600` — should emit `tool_call:changed` or similar after UPDATE.
- **Gap 4.5b — No "running" shimmer on the inline card.** `SubagentSummaryCard.vue:2-11` is static; there is no pulse/shimmer to signal live activity. Parent conversations have `pulse-dot` for active (`ConversationDetailPage.vue:53`), but no cue propagates to the sub-agent card. **File:** `SubagentSummaryCard.vue:2-11`.
- **Gap 4.5c — Timeline sidebar icon does not pulse for in-flight sub-agents.** `ConversationTimeline.vue:80-87` has a `pulse-icon` class but it's gated on `isActive && idx === events.length - 1` — the *last* event of an *active* conversation. A still-running sub-agent in the *middle* of the timeline has no pulse. **File:** `ConversationTimeline.vue:21-26`.

### 4.6 Parallel execution

- **Gap 4.6a — Parallel sub-agents lack visual sibling grouping.** §2.5. N cards stack vertically; no shared "parallel batch" boundary, no "fan-out" indicator in the timeline. **Files:** `useGroupedTurns.ts` (extend `AssistantGroup` to detect parallel Task calls — they share the same `message.id`), `SubagentSummaryCard.vue` (could render in a flex-wrap grid when siblings), `useTimeline.ts:44-66` (could emit a single "parallel batch" synthetic event).
- **Gap 4.6b — No "running X of N" aggregate during live parallel swarms.** User seeing 5 sub-agents fan out has no aggregate progress indicator. **File:** new component or extension to `AssistantGroupCard.vue`.

### 4.7 Cost / token attribution

- **Gap 4.7a — SubagentSummaryCard shows raw token counts, not cost.** The dashboard grid at `SubagentSummaryCard.vue:62-92` lists input/output tokens but not `$` cost. Given Cowboy already has `MODEL_PRICING` / `calculateCost` in `packages/frontend/src/types/pricing.ts`, this is a formatting-only miss. **File:** `SubagentSummaryCard.vue:78-83`.
- **Gap 4.7b — No "spawn cost" attribution (parent-side) vs "sub-agent cost" (isolated).** See §3.1 — claude-devtools shows both. A Task call itself consumes parent-context tokens before the sub-agent even starts; those tokens are currently invisible in the card. **File:** `SubagentSummaryCard.vue` + potentially a new `ingestion/mod.rs` field in the summary blob (`mainSessionImpactTokens`).
- **Gap 4.7c — Child-rollup token figures in the list (`_childrenTokens` at `ConversationBrowser.vue:228-230`) are token-only, not cost-only.** Reading "125k (+340k)" does not directly map to "$4.20 spent on sub-agents". **File:** `ConversationBrowser.vue` + `ConversationTable.vue` child columns.

---

## 5. Prioritised Improvement Backlog

Ten ranked proposals. Priority rubric from the plan: **P0** = high impact, small-to-medium effort, no schema changes; **P1** = high impact requiring schema/ingestion changes, or medium impact + small effort; **P2** = polish or large effort/medium impact.

### IMPROVEMENT-1: Emit WebSocket event after sub-agent linking completes
**Discovery problem solved:** Live sub-agent cards stay as ghost placeholders until an unrelated change forces a refetch.
**User outcome:** Running a parallel Task swarm, the user sees ghost cards flip to rich summary cards within a second of each sub-agent completing, without touching anything.
**Affected files:** `src-tauri/src/ingestion/mod.rs` (add `broadcast_event` after `UPDATE tool_calls SET subagent_summary` at `ingestion/mod.rs:584`), `packages/frontend/src/composables/useConversationDetail.ts` (handle the new event type), `packages/frontend/src/types/websocket-events.ts` (new `tool_call:changed` event).
**Approach sketch:** After each `summarize_subagent` UPDATE (`mod.rs:582-589`), call `broadcast_event(state, "tool_call:changed", Some(json!({ "conversationId": link.parent_conversation_id, "toolCallId": link.tool_call_id })))`. Frontend listens and invalidates the relevant conversation detail cache, re-fetching only the `toolCalls` portion. Avoids expensive full-conversation refetches.
**Size:** S (one backend call site, one frontend listener).
**Priority:** **P0** — fixes a genuine live-UX regression documented in §1.5 and §4.5a; no schema change; minimal risk.
**Dependencies / risks:** None. Safer than the existing `system:full-refresh` pattern because it's scoped.

### IMPROVEMENT-2: Sub-agent overview strip at top of ConversationDetailPage
**Discovery problem solved:** Users cannot tell at a glance whether a conversation used sub-agents, how many, or whether any failed — without scrolling the entire turn list.
**User outcome:** A chip row at the top of the detail page reads `3 sub-agents · 2 ✓ 1 ✗`, and each chip jumps to the corresponding `SubagentSummaryCard` on click.
**Affected files:** `packages/frontend/src/pages/ConversationDetailPage.vue` (header bar around `:51-128`), `packages/frontend/src/components/SubagentOverviewStrip.vue` (new), `packages/frontend/src/composables/useSubagentList.ts` (new composable that derives a `[{tc_id, status, description}]` list from `toolCalls`).
**Approach sketch:** Derive the list from `data.value.toolCalls.filter(tc => tc.name === 'Task' || tc.name === 'Agent')`. Render coloured chips by `subagentSummary.status`. Click emits `scroll-to-tool-call` handled in `ConversationDetailPage.vue` using the same mechanism as the timeline sidebar (`data-tool-call-id` selector at `:312`).
**Size:** S-M.
**Priority:** **P0** — high discovery impact, purely frontend, reuses existing scroll infrastructure.
**Dependencies / risks:** None. Visual interplay with the existing header bar (width pressure) will need a responsive collapse pattern.

### IMPROVEMENT-3: Sub-agent status-aware timeline icons + pulse-during-running
**Discovery problem solved:** Timeline sidebar does not distinguish sub-agent lifecycle state; a failed sub-agent looks identical to a successful one (§4.1b, §4.5c).
**User outcome:** In the timeline sidebar, a successful sub-agent shows a green `CheckCircle`, a failed one a red `XCircle`, a still-running one a pulsing `Workflow` icon. A user scanning the sidebar instantly spots failures.
**Affected files:** `packages/frontend/src/components/ConversationTimeline.vue` (modify `iconConfig` at `:52-63`, modify pulse gate at `:21-26`), `packages/frontend/src/composables/useTimeline.ts` (extend `TimelineEvent` with an optional `status` field and populate at `:44-66`).
**Approach sketch:** When emitting a subagent event (`useTimeline.ts:57-63`), pull `tc.subagentSummary?.status` and `tc.subagentConversationId` into the event. Switch on status for icon and colour. Pulse when `status` is missing *and* the conversation is active.
**Size:** S.
**Priority:** **P0** — pure frontend, fits neatly on top of existing composables.
**Dependencies / risks:** None.

### IMPROVEMENT-4: Inline cost + confidence badges on the collapsed sub-agent card
**Discovery problem solved:** Cost is missing from the card entirely (§4.7a); cost is only visible inside Level 1 dashboard after expansion, and even then as raw tokens.
**User outcome:** Collapsed card reads `Fix login bug · 47s · 12 tools · $0.08 · high`. User can scan a conversation and rank sub-agents by cost without expanding any card.
**Affected files:** `packages/frontend/src/components/SubagentSummaryCard.vue` (add cost computation using `MODEL_PRICING` from `types/pricing.ts:1` and display near duration at `:22-35`), `packages/frontend/src/utils/format-tokens.ts` (reuse `formatCost`).
**Approach sketch:** Compute cost from `summary.inputTokens + summary.outputTokens` against the parent conversation's `model`. Show in the row 1 strip. Show confidence as a subtle tertiary badge (not noisy — coloured dot only).
**Size:** S.
**Priority:** **P0** — frontend only, high scan-value, reuses existing pricing table.
**Dependencies / risks:** Pricing accuracy hinges on matching the correct model; if the sub-agent uses a different model than its parent (which it can) we must consult the sub-agent's own model via an extra field on `SubagentSummary`. Initial implementation can default to parent model and add a follow-up to include `subagentModel`.

### IMPROVEMENT-5: "Sub-agent only" facet in ConversationBrowser
**Discovery problem solved:** Cannot filter the browser to only sub-agent conversations (§4.2a). Current UX buries sub-agents as child rows under parents.
**User outcome:** A `Kind: [All | Primary | Sub-agents]` select above the table. Flipping to Sub-agents returns a flat, paged list of every sub-agent conversation with columns for parent title, description, duration, status, cost.
**Affected files:** `packages/frontend/src/components/ConversationBrowser.vue` (add the select at `:3-50`), `packages/frontend/src/composables/useConversationBrowser.ts` (pass a new `kind` parameter), `src-tauri/src/conversations.rs` (extend the list endpoint around `:243-460` to accept `kind=subagent` and filter with `parent_conversation_id IS NOT NULL`).
**Approach sketch:** Query-level filter using the existing `parent_conversation_id` column; join to parent conversation for title. Because child rows already exist in the list today (just nested under parents), reusing the same SQL with a flattened projection is straightforward.
**Size:** M (backend + frontend + types).
**Priority:** **P1** — high impact, requires API-shape extension (new param) but no schema migration.
**Dependencies / risks:** Must re-evaluate sort-order semantics when viewing sub-agents flat (sort by parent_date vs subagent_date). Low risk otherwise.

### IMPROVEMENT-6: Index `tool_calls.subagent_summary` content into FTS
**Discovery problem solved:** Searching for "Permission denied" or "fix the login bug" (a sub-agent description) finds nothing in the main search because `subagent_summary` JSON is not FTS-indexed (§4.4b, §4.4c, §3.4 #8).
**User outcome:** Typing any word that appears in a sub-agent's description, files touched, or last_error into the browser search surfaces the *parent* conversation with a snippet showing which sub-agent matched.
**Affected files:** `src-tauri/src/ingestion/migration.rs` (or wherever the FTS virtual table is created — likely in the schema setup), `src-tauri/src/ingestion/mod.rs:582-589` (trigger FTS update on summary write), `src-tauri/src/conversations.rs` (search handler — adjust snippet extraction to mention the sub-agent origin).
**Approach sketch:** Add a text-projection trigger that concatenates `description || prompt || last_error || toolBreakdown keys` whenever `subagent_summary` is written, and mirror that string into the existing FTS table with a synthetic `kind='subagent'` column. Search results can then surface `"matched in sub-agent: Fix login bug"` in the snippet.
**Size:** M.
**Priority:** **P1** — high impact on real search usefulness; needs schema change (FTS trigger).
**Dependencies / risks:** Re-indexing cost on first run can be large; existing `ingested_files` incremental mechanism must be extended.

### IMPROVEMENT-7: Unmatched-sub-agent diagnostic ghost card
**Discovery problem solved:** Users see "Subagent data not found" with no idea whether the sub-agent is still running, was lost, or never linked (§4.1c, §2.6 last row).
**User outcome:** Ghost card distinguishes three states: `⟳ Running` (pulses, shows elapsed), `⚠ Unmatched` (shows reason: "no agentId in output, no matching description"), `✗ File missing` (filesystem link succeeded but child file is gone). Each offers an actionable hint.
**Affected files:** `packages/frontend/src/components/SubagentSummaryCard.vue:2-11` (split ghost-state render into three branches), `src-tauri/src/ingestion/mod.rs:387-604` (expose a `linkAttempted` flag on the tool_call so the frontend can distinguish "pre-link run" from "linker ran and found nothing"), `packages/frontend/src/types/api.ts:85-96` (add `subagentLinkAttempted: boolean` on `ToolCallRow`).
**Approach sketch:** Set a column `tool_calls.subagent_link_attempted` after every linker pass (backend). Frontend: running = `!linkAttempted && conversation.isActive`, unmatched = `linkAttempted && !subagentConversationId`, missing = `subagentConversationId && !summary`.
**Size:** M.
**Priority:** **P1** — medium impact, but improves trust in data. Requires a schema column and backend change.
**Dependencies / risks:** Column migration trivial with `ALTER TABLE`. IMPROVEMENT-1 (WebSocket event) makes the "running → complete" transition smoother.

### IMPROVEMENT-8: Parallel-sub-agent visual grouping
**Discovery problem solved:** N parallel Task calls in one assistant message render as N stacked cards with no cue they are siblings (§2.5, §4.6a).
**User outcome:** Parallel sub-agents render in a 2-column responsive grid with a shared header "3 sub-agents running in parallel" and an aggregate progress indicator (`2 ✓ 1 ⟳`).
**Affected files:** `packages/frontend/src/components/AssistantGroupCard.vue` (detect adjacent Task tool_calls with matching `messageId`, wrap them in a new `SubagentBatch.vue`), `packages/frontend/src/components/SubagentBatch.vue` (new), `packages/frontend/src/composables/useGroupedTurns.ts` (no change strictly required, but could add an explicit `parallel-batch` sub-grouping for cleaner semantics), `packages/frontend/src/composables/useTimeline.ts:44-66` (emit a single `subagent-batch` event with `count` and drill into siblings on click).
**Approach sketch:** A "parallel batch" is defined as ≥ 2 Task/Agent tool_calls with the same `messageId` (they share the exact same assistant message — the only way to fan out in Claude Code). Collapse on render into a flex-wrap grid.
**Size:** M-L.
**Priority:** **P1** — high impact on parallel workflows; no schema change; moderate frontend refactor.
**Dependencies / risks:** Timeline sidebar (IMPROVEMENT-3) interaction needs thought — either expand the batch into N sidebar events (current behavior) or emit one aggregate event with sub-drilldown.

### IMPROVEMENT-9: Sub-agent-aware Overview widget (top-N)
**Discovery problem solved:** Dashboard has no aggregate view for sub-agents (§4.3a). "Which 5 conversations spawned the most sub-agents this week?" is un-answerable without scrolling every conversation.
**User outcome:** A new Overview widget `Top Sub-agent-heavy Conversations` shows the 5 conversations with the highest sub-agent count in the selected time range, plus per-row success/failure breakdown. Clicking a row opens the conversation.
**Affected files:** `packages/frontend/src/components/TopSubagentConversationsWidget.vue` (new, modeled on `TopConversationsWidget.vue`), `packages/frontend/src/pages/OverviewPage.vue` (plug the new widget into the grid), `src-tauri/src/conversations.rs` (new handler `GET /api/analytics/subagents/top-conversations` that SELECTs parent conversations by COUNT of child rows joined with summary-status counts).
**Approach sketch:** SQL aggregate on `conversations` grouped by `parent_conversation_id`. Pre-compute on the fly from existing columns — no schema change.
**Size:** M.
**Priority:** **P1** — strategic for surfacing sub-agent activity, moderate effort, no schema change.
**Dependencies / risks:** None. Future extension: "top descriptions" (most-used sub-agent task type) once description is indexed (IMPROVEMENT-6).

### IMPROVEMENT-10: Command-palette jump-to-sub-agent (Cmd+K)
**Discovery problem solved:** No global way to jump to the Nth sub-agent of the current conversation, or to search for a sub-agent by description (§4.4a).
**User outcome:** Cmd+K opens a palette. Typing "sub 3" jumps to the third sub-agent in the current conversation. Typing any keyword searches recent sub-agent descriptions across all conversations and jumps to the chosen one.
**Affected files:** `packages/frontend/src/components/CommandPalette.vue` (new), `packages/frontend/src/composables/useCommandPalette.ts` (new), `packages/frontend/src/App.vue` (mount the palette at root), `packages/frontend/src/composables/useSubagentList.ts` (shared with IMPROVEMENT-2).
**Approach sketch:** Client-only index built from the currently-visible conversation plus a lightweight fetch `GET /api/analytics/subagents/recent?limit=100` for cross-conversation search. Keyboard shortcut registered globally.
**Size:** L.
**Priority:** **P2** — large effort; valuable but less universally discovered than visual improvements. Benefits compound when IMPROVEMENT-6 (FTS indexing) lands.
**Dependencies / risks:** Global shortcut coordination with existing J/K nav. Palette becomes more powerful once IMPROVEMENT-6 ships.

### Suggested next steps

The three P0 items should be batched as a single quick task or two back-to-back quick tasks because they share a theme (inline sub-agent discovery polish) and touch overlapping files, minimising merge risk.

1. **IMPROVEMENT-1 (Emit WS event after linking)** — **Do first.** Fixes a correctness/live-UX regression and is prerequisite polish for every other live-update improvement. Backend-light, frontend-light, no schema. Single commit feasible.
2. **IMPROVEMENT-2 (Overview strip in ConversationDetailPage)** — **Ship second.** Most visible high-impact discovery improvement; pure frontend; reuses existing `data-tool-call-id` scroll infrastructure. Naturally tested alongside IMPROVEMENT-1 because a completing sub-agent should flip its chip state live.
3. **IMPROVEMENT-3 (Timeline icons + pulse)** — **Ship third.** Smallest of the three; extends the sidebar that already exists; composes with the overview strip (same status data flow via `useSubagentList`).

A second wave (IMPROVEMENT-4 cost badge, IMPROVEMENT-7 unmatched diagnostic) is a natural follow-up quick task once the P0 set lands. IMPROVEMENT-5 (sub-agent filter) and IMPROVEMENT-6 (FTS indexing) warrant their own phase because they introduce new API parameters and a migration — bundle them together since they compound.

---

## Self-Check

Spot-checked citations:
- `subagent_linker.rs:70-251` — verified: function `link_subagents` starts at line 70, ends at line 251.
- `SubagentSummaryCard.vue:281-295` — verified: `watch(expanded, async (isExpanded) => { … fetch … })`.
- `TrayPanelPage.vue:105` — verified: `conversations.value = rows.filter((r) => !r.parentConversationId);`.
- `ConversationTimeline.vue:58-62` — verified: `case 'subagent': return { icon: Workflow, colorClass: 'text-info' };`.
- `ingestion/mod.rs:582-589` — verified: `UPDATE tool_calls SET subagent_summary = ?1 WHERE id = ?2` and no `broadcast_event` surrounding.

No production source files were modified during this research.
