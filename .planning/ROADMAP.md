# Roadmap: Cowboy

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (shipped 2026-03-04)
- ✅ **v1.1 Conversation View Polish** — Phases 10-13 (shipped 2026-03-05)
- ✅ **v1.2 Data Quality & Display Fixes** — Phases 14-16 (shipped 2026-03-05)
- ✅ **v1.3 Bug Fix & Quality Audit** — Phases 17-24 (shipped 2026-03-08)
- ✅ **v2.0 UX Overhaul** — Phases 25-30 (shipped 2026-03-09)
- ✅ **v2.1 Realtime & Live Insights** — Phases 31-35 (shipped 2026-03-10)
- ✅ **v3.0 Tauri Desktop App** — Phases 36-40 (shipped 2026-03-11)
- 🚧 **v3.1 Remove Cursor Support** — Phases 41-46 (in progress)

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

<details>
<summary>v3.0 Tauri Desktop App (Phases 36-40) -- SHIPPED 2026-03-11</summary>

- [x] **Phase 36: Tauri Scaffold + Infrastructure** — Tauri v2 project with axum server, CSP, async SQLite, and Vue frontend loading in webview (completed 2026-03-11)
- [x] **Phase 37: Database Layer + Read-Only API** — All read endpoints ported to axum with response parity against Node.js backend (completed 2026-03-11)
- [x] **Phase 38: Settings, Write Endpoints + WebSocket** — Mutation endpoints and typed WebSocket event infrastructure ported to Rust (completed 2026-03-11)
- [x] **Phase 39: Ingestion Engine** — Claude Code and Cursor parsers ported to Rust with row-level data parity verification (completed 2026-03-11)
- [x] **Phase 40: File Watcher + Desktop Chrome** — notify-based file watching, system tray, close-to-tray, native menu, and Node.js removal (completed 2026-03-11)

</details>

### v3.1 Remove Cursor Support (In Progress)

**Milestone Goal:** Remove all Cursor-specific code while keeping the architecture open for future agent additions.

- [x] **Phase 41: Cursor Data Migration** — Startup migration to delete all Cursor conversations and related records from SQLite (completed 2026-03-27)
- [x] **Phase 42: Ingestion Pipeline Removal** — Remove Cursor parser, normalizer, file discovery, pipeline integration, and data migrations (completed 2026-03-27)
- [x] **Phase 43: Watcher & Pricing Cleanup** — Remove Cursor from AgentKind enum, vscdb file detection, debounce timer, and model pricing (completed 2026-03-27)
- [ ] **Phase 44: Settings Removal** — Remove Cursor fields from DB schema, settings API, validation logic, and Settings page UI
- [ ] **Phase 45: Frontend Removal** — Remove Cursor from agent constants, AgentsPage, comparison composable, and settings composable
- [ ] **Phase 46: Architecture Verification** — Verify generic agent schema survives and analytics queries handle single-agent gracefully

## Phase Details

### Phase 41: Cursor Data Migration
**Goal**: All Cursor data is purged from the database on startup so subsequent code removal has no orphaned references
**Depends on**: Nothing (first phase of v3.1)
**Requirements**: DATA-01
**Success Criteria** (what must be TRUE):
  1. Application startup automatically deletes all conversations where agent='cursor' and their associated messages, tool calls, token usage, plans, and compaction events
  2. After startup migration runs, zero rows exist with agent='cursor' in any table
  3. Claude Code conversations and all their related data remain completely untouched
**Plans:** 1/1 plans complete
Plans:
- [x] 41-01-PLAN.md — Purge all Cursor data with one-time startup migration

### Phase 42: Ingestion Pipeline Removal
**Goal**: The Rust ingestion engine contains zero Cursor-specific code — no parser, normalizer, file discovery, or pipeline references
**Depends on**: Phase 41 (data purged before code removal)
**Requirements**: ING-01, ING-02, ING-03, ING-04, ING-05
**Success Criteria** (what must be TRUE):
  1. cursor_parser.rs, cursor_normalizer.rs, and cursor_file_discovery.rs files no longer exist in the codebase
  2. The main ingestion pipeline (mod.rs) has no Cursor match arms, imports, or conditional branches
  3. Cursor-specific startup migrations (fix_cursor_projects, fix_cursor_messages) are removed
  4. The project compiles with zero errors and zero warnings related to missing Cursor modules
**Plans:** 1/1 plans complete
Plans:
- [x] 42-01-PLAN.md — Delete Cursor modules and remove Cursor code from pipeline and migrations

### Phase 43: Watcher & Pricing Cleanup
**Goal**: The file watcher only watches for Claude Code logs, and pricing tables contain no Cursor/OpenAI model entries
**Depends on**: Phase 42 (ingestion modules removed before watcher references them)
**Requirements**: WATCH-01, WATCH-02, PRICE-01
**Success Criteria** (what must be TRUE):
  1. The AgentKind enum has no Cursor variant
  2. The file watcher does not scan for vscdb files or maintain a Cursor-specific debounce timer
  3. MODEL_PRICING contains no Cursor-specific model aliases or OpenAI model entries
**Plans:** 1/1 plans complete
Plans:
- [ ] 43-01-PLAN.md — Remove Cursor from watcher (AgentKind, vscdb, debounce) and pricing table

### Phase 44: Settings Removal
**Goal**: No Cursor configuration exists in the database schema, settings API, or Settings page
**Depends on**: Phase 43 (watcher no longer references Cursor settings)
**Requirements**: SET-01, SET-02, SET-03
**Success Criteria** (what must be TRUE):
  1. The settings database schema has no cursor_path, cursor_enabled, or sync_cursor columns
  2. The settings API endpoints neither accept nor return Cursor-related fields
  3. The Settings page UI shows no Cursor path input, enable toggle, or sync checkbox
**Plans:** [to be planned]

### Phase 45: Frontend Removal
**Goal**: The frontend has zero Cursor references in agent constants, pages, or composables
**Depends on**: Phase 44 (settings composable cleanup depends on backend settings removal)
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Agent constants (AGENTS array, colors, labels, theme classes) contain no Cursor entries
  2. The AgentsPage has no Cursor tab and does not fetch or display Cursor-specific data
  3. The useAgentComparison composable has no Cursor-specific computed properties or data fetching
  4. The useSettings composable has no Cursor-related fields or form bindings
  5. The agent filter dropdown in conversation list contains no Cursor option
**Plans:** [to be planned]

### Phase 46: Architecture Verification
**Goal**: The application works correctly as a single-agent (Claude Code only) system with no broken queries or empty states
**Depends on**: Phase 45 (all removal complete before verification)
**Requirements**: ARCH-01, ARCH-02
**Success Criteria** (what must be TRUE):
  1. The conversations table retains its generic agent TEXT column (not hardcoded to 'claude_code')
  2. The AgentsPage and comparison views render correctly with only Claude Code data (no empty cards, no JS errors)
  3. Overview dashboard, analytics, and all aggregate queries return correct results with single-agent data
  4. The application compiles cleanly, starts without errors, and all pages load without console errors
**Plans:** [to be planned]

## Progress

**Execution Order:**
Phases execute in numeric order: 41 -> 42 -> 43 -> 44 -> 45 -> 46

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
| 38. Settings, Write Endpoints + WebSocket | v3.0 | 3/3 | Complete | 2026-03-11 |
| 39. Ingestion Engine | v3.0 | 4/4 | Complete | 2026-03-11 |
| 40. File Watcher + Desktop Chrome | v3.0 | 3/3 | Complete | 2026-03-11 |
| 41. Cursor Data Migration | v3.1 | 1/1 | Complete | 2026-03-27 |
| 42. Ingestion Pipeline Removal | v3.1 | 1/1 | Complete | 2026-03-27 |
| 43. Watcher & Pricing Cleanup | 1/1 | Complete   | 2026-03-27 | - |
| 44. Settings Removal | v3.1 | 0/0 | Not started | - |
| 45. Frontend Removal | v3.1 | 0/0 | Not started | - |
| 46. Architecture Verification | v3.1 | 0/0 | Not started | - |
