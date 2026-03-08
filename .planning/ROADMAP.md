# Roadmap: Cowboy

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (shipped 2026-03-04)
- ✅ **v1.1 Conversation View Polish** — Phases 10-13 (shipped 2026-03-05)
- ✅ **v1.2 Data Quality & Display Fixes** — Phases 14-16 (shipped 2026-03-05)
- 🚧 **v1.3 Bug Fix & Quality Audit** — Phases 17-24 (in progress)

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

### v1.3 Bug Fix & Quality Audit (In Progress)

**Milestone Goal:** Fix all bugs from the 2026-03-08 UI audit — cost calculation errors, data accuracy issues, display bugs, and cross-cutting quality problems. Tests for all fixes.

- [x] **Phase 17: Cost Calculation Fixes** — Fix critical cost pricing, sorting, formatting, and token counting errors (completed 2026-03-08)
- [x] **Phase 18: Data Accuracy Fixes** — Fix backend data computation: durations, timestamps, model backfill, tool stats, and timezone issues (completed 2026-03-08)
- [x] **Phase 19: Conversation Display Fixes** — Fix turn grouping, tool call display, system message handling, and scroll behavior in conversation detail (completed 2026-03-08)
- [x] **Phase 20: Conversation List Fixes** — Fix titles, sorting, filtering, search, and formatting in the conversation list view (completed 2026-03-08)
- [x] **Phase 21: Plan Extraction Quality** — Fix plan title heuristics, merge logic, completion matching, and status display (completed 2026-03-08)
- [x] **Phase 22: Analytics & Agent Pages** — Fix heatmap legend, agent filters, Cursor data display, and comparison card styling (completed 2026-03-08)
- [x] **Phase 23: Cross-Cutting Polish** — Fix routing, theme awareness, dead code, and type safety across the codebase (completed 2026-03-08)
- [ ] **Phase 24: Overview, Settings & Final Verification** — Fix overview KPIs, settings UX, and browser-verify all v1.3 fixes

## Phase Details

### Phase 17: Cost Calculation Fixes
**Goal**: Users see accurate cost data everywhere in the application
**Depends on**: Nothing (independent bug fixes, highest priority)
**Requirements**: COST-01, COST-02, COST-03, COST-04, COST-05, COST-06
**Success Criteria** (what must be TRUE):
  1. Multi-model conversations show correct per-model cost (not averaged across all tokens)
  2. Sorting conversations by cost produces the correct order matching displayed values
  3. Conversation header cost shows meaningful precision (not $0.00 for sub-cent costs)
  4. Token totals do not double-count cache tokens — input, output, and cache are reported separately
  5. A single formatCost() utility is used across all cost displays with consistent formatting
**Plans**: 2 plans
Plans:
- [ ] 17-01-PLAN.md — Fix multi-model cost calculation, cost sort, and create shared formatCost utility
- [ ] 17-02-PLAN.md — Fix frontend cost display precision, token totals, and unify formatCost usage

### Phase 18: Data Accuracy Fixes
**Goal**: Backend computations produce correct durations, timestamps, model attribution, and tool statistics
**Depends on**: Nothing (independent backend fixes)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, DATA-09
**Success Criteria** (what must be TRUE):
  1. Cursor conversations never show "Jan 1 1970" or zero-timestamp dates
  2. Conversation duration reflects actual message span (first to last message), not metadata artifact
  3. NULL-model conversations show the correct model derived from their token usage records
  4. Tool call analytics exclude null-status calls from success rate and distinguish user rejections from errors
  5. Heatmap and timeseries data align with the user's local timezone with no off-by-one day shifts
**Plans**: 3 plans
Plans:
- [ ] 18-01-PLAN.md — Fix Cursor timestamp fallback, duration calculation, turn count label, and NULL-model backfill
- [ ] 18-02-PLAN.md — Fix tool duration display, null-status handling, and ExitPlanMode rejection classification
- [ ] 18-03-PLAN.md — Fix heatmap timezone consistency and timeseries timestamp source alignment

### Phase 19: Conversation Display Fixes
**Goal**: Conversation detail view renders all message types correctly with proper grouping and usable scroll behavior
**Depends on**: Phase 17 (cost formatting utilities used in display)
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-07, CONV-08, CONV-09
**Success Criteria** (what must be TRUE):
  1. System messages between assistant turns do not break turn grouping — assistant blocks remain contiguous
  2. Zero tool calls are not displayed; preview shows "Assistant response" when there is no text and no tools
  3. Chevron points right when collapsed and down when expanded (standard convention)
  4. System-injected messages (skill prompts, context) are detected and hidden by default with opt-in visibility
  5. Large conversations (100+ turns) remain navigable via pagination or virtualization with max-height scroll on expanded blocks
**Plans**: 3 plans
Plans:
- [ ] 19-01-PLAN.md — Fix turn grouping (system messages breaking assistant groups), isSystemInjected null/empty handling, and skill prompt detection
- [ ] 19-02-PLAN.md — Fix zero tool call display, preview fallback text, chevron direction, and max-height scroll
- [ ] 19-03-PLAN.md — Add frontend load-more pagination for large conversations

### Phase 20: Conversation List Fixes
**Goal**: Conversation list view displays clean data with working sort, filter, and search
**Depends on**: Phase 17 (cost formatting), Phase 18 (data accuracy)
**Requirements**: LIST-01, LIST-02, LIST-03, LIST-04, LIST-05, LIST-06, LIST-07, LIST-08, LIST-09, LIST-10
**Success Criteria** (what must be TRUE):
  1. Conversation titles are cleaned (no markdown artifacts, no raw system text) and model names show tooltips when truncated
  2. Sorting by tokens and cost columns produces correct order matching displayed values; unsupported sort columns are disabled
  3. Project filter dropdown shows all projects from the API, not a hardcoded subset
  4. Search shows results with sanitized snippets (DOMPurify), visual debounce affordance, and correct zebra striping
  5. Pagination and sort changes show a loading indicator; dates display in local timezone
**Plans**: 3 plans
Plans:
- [ ] 20-01-PLAN.md — Extend backend sort mapping for all 8 columns and add /analytics/filters endpoint
- [ ] 20-02-PLAN.md — Debounced search UX, DOMPurify snippet sanitization, inline snippet layout
- [ ] 20-03-PLAN.md — Apply cleanTitle, model tooltips, loading indicator, local timezone dates, wire filter API

### Phase 21: Plan Extraction Quality
**Goal**: Plan extraction produces meaningful titles, correct merge boundaries, and accurate completion status
**Depends on**: Nothing (independent backend + frontend fixes)
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, PLAN-07, PLAN-08, PLAN-09, PLAN-10
**Success Criteria** (what must be TRUE):
  1. Plan titles use meaningful heuristics (heading context, conversation title) — no raw text excerpts or markdown artifacts
  2. Separate numbered lists in a response are not incorrectly merged into one plan
  3. Completion matching uses word boundaries and raised thresholds to avoid false positives
  4. Re-ingestion updates existing plan data instead of skipping; sort columns map to correct backend params
  5. "Not started" and "unknown" plan statuses are visually distinct; KPI cards omit empty description divs
**Plans**: 3 plans
Plans:
- [ ] 21-01-PLAN.md — Fix plan-extractor title stripping, list merge logic, action verb threshold, and completion matching
- [ ] 21-02-PLAN.md — Fix re-ingestion to delete+insert and expand sort column mapping
- [ ] 21-03-PLAN.md — Fix status badge styling, KPI empty description, sort param mapping, and local dates

### Phase 22: Analytics & Agent Pages
**Goal**: Analytics dashboards and agent pages show accurate data with proper filtering and theme-consistent styling
**Depends on**: Phase 18 (data accuracy for analytics)
**Requirements**: ANLYT-01, ANLYT-02, ANLYT-03, ANLYT-04, ANLYT-05, ANLYT-06, ANLYT-07, ANLYT-08
**Success Criteria** (what must be TRUE):
  1. Activity heatmap has a visible color scale legend explaining intensity values
  2. Agent filter dropdown is populated from the API; Compare tab skips unnecessary analytics API calls
  3. Cursor agent pages show accurate token/cost data or a clear "Data unavailable" state — no misleading zeros
  4. KPI descriptions show contextual text based on actual data, not hardcoded "Awaiting data"
  5. ComparisonCard and Compare tab use theme colors and appropriate icons (not hardcoded inline styles)
**Plans**: 2 plans
Plans:
- [ ] 22-01-PLAN.md — Add heatmap color legend, API-driven agent filter, Compare tab icon fix, and API optimization
- [ ] 22-02-PLAN.md — Add Cursor data unavailable states, contextual KPI descriptions, and ComparisonCard theming

### Phase 23: Cross-Cutting Polish
**Goal**: Routing, theming, and code quality issues fixed across the entire codebase
**Depends on**: Nothing (independent infrastructure fixes)
**Requirements**: XCUT-01, XCUT-02, XCUT-03, XCUT-04, XCUT-05, XCUT-06, XCUT-07, XCUT-08
**Success Criteria** (what must be TRUE):
  1. Navigating to an unknown URL shows a 404 page instead of a blank screen
  2. Sidebar collapsed state persists across page reloads via localStorage
  3. DateRangeFilter, chart colors, and ChatMessage all use DaisyUI theme variables — no hardcoded dark-mode colors
  4. TurnCard.vue dead code is deleted; model badge regex uses word boundary matching
  5. Plan API response TypeScript type is correct and matches actual backend response shape
**Plans**: 2 plans
Plans:
- [ ] 23-01-PLAN.md — Add 404 route, persist sidebar state, delete dead code, fix model badge regex and plan API type
- [ ] 23-02-PLAN.md — Theme-aware charts via shared utility, fix DateRangeFilter and ChatMessage theming

### Phase 24: Overview, Settings & Final Verification
**Goal**: Overview and Settings pages are polished, and all v1.3 fixes are browser-verified
**Depends on**: Phases 17-23 (all fixes landed)
**Requirements**: PAGE-01, PAGE-02, PAGE-03, PAGE-04, PAGE-05, PAGE-06, PAGE-07
**Success Criteria** (what must be TRUE):
  1. Overview KPIs show the active date filter context; table columns are consistent with the Conversations page
  2. Empty state shows a friendly message instead of zeroed-out KPI cards
  3. Settings save shows a success toast; Danger Zone confirm has a countdown timer; Refresh has a confirmation dialog
  4. Database stats section displays tokenUsage record count
  5. All v1.3 fixes verified in browser — no regressions from previous milestones
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24

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
| 17. Cost Calculation Fixes | 2/2 | Complete    | 2026-03-08 | - |
| 18. Data Accuracy Fixes | 3/3 | Complete    | 2026-03-08 | - |
| 19. Conversation Display Fixes | 3/3 | Complete    | 2026-03-08 | - |
| 20. Conversation List Fixes | 3/3 | Complete    | 2026-03-08 | - |
| 21. Plan Extraction Quality | 3/3 | Complete    | 2026-03-08 | - |
| 22. Analytics & Agent Pages | 2/2 | Complete    | 2026-03-08 | - |
| 23. Cross-Cutting Polish | 2/2 | Complete   | 2026-03-08 | - |
| 24. Overview, Settings & Final Verification | v1.3 | 0/? | Not started | - |
