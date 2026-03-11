# Roadmap: Cowboy

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (shipped 2026-03-04)
- ✅ **v1.1 Conversation View Polish** — Phases 10-13 (shipped 2026-03-05)
- ✅ **v1.2 Data Quality & Display Fixes** — Phases 14-16 (shipped 2026-03-05)
- ✅ **v1.3 Bug Fix & Quality Audit** — Phases 17-24 (shipped 2026-03-08)
- ✅ **v2.0 UX Overhaul** — Phases 25-30 (shipped 2026-03-09)
- ✅ **v2.1 Realtime & Live Insights** — Phases 31-35 (shipped 2026-03-10)
- **v3.0 Tauri Desktop App** — Phases 36-40 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 MVP (Phases 1-9) -- SHIPPED 2026-03-04</summary>

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
<summary>v1.1 Conversation View Polish (Phases 10-13) -- SHIPPED 2026-03-05</summary>

- [x] **Phase 10: Data Grouping Foundation** — Turn types and messageId-based grouping logic with unit tests (completed 2026-03-04)
- [x] **Phase 11: Core Collapsible UI** — AssistantResponseBlock with progressive disclosure, summary headers, and expand/collapse all (completed 2026-03-05)
- [x] **Phase 12: Token Enrichment** — Backend per-message token data and cost-per-turn display in summary headers (completed 2026-03-05)
- [x] **Phase 13: Visual Polish** — Tool call type icons and color-coded model name badges (completed 2026-03-05)

</details>

<details>
<summary>v1.2 Data Quality & Display Fixes (Phases 14-16) -- SHIPPED 2026-03-05</summary>

- [x] **Phase 14: Ingestion Quality** — Fix title extraction and model attribution during backend ingestion (completed 2026-03-05)
- [x] **Phase 15: Cursor Data Quality** — Fix Cursor assistant responses, agent filter, and project path display (completed 2026-03-05)
- [x] **Phase 16: Message Display** — Visually distinguish system-injected messages and slash commands (completed 2026-03-05)

</details>

<details>
<summary>v1.3 Bug Fix & Quality Audit (Phases 17-24) -- SHIPPED 2026-03-08</summary>

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
<summary>v2.0 UX Overhaul (Phases 25-30) -- SHIPPED 2026-03-09</summary>

- [x] **Phase 25: Data Quality & Code Cleanup** — Fix parser bugs, streaming deduplication, and consolidate dead code before building new features (completed 2026-03-09)
- [x] **Phase 26: Display Quick Wins** — Always-visible AI responses, user message truncation, and semantic message colors (completed 2026-03-09)
- [x] **Phase 27: Tool Viewers** — LCS diff viewer for Edit, syntax-highlighted code for Read/Write, terminal display for Bash, and dispatch routing (completed 2026-03-09)
- [x] **Phase 28: Navigation & Search** — In-conversation search, command palette, and keyboard shortcuts (completed 2026-03-09)
- [x] **Phase 29: Compaction Detection** — Detect compaction boundaries during ingestion and render them as token-delta markers (completed 2026-03-09)
- [x] **Phase 30: Subagent Resolution** — Discover and link subagent JSONL files to parent Task tool calls with summary cards (completed 2026-03-09)

</details>

<details>
<summary>v2.1 Realtime & Live Insights (Phases 31-35) -- SHIPPED 2026-03-10</summary>

- [x] **Phase 31: WebSocket Event Infrastructure** — Typed, conversation-scoped WebSocket events replacing the untyped broadcast (completed 2026-03-10)
- [x] **Phase 32: Realtime Conversation Detail** — Push new messages to open conversation pages with scroll preservation (completed 2026-03-10)
- [x] **Phase 33: Realtime Conversation Discovery** — New conversations auto-appear in list and overview without refresh (completed 2026-03-10)
- [x] **Phase 34: Live Token Usage Widget** — Floating dismissable token rate widget with expandable chart and sidebar toggle (completed 2026-03-10)
- [x] **Phase 35: Conversation Timeline** — Collapsible vertical timeline with click-to-scroll event navigation (completed 2026-03-10)

</details>

### v3.0 Tauri Desktop App (In Progress)

**Milestone Goal:** Convert Cowboy into a native Tauri v2 desktop app with a Rust backend, preserving existing Vue 3 + DaisyUI frontend unchanged.

- [x] **Phase 36: Tauri Scaffold + Infrastructure** — Tauri v2 project with axum server, CSP, async SQLite, and Vue frontend loading in webview (completed 2026-03-11)
- [x] **Phase 37: Database Layer + Read-Only API** — All read endpoints ported to axum with response parity against Node.js backend (completed 2026-03-11)
- [x] **Phase 38: Settings, Write Endpoints + WebSocket** — Mutation endpoints and typed WebSocket event infrastructure ported to Rust (completed 2026-03-11)
- [ ] **Phase 39: Ingestion Engine** — Claude Code and Cursor parsers ported to Rust with row-level data parity verification
- [ ] **Phase 40: File Watcher + Desktop Chrome** — notify-based file watching, system tray, close-to-tray, native menu, and Node.js removal

## Phase Details

### Phase 36: Tauri Scaffold + Infrastructure
**Goal**: Tauri v2 app opens a native macOS window showing the existing Vue frontend, with axum and async SQLite ready for feature work
**Depends on**: Nothing (first phase of v3.0)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04
**Success Criteria** (what must be TRUE):
  1. Running `cargo tauri dev` opens a native macOS window with the Vue frontend rendered via Vite dev server
  2. Axum health endpoint responds at http://127.0.0.1:3001/api/health with JSON (development port, parallel to Node.js on :3000)
  3. CSP allows DaisyUI inline styles, localhost API calls, and WebSocket connections (verified with `tauri build`)
  4. tokio-rusqlite opens the existing cowboy.db and executes a test query without blocking the Tokio runtime
**Plans**: 2 plans

Plans:
- [ ] 36-01-PLAN.md — Scaffold Tauri v2 project with axum server, CSP, and Vite integration
- [ ] 36-02-PLAN.md — Database layer with tokio-rusqlite, transparent title bar, and end-to-end verification

### Phase 37: Database Layer + Read-Only API
**Goal**: The full dashboard renders real data from axum -- all conversation, analytics, and plan read endpoints return identical JSON to the Node.js backend
**Depends on**: Phase 36
**Requirements**: API-01, API-02, API-03
**Success Criteria** (what must be TRUE):
  1. Conversation list and detail pages render correctly when the frontend points at the Rust backend on :3001
  2. All analytics pages (token stats, cost stats, heatmap, model distribution) show correct data matching Node.js output
  3. Plan tracking page displays plans with correct titles, statuses, and completion counts
  4. JSON response diff between Node.js (:3000) and Rust (:3001) shows zero differences on all read endpoints
**Plans**: 3 plans

Plans:
- [ ] 37-01-PLAN.md — Shared foundation (error, extractors, pricing) and conversation endpoints
- [ ] 37-02-PLAN.md — All 8 analytics endpoints (overview, timeseries, model-distribution, tool-stats, heatmap, project-stats, token-rate, filters)
- [ ] 37-03-PLAN.md — Plan tracking endpoints and diff testing script

### Phase 38: Settings, Write Endpoints + WebSocket
**Goal**: All mutation endpoints and the WebSocket event system work on the Rust backend -- settings save/load, database management, and live updates all function
**Depends on**: Phase 37
**Requirements**: API-04, API-05, API-06, RT-01, RT-02, RT-03
**Success Criteria** (what must be TRUE):
  1. Settings page saves and loads configuration round-trip through the Rust backend
  2. Database clear and refresh-all operations execute successfully from the Settings page
  3. WebSocket connects with typed event protocol (discriminated union payloads, sequence numbers, gap detection)
  4. Conversation-scoped events (new messages, token updates) push to the correct open conversation page
  5. New conversation discovery events appear in the conversation list without page refresh
**Plans**: 2 plans

Plans:
- [ ] 38-01-PLAN.md — AppState expansion, settings endpoints (10 handlers), and existing handler refactor
- [ ] 38-02-PLAN.md — WebSocket handler, broadcast wiring, frontend types, and diff script mutation tests

### Phase 39: Ingestion Engine
**Goal**: Rust ingestion produces identical SQLite data to the Node.js ingestion -- all conversations, messages, tool calls, tokens, plans, compaction events, and subagent links match row-for-row
**Depends on**: Phase 38
**Requirements**: ING-01, ING-02, ING-03, ING-04, ING-05
**Success Criteria** (what must be TRUE):
  1. Claude Code JSONL files ingest correctly: messages, tool calls, token usage, plans, compaction boundaries, and subagent links all present
  2. Cursor vscdb files ingest correctly: messages, tool calls, workspace paths, and thinking content all present
  3. Snapshot diffing detects changes and emits correct WebSocket events during ingestion
  4. Row-level SQLite diff between Node.js and Rust ingestion of the same source files shows zero differences
**Plans**: TBD

Plans:
- [ ] 39-01: TBD
- [ ] 39-02: TBD
- [ ] 39-03: TBD

### Phase 40: File Watcher + Desktop Chrome
**Goal**: Cowboy runs as a complete native desktop app -- file changes trigger automatic ingestion, system tray provides app control, and the Node.js backend is removed
**Depends on**: Phase 39
**Requirements**: WATCH-01, WATCH-02, DESK-01, DESK-02, DESK-03
**Success Criteria** (what must be TRUE):
  1. Saving a new Claude Code conversation to disk triggers automatic ingestion and the conversation appears in the dashboard within seconds
  2. System tray icon is visible with Show and Quit menu items that work correctly
  3. Closing the window hides the app to tray (file watching continues in background); clicking tray Show restores the window
  4. Native menu bar shows app name menu with About and Quit, plus Edit menu with copy/paste shortcuts
  5. The Node.js packages/backend directory is removed and `cargo tauri dev` is the only way to run the app
**Plans**: TBD

Plans:
- [ ] 40-01: TBD
- [ ] 40-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 36 -> 37 -> 38 -> 39 -> 40

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
| 31. WebSocket Event Infrastructure | v2.1 | 2/2 | Complete | 2026-03-10 |
| 32. Realtime Conversation Detail | v2.1 | 2/2 | Complete | 2026-03-10 |
| 33. Realtime Conversation Discovery | v2.1 | 2/2 | Complete | 2026-03-10 |
| 34. Live Token Usage Widget | v2.1 | 2/2 | Complete | 2026-03-10 |
| 35. Conversation Timeline | v2.1 | 2/2 | Complete | 2026-03-10 |
| 36. Tauri Scaffold + Infrastructure | v3.0 | 2/2 | Complete | 2026-03-11 |
| 37. Database Layer + Read-Only API | v3.0 | 3/3 | Complete | 2026-03-11 |
| 38. Settings, Write Endpoints + WebSocket | 2/2 | Complete   | 2026-03-11 | - |
| 39. Ingestion Engine | v3.0 | 0/0 | Not started | - |
| 40. File Watcher + Desktop Chrome | v3.0 | 0/0 | Not started | - |
