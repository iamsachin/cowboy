# Roadmap: Cowboy

## Milestones

- v1.0 MVP - Phases 1-9 (shipped 2026-03-04)
- v1.1 Conversation View Polish - Phases 10-13 (shipped 2026-03-05)
- v1.2 Data Quality & Display Fixes - Phases 14-16 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>v1.0 MVP (Phases 1-9) - SHIPPED 2026-03-04</summary>

- [x] **Phase 1: Project Foundation** - Scaffold the monorepo with Node.js/Fastify backend, Vue 3/DaisyUI frontend, and SQLite/Drizzle schema (completed 2026-03-03)
- [x] **Phase 2: Claude Code Ingestion** - Parse Claude Code JSONL logs into the unified SQLite schema with deduplication
- [x] **Phase 3: API + Core Dashboard** - REST API and overview dashboard with token analytics, cost tracking, and date filtering
- [x] **Phase 4: Conversation Browser** - Browse, search, and inspect full conversation history with messages and tool calls (completed 2026-03-04)
- [x] **Phase 5: Real-Time Updates** - File watching with chokidar and WebSocket live updates to the dashboard
- [x] **Phase 6: Cursor Integration + Agent Comparison** - Parse Cursor data and deliver per-agent pages with side-by-side comparison
- [x] **Phase 7: Advanced Analytics** - Cost projections, tool call analytics, activity heatmap, model distribution, per-project grouping
- [x] **Phase 8: Plan Tracking** - Heuristic plan extraction from conversations with completion status and statistics
- [x] **Phase 9: Settings + Remote Sync** - Settings page with log path config, remote POST endpoint, frequency, and payload selection

</details>

<details>
<summary>v1.1 Conversation View Polish (Phases 10-13) - SHIPPED 2026-03-05</summary>

- [x] **Phase 10: Data Grouping Foundation** - Turn types and messageId-based grouping logic with unit tests (completed 2026-03-04)
- [x] **Phase 11: Core Collapsible UI** - AssistantResponseBlock with progressive disclosure, summary headers, and expand/collapse all (completed 2026-03-05)
- [x] **Phase 12: Token Enrichment** - Backend per-message token data and cost-per-turn display in summary headers (completed 2026-03-05)
- [x] **Phase 13: Visual Polish** - Tool call type icons and color-coded model name badges (completed 2026-03-05)

</details>

### v1.2 Data Quality & Display Fixes (In Progress)

- [ ] **Phase 14: Ingestion Quality** - Fix title extraction and model attribution during backend ingestion
- [ ] **Phase 15: Cursor Data Quality** - Fix Cursor assistant responses, agent filter, and project path display
- [ ] **Phase 16: Message Display** - Visually distinguish system-injected messages and slash commands

## Phase Details

### Phase 14: Ingestion Quality
**Goal**: Conversations have accurate, meaningful titles and correct model attribution
**Depends on**: Nothing (independent backend fixes)
**Requirements**: TITLE-01, TITLE-02, TITLE-03, MODEL-01, MODEL-02
**Success Criteria** (what must be TRUE):
  1. Newly ingested conversations show the first real user message as the title, not system caveats or interruption notices
  2. Conversations with only slash commands or system messages before real content still get a meaningful title from the first substantive user message
  3. Conversations that previously showed NULL model now display the most common model derived from their messages or token usage data
  4. Cursor conversations with "default" model show the actual resolved model name or "unknown" instead of the literal string "default"
**Plans:** 1/2 plans executed
Plans:
- [ ] 14-01-PLAN.md — Shared title skip logic, normalizer updates, and model fallback chains
- [ ] 14-02-PLAN.md — Startup migration to fix existing conversation titles and models

### Phase 15: Cursor Data Quality
**Goal**: Cursor conversations display complete, accurate data comparable to Claude Code conversations
**Depends on**: Phase 14 (model attribution improvements feed into Cursor display)
**Requirements**: CURSOR-01, CURSOR-02, CURSOR-03
**Success Criteria** (what must be TRUE):
  1. Cursor assistant messages show their actual response content in the conversation detail view instead of "Empty response"
  2. The conversation filter dropdown includes "cursor" as a selectable agent alongside "claude-code"
  3. Cursor conversations display the workspace directory path as the project name instead of the literal string "Cursor"
**Plans**: TBD

### Phase 16: Message Display
**Goal**: Users can distinguish system-injected content from their own messages and recognize slash commands at a glance
**Depends on**: Phase 14 (title extraction identifies system messages; display phase styles them)
**Requirements**: MSG-01, MSG-02
**Success Criteria** (what must be TRUE):
  1. System-injected content (caveats, skill instructions, objective blocks) that is stored as role=user appears visually distinct from actual user messages (different styling, label, or visual treatment)
  2. Slash commands (/clear, /gsd:*, etc.) render with distinct styling that differentiates them from regular conversational messages
**Plans**: TBD

## Progress

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
| 14. Ingestion Quality | 1/2 | In Progress|  | - |
| 15. Cursor Data Quality | v1.2 | 0/? | Not started | - |
| 16. Message Display | v1.2 | 0/? | Not started | - |
