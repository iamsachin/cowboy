# Roadmap: Cowboy

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (shipped 2026-03-04)
- ✅ **v1.1 Conversation View Polish** — Phases 10-13 (shipped 2026-03-05)
- ✅ **v1.2 Data Quality & Display Fixes** — Phases 14-16 (shipped 2026-03-05)
- ✅ **v1.3 Bug Fix & Quality Audit** — Phases 17-24 (shipped 2026-03-08)
- [ ] **v2.0 UX Overhaul** — Phases 25-30 (in progress)

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

### v2.0 UX Overhaul (In Progress)

**Milestone Goal:** Close the UX gap with claude-devtools by overhauling conversation display, adding tool-specific viewers, fixing data quality issues, and introducing modern navigation patterns.

- [x] **Phase 25: Data Quality & Code Cleanup** — Fix parser bugs, streaming deduplication, and consolidate dead code before building new features (completed 2026-03-09)
- [x] **Phase 26: Display Quick Wins** — Always-visible AI responses, user message truncation, and semantic message colors (completed 2026-03-09)
- [x] **Phase 27: Tool Viewers** — LCS diff viewer for Edit, syntax-highlighted code for Read/Write, terminal display for Bash, and dispatch routing (completed 2026-03-09)
- [x] **Phase 28: Navigation & Search** — In-conversation search, command palette, and keyboard shortcuts (completed 2026-03-09)
- [x] **Phase 29: Compaction Detection** — Detect compaction boundaries during ingestion and render them as token-delta markers (completed 2026-03-09)
- [ ] **Phase 30: Subagent Resolution** — Discover and link subagent JSONL files to parent Task tool calls with summary cards

## Phase Details

### Phase 25: Data Quality & Code Cleanup
**Goal**: Clean, deduplicated data pipeline and codebase hygiene so all downstream features render accurate content
**Depends on**: Phase 24 (v1.3 complete)
**Requirements**: DATA-01, DATA-02, DATA-03, CLEAN-01, CLEAN-02, CLEAN-03
**Success Criteria** (what must be TRUE):
  1. Re-ingesting a conversation with streaming chunks produces correct token counts (no double-counting from duplicate requestIds)
  2. Expanding an assistant response block shows each tool call exactly once (no phantom duplicates from parser append bug)
  3. Tool call content displayed in the conversation view contains no raw XML system tags
  4. No unused component files exist in the codebase (ToolCallCard.vue removed)
  5. Cost formatting uses a single shared utility across all views
**Plans:** 2/2 plans complete
Plans:
- [ ] 25-01-PLAN.md — Fix streaming dedup, XML sanitization, and getTurnContent bug
- [ ] 25-02-PLAN.md — Remove dead code, extract shared CSS, consolidate cost formatters

### Phase 26: Display Quick Wins
**Goal**: Users can scan conversations faster with visible AI responses, truncated user messages, and color-coded message types
**Depends on**: Phase 25
**Requirements**: DISP-01, DISP-02, DISP-03
**Success Criteria** (what must be TRUE):
  1. User can read the last AI text response on a collapsed assistant group without expanding it
  2. User messages longer than 500 characters show truncated text with a "Show more" toggle that reveals full content
  3. Thinking blocks, tool calls, and tool results are visually distinguishable by their background color tints (purple, amber, green/red)
**Plans:** 2/2 plans complete
Plans:
- [ ] 26-01-PLAN.md — Rendered markdown preview, file names row, and tool summary on collapsed cards
- [ ] 26-02-PLAN.md — User message truncation and semantic color tints

### Phase 27: Tool Viewers
**Goal**: Tool call content renders in purpose-built viewers instead of raw JSON dumps
**Depends on**: Phase 25 (clean data), Phase 26 (stable display components)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04
**Success Criteria** (what must be TRUE):
  1. Edit tool calls display a line-level diff with red/green highlighting, line numbers, and a +N/-M stat summary
  2. Read and Write tool results display syntax-highlighted code with line numbers and a language badge derived from file extension
  3. Bash tool calls display the description as a label and the command in a terminal-styled code block
  4. Tool calls not matching Edit/Read/Write/Bash fall back to formatted JSON display
**Plans:** 2/2 plans complete
Plans:
- [ ] 27-01-PLAN.md — LCS diff algorithm and file extension language mapper with tests
- [ ] 27-02-PLAN.md — Tool viewer components (Diff, Code, Bash, JSON) and ToolCallRow dispatcher

### Phase 28: Navigation & Search
**Goal**: Power users can navigate conversations and the app using keyboard-driven workflows
**Depends on**: Phase 26 (stable conversation display), Phase 27 (tool content rendered for search indexing)
**Requirements**: NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. User can press Cmd+F on a conversation page to open in-conversation search with match highlighting, "X of Y" counter, and prev/next navigation
  2. User can press Cmd+K from any page to open a command palette that searches conversations, pages, and actions with fuzzy matching
  3. Keyboard shortcuts work for sidebar toggle (Cmd+B), conversation navigation (J/K), expand/collapse (E), and a cheat sheet (?)
  4. Shortcuts do not fire when focus is inside a text input or textarea
**Plans:** 3/3 plans complete
Plans:
- [ ] 28-01-PLAN.md — Keyboard shortcuts composable, sidebar toggle, J/K/E navigation, cheat sheet
- [ ] 28-02-PLAN.md — In-conversation search via Cmd+F with match highlighting and navigation
- [ ] 28-03-PLAN.md — Command palette via Cmd+K with Fuse.js fuzzy search

### Phase 29: Compaction Detection
**Goal**: Users can see where Claude compacted context during a conversation and understand the token impact
**Depends on**: Phase 25 (clean ingestion pipeline)
**Requirements**: COMP-01, COMP-02
**Success Criteria** (what must be TRUE):
  1. Conversations that underwent compaction show amber boundary markers at the correct position in the turn list
  2. Each compaction marker displays the token delta (e.g., "45k -> 12k, 33k freed")
**Plans:** 2/2 plans complete
Plans:
- [ ] 29-01-PLAN.md — DB schema, parser detection, normalizer, and API for compaction events
- [ ] 29-02-PLAN.md — CompactionDivider component, groupTurns extension, and conversation list indicator

### Phase 30: Subagent Resolution
**Goal**: Users can see what subagents did within Task tool calls without leaving the parent conversation
**Depends on**: Phase 25 (clean ingestion), Phase 29 (compaction signals parsed from JSONL)
**Requirements**: AGENT-01, AGENT-02
**Success Criteria** (what must be TRUE):
  1. Subagent JSONL files are discovered and linked to their parent Task tool calls during ingestion
  2. Task tool call rows display a summary card showing the subagent's tool names, statuses, and files touched
  3. Subagents that failed or were interrupted show a distinct visual indicator
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 25 -> 26 -> 27 -> 28 -> 29 -> 30

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
| 30. Subagent Resolution | v2.0 | 0/? | Not started | - |
