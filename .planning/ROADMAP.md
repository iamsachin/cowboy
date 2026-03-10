# Roadmap: Cowboy

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (shipped 2026-03-04)
- ✅ **v1.1 Conversation View Polish** — Phases 10-13 (shipped 2026-03-05)
- ✅ **v1.2 Data Quality & Display Fixes** — Phases 14-16 (shipped 2026-03-05)
- ✅ **v1.3 Bug Fix & Quality Audit** — Phases 17-24 (shipped 2026-03-08)
- ✅ **v2.0 UX Overhaul** — Phases 25-30 (shipped 2026-03-09)
- 🚧 **v2.1 Realtime & Live Insights** — Phases 31-35 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>✅ v1.0 MVP (Phases 1-9) — SHIPPED 2026-03-04</summary>

- [x] **Phase 1: Project Foundation** — Scaffold the monorepo with Node.js/Fastify backend, Vue 3/DaisyUI frontend, and SQLite/Drizzle schema (completed 2026-03-03)
- [x] **Phase 2: Claude Code Ingestion** — Parse Claude Code JSONL logs into the unified SQLite schema with deduplication
- [x] **Phase 3: API + Core Dashboard** — REST API and overview dashboard with token analytics, cost tracking, and date filtering
- [x] **Phase 4: Conversation Browser** — Browse, search, and inspect full conversation history with messages and tool calls (completed 2026-03-04)
- [x] **Phase 5: Real-Time Updates** — File watching with chokidar and WebSocket live updates to the dashboard
- [x] **Phase 6: Cursor Integration + Agent Comparison** — Parse Cursor data and deliver per-agent pages with side-by-side comparison
- [x] **Phase 7: Advanced Analytics** — Cost projections, tool call analytics, activity heatmap, model distribution, per-project grouping
- [x] **Phase 8: Plan Tracking** — Heuristic plan extraction from conversations with completion status and statistics
- [x] **Phase 9: Settings + Remote Sync** — Settings page with log path config, remote POST endpoint, frequency, and payload selection

</details>

<details>
<summary>✅ v1.1 Conversation View Polish (Phases 10-13) — SHIPPED 2026-03-05</summary>

- [x] **Phase 10: Data Grouping Foundation** — Turn types and messageId-based grouping logic with unit tests (completed 2026-03-04)
- [x] **Phase 11: Core Collapsible UI** — AssistantResponseBlock with progressive disclosure, summary headers, and expand/collapse all (completed 2026-03-05)
- [x] **Phase 12: Token Enrichment** — Backend per-message token data and cost-per-turn display in summary headers (completed 2026-03-05)
- [x] **Phase 13: Visual Polish** — Tool call type icons and color-coded model name badges (completed 2026-03-05)

</details>

<details>
<summary>✅ v1.2 Data Quality & Display Fixes (Phases 14-16) — SHIPPED 2026-03-05</summary>

- [x] **Phase 14: Ingestion Quality** — Fix title extraction and model attribution during backend ingestion (completed 2026-03-05)
- [x] **Phase 15: Cursor Data Quality** — Fix Cursor assistant responses, agent filter, and project path display (completed 2026-03-05)
- [x] **Phase 16: Message Display** — Visually distinguish system-injected messages and slash commands (completed 2026-03-05)

</details>

<details>
<summary>✅ v1.3 Bug Fix & Quality Audit (Phases 17-24) — SHIPPED 2026-03-08</summary>

- [x] **Phase 17: Cost Calculation Fixes** — Fix critical cost pricing, sorting, formatting, and token counting errors (completed 2026-03-08)
- [x] **Phase 18: Data Accuracy Fixes** — Fix backend data computation: durations, timestamps, model backfill, tool stats, and timezone issues (completed 2026-03-08)
- [x] **Phase 19: Conversation Display Fixes** — Fix turn grouping, tool call display, system message handling, and scroll behavior in conversation detail (completed 2026-03-08)
- [x] **Phase 20: Conversation List Fixes** — Fix titles, sorting, filtering, search, and formatting in the conversation list view (completed 2026-03-08)
- [x] **Phase 21: Plan Extraction Quality** — Fix plan title heuristics, merge logic, completion matching, and status display (completed 2026-03-08)
- [x] **Phase 22: Analytics & Agent Pages** — Fix heatmap legend, agent filters, Cursor data display, and comparison card styling (completed 2026-03-08)
- [x] **Phase 23: Cross-Cutting Polish** — Fix routing, theme awareness, dead code, and type safety across the codebase (completed 2026-03-08)
- [x] **Phase 24: Overview, Settings & Final Verification** — Fix overview KPIs, settings UX, and browser-verify all v1.3 fixes (completed 2026-03-08)

</details>

<details>
<summary>✅ v2.0 UX Overhaul (Phases 25-30) — SHIPPED 2026-03-09</summary>

- [x] **Phase 25: Data Quality & Code Cleanup** — Fix parser bugs, streaming deduplication, and consolidate dead code before building new features (completed 2026-03-09)
- [x] **Phase 26: Display Quick Wins** — Always-visible AI responses, user message truncation, and semantic message colors (completed 2026-03-09)
- [x] **Phase 27: Tool Viewers** — LCS diff viewer for Edit, syntax-highlighted code for Read/Write, terminal display for Bash, and dispatch routing (completed 2026-03-09)
- [x] **Phase 28: Navigation & Search** — In-conversation search, command palette, and keyboard shortcuts (completed 2026-03-09)
- [x] **Phase 29: Compaction Detection** — Detect compaction boundaries during ingestion and render them as token-delta markers (completed 2026-03-09)
- [x] **Phase 30: Subagent Resolution** — Discover and link subagent JSONL files to parent Task tool calls with summary cards (completed 2026-03-09)

</details>

### 🚧 v2.1 Realtime & Live Insights (In Progress)

**Milestone Goal:** Add realtime data pushing, live token usage monitoring, and conversation timeline navigation.

- [x] **Phase 31: WebSocket Event Infrastructure** — Typed, conversation-scoped WebSocket events replacing the untyped broadcast (completed 2026-03-10)
- [x] **Phase 32: Realtime Conversation Detail** — Push new messages to open conversation pages with scroll preservation (completed 2026-03-10)
- [x] **Phase 33: Realtime Conversation Discovery** — New conversations auto-appear in list and overview without refresh (completed 2026-03-10)
- [ ] **Phase 34: Live Token Usage Widget** — Floating dismissable token rate widget with expandable chart and sidebar toggle
- [ ] **Phase 35: Conversation Timeline** — Collapsible vertical timeline with click-to-scroll event navigation

## Phase Details

### Phase 31: WebSocket Event Infrastructure
**Goal**: Backend broadcasts typed, conversation-scoped events so frontends can react to specific changes
**Depends on**: Nothing (first phase of v2.1)
**Requirements**: PUSH-02
**Success Criteria** (what must be TRUE):
  1. Backend emits typed WebSocket events with conversation ID when a conversation is updated during ingestion
  2. Backend emits a distinct event type when a new conversation is created during ingestion
  3. Frontend WebSocket composable routes typed events to registered callbacks (not a single flat listener)
  4. Shared type definitions exist in the shared package so backend and frontend use identical event shapes
**Plans**: 2 plans
Plans:
- [ ] 31-01-PLAN.md — Shared event types and backend typed event emission
- [ ] 31-02-PLAN.md — Frontend typed event router and composable migration

### Phase 32: Realtime Conversation Detail
**Goal**: Users viewing a conversation see new messages appear automatically without leaving the page
**Depends on**: Phase 31
**Requirements**: PUSH-01, PUSH-03
**Success Criteria** (what must be TRUE):
  1. User viewing a conversation detail page sees new messages appear within seconds of the agent writing them to disk
  2. If user is scrolled to the bottom, new messages auto-scroll into view
  3. If user is scrolled up reading history, scroll position holds steady when new messages arrive
  4. Duplicate messages never appear (deduplication handles push/re-ingestion race)
**Plans**: 2 plans
Plans:
- [ ] 32-01-PLAN.md — Debounced refetch composable, scroll tracker, isActive API field, unit tests
- [ ] 32-02-PLAN.md — UI integration: scroll management, new messages pill, fade-in, green dot

### Phase 33: Realtime Conversation Discovery
**Goal**: Users see new conversations appear in the list and overview without manual refresh
**Depends on**: Phase 31
**Requirements**: PUSH-04, PUSH-05
**Success Criteria** (what must be TRUE):
  1. A new conversation started by an agent appears in the conversation list without the user refreshing
  2. The overview dashboard table updates to include the new conversation without the user refreshing
  3. Existing pagination and sort order are preserved when new conversations appear
**Plans**: 2 plans
Plans:
- [ ] 33-01-PLAN.md — Debounced WS refetch, newIds tracking, and unit tests for list composables
- [ ] 33-02-PLAN.md — Row highlight animation and loading state refinement in table components

### Phase 34: Live Token Usage Widget
**Goal**: Users can monitor real-time token consumption rate from any page
**Depends on**: Phase 31
**Requirements**: WIDG-01, WIDG-02, WIDG-03, WIDG-04
**Success Criteria** (what must be TRUE):
  1. User sees a floating pill displaying current input and output tokens per minute
  2. User can click the pill to expand a line chart showing token rate over time with separate input/output series
  3. User can dismiss the widget and it stays hidden until explicitly restored
  4. User can click a "Show live usage" button in the sidebar to restore a dismissed widget
  5. Backend provides a token rate endpoint that returns per-minute token aggregation for the rolling window
**Plans**: 2 plans
Plans:
- [ ] 31-01-PLAN.md — Shared event types and backend typed event emission
- [ ] 31-02-PLAN.md — Frontend typed event router and composable migration

### Phase 35: Conversation Timeline
**Goal**: Users can navigate conversation history through a visual event timeline
**Depends on**: Phase 32
**Requirements**: TIME-01, TIME-02, TIME-03
**Success Criteria** (what must be TRUE):
  1. User sees a collapsible vertical timeline on the right side of the conversation detail page showing key events (user messages, tool calls, compactions)
  2. User can click any timeline event to scroll the conversation to the corresponding turn
  3. User can collapse and expand the timeline panel to reclaim horizontal space
  4. Timeline updates live when new messages are pushed to the conversation
**Plans**: 2 plans
Plans:
- [ ] 31-01-PLAN.md — Shared event types and backend typed event emission
- [ ] 31-02-PLAN.md — Frontend typed event router and composable migration

## Progress

**Execution Order:**
Phases execute in numeric order: 31 → 32 → 33 → 34 → 35

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Foundation | v1.0 | 2/2 | Complete | 2026-03-03 |
| 2. Claude Code Ingestion | v1.0 | 3/3 | Complete | 2026-03-04 |
| 3. API + Core Dashboard | v1.0 | 3/3 | Complete | 2026-03-04 |
| 4. Conversation Browser | v1.0 | 3/3 | Complete | 2026-03-04 |
| 5. Real-Time Updates | v1.0 | 2/2 | Complete | 2026-03-04 |
| 6. Cursor Integration + Agent Comparison | v1.0 | 2/2 | Complete | 2026-03-04 |
| 7. Advanced Analytics | v1.0 | 3/3 | Complete | 2026-03-04 |
| 8. Plan Tracking | v1.0 | 3/3 | Complete | 2026-03-04 |
| 9. Settings + Remote Sync | v1.0 | 3/3 | Complete | 2026-03-04 |
| 10. Data Grouping Foundation | v1.1 | 2/2 | Complete | 2026-03-04 |
| 11. Core Collapsible UI | v1.1 | 3/3 | Complete | 2026-03-05 |
| 12. Token Enrichment | v1.1 | 2/2 | Complete | 2026-03-05 |
| 13. Visual Polish | v1.1 | 1/1 | Complete | 2026-03-05 |
| 14. Ingestion Quality | v1.2 | 2/2 | Complete | 2026-03-05 |
| 15. Cursor Data Quality | v1.2 | 2/2 | Complete | 2026-03-05 |
| 16. Message Display | v1.2 | 2/2 | Complete | 2026-03-05 |
| 17. Cost Calculation Fixes | v1.3 | 2/2 | Complete | 2026-03-08 |
| 18. Data Accuracy Fixes | v1.3 | 3/3 | Complete | 2026-03-08 |
| 19. Conversation Display Fixes | v1.3 | 3/3 | Complete | 2026-03-08 |
| 20. Conversation List Fixes | v1.3 | 3/3 | Complete | 2026-03-08 |
| 21. Plan Extraction Quality | v1.3 | 3/3 | Complete | 2026-03-08 |
| 22. Analytics & Agent Pages | v1.3 | 2/2 | Complete | 2026-03-08 |
| 23. Cross-Cutting Polish | v1.3 | 2/2 | Complete | 2026-03-08 |
| 24. Overview, Settings & Final Verification | v1.3 | 3/3 | Complete | 2026-03-08 |
| 25. Data Quality & Code Cleanup | v2.0 | 2/2 | Complete | 2026-03-09 |
| 26. Display Quick Wins | v2.0 | 2/2 | Complete | 2026-03-09 |
| 27. Tool Viewers | v2.0 | 2/2 | Complete | 2026-03-09 |
| 28. Navigation & Search | v2.0 | 3/3 | Complete | 2026-03-09 |
| 29. Compaction Detection | v2.0 | 2/2 | Complete | 2026-03-09 |
| 30. Subagent Resolution | v2.0 | 2/2 | Complete | 2026-03-09 |
| 31. WebSocket Event Infrastructure | 2/2 | Complete    | 2026-03-10 | - |
| 32. Realtime Conversation Detail | 2/2 | Complete    | 2026-03-10 | - |
| 33. Realtime Conversation Discovery | 2/2 | Complete   | 2026-03-10 | - |
| 34. Live Token Usage Widget | v2.1 | 0/0 | Not started | - |
| 35. Conversation Timeline | v2.1 | 0/0 | Not started | - |
