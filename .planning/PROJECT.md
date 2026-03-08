# Cowboy

## What This Is

A localhost analytics dashboard that tracks and visualizes statistics from coding agents — primarily Claude Code and Cursor. It reads local log files, normalizes the data into a unified schema, stores it in SQLite, and presents it through a live-updating Vue 3 dashboard with DaisyUI components. Features progressive disclosure conversation views with collapsible response blocks, per-turn token/cost data, and visual polish (tool icons, model badges). Optionally posts collected data to a configurable remote endpoint.

## Core Value

Give developers a single, unified view of how their coding agents are performing — every conversation, tool call, token, and plan across all agents in one place.

## Requirements

### Validated

<!-- Shipped in v1.0 -->

- ✓ Parse Claude Code JSONL conversation logs from disk — v1.0
- ✓ Parse Cursor local storage/logs from disk — v1.0
- ✓ Normalize agent data into a unified schema — v1.0
- ✓ Store normalized data in SQLite — v1.0
- ✓ Track full conversation history with messages, roles, and timestamps — v1.0
- ✓ Track tool/function calls with inputs, outputs, and durations — v1.0
- ✓ Track token usage per conversation and overall — v1.0
- ✓ Track plans and their execution status — v1.0
- ✓ Live dashboard updates via WebSocket — v1.0
- ✓ Unified overview dashboard with aggregate stats — v1.0
- ✓ Per-agent detail pages with agent-specific stats — v1.0
- ✓ Side-by-side agent comparison view — v1.0
- ✓ Charts and visualizations for usage trends — v1.0
- ✓ Settings page with remote sync configuration — v1.0
- ✓ File watcher for real-time log detection — v1.0

<!-- Shipped in v1.1 -->

- ✓ Group assistant turns into collapsible response blocks — v1.1
- ✓ Progressive disclosure with summary headers (model, tools, duration, tokens, cost) — v1.1
- ✓ Per-turn token counts and estimated cost from backend data — v1.1
- ✓ Type-specific tool call icons and color-coded model badges — v1.1
- ✓ Expand/collapse all toggle for response blocks — v1.1

<!-- Shipped in v1.2 -->

- ✓ Smart title extraction skipping system caveats, interruptions, and slash commands — v1.2
- ✓ Conversation-level model derivation from token usage when NULL — v1.2
- ✓ Cursor assistant content extraction (tool activity summaries) — v1.2
- ✓ Cursor workspace path derivation for project names — v1.2
- ✓ Idempotent startup migrations for retroactive data quality fixes — v1.2
- ✓ System message indicators with expandable categorized content — v1.2
- ✓ Slash command chips and /clear context-reset dividers — v1.2
- ✓ Cursor agent in conversation filter dropdown — v1.2

<!-- Shipped in v1.3 -->

- ✓ Per-model cost calculation in multi-model conversations — v1.3
- ✓ Accurate cost sort, formatCost utility with conditional precision — v1.3
- ✓ Duration from message span, timezone-safe heatmap, NULL-model backfill — v1.3
- ✓ System messages don't break turn grouping, standard chevron direction — v1.3
- ✓ Load-more pagination for large conversations — v1.3
- ✓ Clean titles, DOMPurify search, API-driven filters, loading indicators — v1.3
- ✓ Plan title heuristics, word-boundary completion matching, re-ingestion updates — v1.3
- ✓ Heatmap legend, theme-aware charts, 404 route, sidebar persistence — v1.3
- ✓ Toast feedback, countdown confirmation, refresh modal — v1.3
- ✓ 67 UI audit bugs fixed and browser-verified — v1.3

### Active

(No active requirements — define next milestone with `/gsd:new-milestone`)

### Out of Scope

- Authentication/login — localhost only, machine access = full access
- Mobile app — desktop browser only
- API/webhook intake from agents — read files only
- Electron desktop wrapper — runs as a Node process, accessed via browser
- Real-time agent control — this is read-only analytics, not agent management
- Real-time streaming of active responses — file watcher picks up completed turns within seconds
- Virtualized/windowed rendering — grouped/collapsed view already reduces DOM nodes
- Threaded sub-conversation nesting — creates unnavigable deep nesting; use links instead

## Context

- Shipped v1.0 MVP (2026-03-04): 9 phases, 24 plans, full analytics dashboard
- Shipped v1.1 Conversation View Polish (2026-03-05): 4 phases, 8 plans, progressive disclosure
- Shipped v1.2 Data Quality & Display Fixes (2026-03-05): 3 phases, 6 plans, ingestion fixes + system message UI
- Shipped v1.3 Bug Fix & Quality Audit (2026-03-08): 8 phases, 21 plans, 67 bugs fixed from UI audit
- Codebase: ~21,900 LOC (TypeScript + Vue + CSS)
- Tech stack: Vue 3 + Vite + DaisyUI (frontend), Fastify + Node.js (backend), SQLite + Drizzle (storage)
- Monorepo structure: packages/frontend, packages/backend, packages/shared

## Constraints

- **Tech stack**: Vue 3 + Vite + DaisyUI (frontend), Node.js (backend), SQLite (storage) — user-specified
- **Runtime**: Localhost only — no cloud deployment, no Docker required
- **Data source**: File system reads only — no agent modifications or hooks
- **Platform**: macOS primary (Darwin), but file paths should be configurable for cross-platform support

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vue 3 + Vite + DaisyUI for frontend | User preference, good DX, fast builds, attractive components | ✓ Good |
| Node.js backend (single process) | Simplest architecture — one process serves API + static files | ✓ Good |
| SQLite for storage | Embedded, zero-config, good for queries and aggregation on local data | ✓ Good |
| Read local files (not API intake) | Passive collection, no agent configuration needed | ✓ Good |
| WebSocket for live updates | Real-time dashboard without polling overhead | ✓ Good |
| No authentication | Localhost-only app, machine access implies authorization | ✓ Good |
| Full historical data | Parse everything available, no retention cutoff | ✓ Good |
| messageId-based grouping for tool calls | More reliable than timestamp proximity matching | ✓ Good (v1.1) |
| details/summary for nested collapsibles | DaisyUI checkbox collapse has nesting bugs | ✓ Good (v1.1) |
| reactive Map for collapse state | Vue 3 intercepts Map operations, controlled state vs checkbox DOM | ✓ Good (v1.1) |
| SUM GROUP BY messageId for per-message tokens | Accurate per-turn data from actual tokenUsage table | ✓ Good (v1.1) |
| oklch soft-tint colors for model badges | Consistent, accessible color scheme across themes | ✓ Good (v1.1) |
| Shared title-utils module for cross-normalizer skip logic | Both normalizers need identical skip rules; DRY | ✓ Good (v1.2) |
| Idempotent startup migration pattern | Runs every ingestion cycle, no one-time flag needed | ✓ Good (v1.2) |
| In-flow expansion for SystemMessageIndicator | Avoids z-index issues inside scroll container vs absolute dropdown | ✓ Good (v1.2) |
| groupTurns handles all message classification | Removed filteredMessages/clear slicing from ConversationDetail; single source of truth | ✓ Good (v1.2) |
| JS-based cost sort instead of SQL subquery | Avoids duplicating MODEL_PRICING in SQL CASE expressions | ✓ Good (v1.3) |
| Per-model secondary query for conversation list costs | Multi-model accuracy without changing primary query shape | ✓ Good (v1.3) |
| Duration from message span (firstMessageAt/lastMessageAt) | JSONL lacks execution time data; message timestamps are ground truth | ✓ Good (v1.3) |
| DOMPurify with ALLOWED_TAGS: ['mark'] for search | Replaces regex sanitizer; secure HTML handling for highlighted snippets | ✓ Good (v1.3) |
| Delete-then-insert for plan re-ingestion | Replaces onConflictDoNothing which silently skipped updates | ✓ Good (v1.3) |
| CSS custom properties for theme-aware charts | getChartThemeColors() utility reads DaisyUI oklch vars at render time | ✓ Good (v1.3) |
| Singleton useToast composable | Module-level ref shared across all components without provide/inject | ✓ Good (v1.3) |

---
*Last updated: 2026-03-08 after v1.3 milestone*
