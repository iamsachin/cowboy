# Roadmap: Cowboy

## Overview

Cowboy delivers a unified coding agent analytics dashboard in 9 phases, built left-to-right along the data pipeline. The foundation and Claude Code ingestion come first because every downstream feature depends on correct data in SQLite. The API and dashboard make that data visible. Real-time updates and Cursor integration layer on top. Advanced analytics, plan tracking, and remote sync are additive features that enrich an already-working product. Each phase delivers a coherent, verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Project Foundation** - Scaffold the monorepo with Node.js/Fastify backend, Vue 3/DaisyUI frontend, and SQLite/Drizzle schema (completed 2026-03-03)
- [x] **Phase 2: Claude Code Ingestion** - Parse Claude Code JSONL logs into the unified SQLite schema with deduplication
- [x] **Phase 3: API + Core Dashboard** - REST API and overview dashboard with token analytics, cost tracking, and date filtering
- [ ] **Phase 4: Conversation Browser** - Browse, search, and inspect full conversation history with messages and tool calls
- [ ] **Phase 5: Real-Time Updates** - File watching with chokidar and WebSocket live updates to the dashboard
- [ ] **Phase 6: Cursor Integration + Agent Comparison** - Parse Cursor data and deliver per-agent pages with side-by-side comparison
- [ ] **Phase 7: Advanced Analytics** - Cost projections, tool call analytics, activity heatmap, model distribution, per-project grouping
- [ ] **Phase 8: Plan Tracking** - Heuristic plan extraction from conversations with completion status and statistics
- [ ] **Phase 9: Settings + Remote Sync** - Settings page with log path config, remote POST endpoint, frequency, and payload selection

## Phase Details

### Phase 1: Project Foundation
**Goal**: Developer can run a single command and have a working Fastify server serving a Vue 3 SPA with DaisyUI components, backed by a SQLite database with the unified schema ready to receive data
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. Running `pnpm dev` starts Fastify backend and Vite dev server, and the browser shows a DaisyUI-styled shell page
  2. SQLite database is created on first run with all unified schema tables (conversations, messages, tool_calls, token_usage) via Drizzle migrations
  3. A health-check API endpoint (`GET /api/health`) returns 200 with database status
  4. The project builds for production (`pnpm build`) and Fastify serves the static Vue build
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Scaffold monorepo workspace, shared types, backend with Fastify/Drizzle/SQLite, health check, and test infrastructure
- [x] 01-02-PLAN.md -- Vue 3 frontend with DaisyUI 5 night theme dashboard shell, collapsible sidebar, placeholder pages, and production build

### Phase 2: Claude Code Ingestion
**Goal**: All historical Claude Code conversations are parsed from JSONL files, normalized into the unified schema, and stored in SQLite with no duplicates on re-runs
**Depends on**: Phase 1
**Requirements**: INGEST-01, INGEST-03, INGEST-05, INGEST-06
**Success Criteria** (what must be TRUE):
  1. Running the ingestion process reads all JSONL files from `~/.claude/projects/` and populates conversations, messages, tool_calls, and token_usage tables
  2. Running ingestion a second time produces zero new rows (deterministic deduplication via content-derived IDs)
  3. Partial or malformed JSONL lines are skipped without crashing, and a count of skipped lines is logged
  4. All available historical data is parsed with no retention limit or date cutoff
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Ingestion foundation: TypeScript types, deterministic ID generator, recursive file discovery, and JSONL test fixtures
- [x] 02-02-PLAN.md -- JSONL parser with streaming assistant chunk reconstruction and normalizer for unified schema mapping
- [x] 02-03-PLAN.md -- Fastify ingestion plugin with API endpoints, per-file transactions, deduplication, and integration tests

### Phase 3: API + Core Dashboard
**Goal**: User opens the browser and sees an overview dashboard with aggregate stats, token usage, estimated costs, and time-series charts, all filterable by date range
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, TOKEN-01, TOKEN-02, TOKEN-03
**Success Criteria** (what must be TRUE):
  1. Overview dashboard displays KPI cards showing total tokens, estimated cost, conversation count, and active days
  2. User can view token breakdown per conversation (input, output, cache_read, cache_creation) and estimated cost based on model pricing
  3. Time-series charts show usage trends with daily, weekly, and monthly granularity
  4. User can filter all dashboard views by date range using preset buttons (today, 7d, 30d, all time) and a custom date picker
  5. Aggregate token usage and cost across all conversations are visible on the overview page
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md -- Backend analytics API: shared pricing module, Drizzle aggregate queries, three REST endpoints (overview, timeseries, conversations), and integration tests
- [x] 03-02-PLAN.md -- Frontend dashboard: Chart.js charts (stacked area tokens, bar cost, bar conversations), KPI cards with trends, date range filter with presets and custom picker
- [x] 03-03-PLAN.md -- Conversation table with per-conversation token breakdown, cost/savings display, sorting, pagination, and visual verification checkpoint

### Phase 4: Conversation Browser
**Goal**: User can find any conversation by browsing, filtering, or searching, and drill into full conversation detail with messages, tool calls, and metadata
**Depends on**: Phase 3
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04
**Success Criteria** (what must be TRUE):
  1. User can browse a paginated list of conversations sorted by date, with filters for agent and project
  2. User can search conversations by content or metadata and see matching results
  3. Clicking a conversation shows the full detail view with messages (role, content, timestamps), tool calls (name, inputs, outputs), and code blocks
  4. Each conversation clearly displays which agent and model produced it
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Real-Time Updates
**Goal**: Dashboard updates live as the user works with coding agents, with no manual refresh needed
**Depends on**: Phase 2, Phase 3
**Requirements**: INGEST-04, LIVE-01, LIVE-02
**Success Criteria** (what must be TRUE):
  1. When a new Claude Code conversation entry is written to disk, the dashboard reflects the new data within 2 seconds without page refresh
  2. WebSocket connection recovers automatically after network interruption or browser background tab suspension (visibilitychange reconnect)
  3. A visible connection status indicator shows whether the live feed is connected, reconnecting, or disconnected
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Cursor Integration + Agent Comparison
**Goal**: Cursor conversation data appears alongside Claude Code data, and users can view per-agent breakdowns and compare agents side-by-side
**Depends on**: Phase 2, Phase 5
**Requirements**: INGEST-02, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. Cursor conversations from state.vscdb are parsed and visible in the dashboard alongside Claude Code data
  2. User can navigate to per-agent pages (Claude Code, Cursor) showing agent-specific stats and conversations
  3. User can open a side-by-side comparison view showing token usage, cost, tool calls, and conversation counts for each agent
  4. The unified overview dashboard aggregates data from both agents correctly
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Advanced Analytics
**Goal**: User has deep analytical views including cost projections, tool call effectiveness, usage patterns, model distribution, and per-project breakdowns
**Depends on**: Phase 6
**Requirements**: TOKEN-04, TOKEN-05, TOOL-01, TOOL-02, TOOL-03, DASH-06, DASH-07
**Success Criteria** (what must be TRUE):
  1. User can view cost trend analysis with a forward spending projection line on the chart
  2. User can view all tool calls within a conversation and see tool-level success/failure rates, frequency, and duration statistics
  3. User can view an activity heatmap (GitHub contribution graph style) showing daily usage patterns
  4. User can view model distribution breakdown showing which models are used and how often
  5. User can view per-project analytics grouped by codebase directory
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD
- [ ] 07-03: TBD

### Phase 8: Plan Tracking
**Goal**: User can see multi-step plans extracted from agent conversations with completion tracking and aggregate statistics
**Depends on**: Phase 4
**Requirements**: PLAN-01, PLAN-02, PLAN-03
**Success Criteria** (what must be TRUE):
  1. System extracts multi-step plans from conversation messages using heuristic detection (numbered lists, checkbox patterns, step-by-step instructions)
  2. User can view extracted plans with their steps and inferred completion status
  3. User can view plan statistics showing average step count, completion rates, and trends
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

### Phase 9: Settings + Remote Sync
**Goal**: User can configure the application (log paths, remote sync endpoint, frequency, payload scope) through a settings page
**Depends on**: Phase 1
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04
**Success Criteria** (what must be TRUE):
  1. User can configure log file paths for each agent (Claude Code, Cursor) in a settings page
  2. User can set a remote URL endpoint and the app POSTs collected data to it on schedule
  3. User can choose POST frequency (5 min, 15 min, 1 hour) and which data categories to include
  4. Remote sync failures retry with backoff and do not block the local dashboard
**Plans**: TBD

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Foundation | 2/2 | Complete   | 2026-03-03 |
| 2. Claude Code Ingestion | 3/3 | Complete | 2026-03-04 |
| 3. API + Core Dashboard | 3/3 | Complete | 2026-03-04 |
| 4. Conversation Browser | 0/2 | Not started | - |
| 5. Real-Time Updates | 0/2 | Not started | - |
| 6. Cursor Integration + Agent Comparison | 0/2 | Not started | - |
| 7. Advanced Analytics | 0/3 | Not started | - |
| 8. Plan Tracking | 0/1 | Not started | - |
| 9. Settings + Remote Sync | 0/2 | Not started | - |
