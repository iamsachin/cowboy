# Milestones: Cowboy

## v1.3 — Bug Fix & Quality Audit

**Shipped:** 2026-03-08
**Phases:** 17–24 (8 phases, 21 plans)
**Requirements:** 67/67 satisfied (COST-01–06, DATA-01–09, CONV-01–09, LIST-01–10, PLAN-01–10, ANLYT-01–08, XCUT-01–08, PAGE-01–07)
**Source:** 54-bug UI audit (2026-03-08)

Fixed all bugs from comprehensive UI audit across every page:
- Fixed critical cost calculation — per-model pricing in multi-model conversations, accurate cost sort, shared formatCost utility with conditional precision
- Fixed data accuracy — duration from message span (not metadata), timezone-safe heatmap, NULL-model backfill from token usage records
- Fixed conversation display — system messages no longer break turn grouping, standard chevron direction, load-more pagination for large conversations
- Fixed conversation list — cleanTitle sanitization, DOMPurify search snippets, API-driven filters, loading indicators, local timezone dates
- Fixed plan extraction — meaningful title heuristics, correct list merge boundaries, word-boundary completion matching, delete-then-insert re-ingestion
- Added cross-cutting polish — 404 catch-all route, sidebar collapse persistence, theme-aware chart colors via CSS custom properties
- Added Settings UX — toast feedback system, countdown confirmation for destructive Clear, modal confirmation for Refresh All, tokenUsage stat display
- Browser-verified all fixes across every page with no regressions

**Key stats:**
- 35 commits, 94 files changed, +5,036/-546 lines
- Codebase: ~21,900 LOC (TypeScript + Vue + CSS)
- Completed in 1 day (all 8 phases executed 2026-03-08)

---

## v1.2 — Data Quality & Display Fixes

**Shipped:** 2026-03-05
**Phases:** 14–16 (3 phases, 6 plans)
**Requirements:** 10/10 satisfied (TITLE-01–03, MODEL-01–02, CURSOR-01–03, MSG-01–02)

Fixed data quality gaps in ingestion and added visual distinction for system content:
- Smart title extraction skipping system caveats, interruption notices, and slash commands
- Conversation-level model derivation from token usage when NULL; Cursor "default" → "unknown"
- Cursor assistant content extraction with tool activity summaries instead of "Empty response"
- Cursor workspace path derivation for meaningful project names (not literal "Cursor")
- Startup migrations retroactively fixing existing data for both Claude Code and Cursor
- System message indicators (expandable pills with category badges)
- Slash command chips with terminal icon and /clear context-reset dividers

**Key stats:**
- 20 commits, 26 files changed, +3,158/-436 lines
- Codebase: ~21,000 LOC (TypeScript + Vue + CSS)

---

## v1.1 — Conversation View Polish

**Shipped:** 2026-03-05
**Phases:** 10–13 (4 phases, 8 plans)
**Requirements:** 11/11 satisfied (GROUP-01–06, META-01–04, UX-01)

Overhauled the conversation detail view with progressive disclosure:
- Grouped assistant messages + tool calls into typed Turn objects with orphan handling
- Two-level collapsible interface with summary headers (model, tool count, duration, tokens, cost)
- Per-turn token counts and estimated cost from backend SUM GROUP BY messageId
- Type-specific tool call icons (8 types) and color-coded model badges with oklch CSS
- Expand/collapse all toggle with reactive Map state management
- Sticky toolbar for conversation navigation

**Key stats:**
- 20 commits, 33 files changed, +2,638/-146 lines
- Codebase: 18,181 LOC (TypeScript + Vue + CSS)
- Tech debt: 5 minor items (orphaned TurnCard.vue, stale verification report)

---

## v1.0 — Core Analytics Dashboard

**Shipped:** 2026-03-04
**Phases:** 1–9 (all complete)
**Plans:** 24/24

Built the full Cowboy analytics dashboard from scratch:
- Monorepo with Fastify backend, Vue 3/DaisyUI frontend, SQLite/Drizzle storage
- Claude Code and Cursor ingestion with unified schema
- REST API with token/cost analytics, conversation browser, tool call analytics
- Real-time file watching with WebSocket live updates
- Advanced analytics (projections, heatmap, model distribution, per-project grouping)
- Plan tracking with heuristic extraction
- Settings page with remote sync configuration

**Key stats:**
- 9 phases, 24 plans, ~124min total execution time
- 6 quick tasks for post-v1.0 polish
