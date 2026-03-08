# Roadmap: Cowboy

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (shipped 2026-03-04)
- ✅ **v1.1 Conversation View Polish** — Phases 10-13 (shipped 2026-03-05)
- ✅ **v1.2 Data Quality & Display Fixes** — Phases 14-16 (shipped 2026-03-05)
- ✅ **v1.3 Bug Fix & Quality Audit** — Phases 17-24 (shipped 2026-03-08)

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
