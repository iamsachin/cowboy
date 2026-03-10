# Cowboy

## What This Is

A localhost analytics dashboard that tracks and visualizes statistics from coding agents — primarily Claude Code and Cursor. It reads local log files, normalizes the data into a unified schema, stores it in SQLite, and presents it through a live-updating Vue 3 dashboard with DaisyUI components. Features realtime message pushing via typed WebSocket events, progressive disclosure conversation views with collapsible response blocks, purpose-built tool viewers (diff, code, terminal), keyboard-driven navigation (Cmd+F search, Cmd+K palette), compaction boundary visualization, subagent resolution with inline summary cards, floating live token usage monitoring, and a collapsible conversation timeline with click-to-scroll navigation. Optionally posts collected data to a configurable remote endpoint.

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

<!-- Shipped in v2.0 -->

- ✓ Always-visible AI response on collapsed groups, user message truncation, semantic colors — v2.0
- ✓ Tool-specific viewers (LCS diff for Edit, code for Read/Write, terminal for Bash) — v2.0
- ✓ Streaming deduplication, compaction detection, subagent resolution — v2.0
- ✓ In-conversation search (Cmd+F), command palette (Cmd+K), keyboard shortcuts — v2.0
- ✓ Code cleanup (getTurnContent bug, dead components, shared CSS, cost formatter consolidation) — v2.0

<!-- Shipped in v2.1 -->

- ✓ Typed WebSocket event infrastructure with conversation-scoped routing — v2.1
- ✓ Realtime message pushing to open conversation pages with scroll preservation — v2.1
- ✓ New conversations auto-appear in list and overview with highlight animation — v2.1
- ✓ Floating live token usage widget with expandable chart and sidebar restore — v2.1
- ✓ Collapsible conversation timeline with click-to-scroll and active event tracking — v2.1

### Active

(None yet — define with next milestone)

### Out of Scope

- Authentication/login — localhost only, machine access = full access
- Mobile app — desktop browser only
- API/webhook intake from agents — read files only
- Electron desktop wrapper — runs as a Node process, accessed via browser
- Real-time agent control — this is read-only analytics, not agent management
- Real-time streaming of active responses — file watcher picks up completed turns within seconds (NOTE: v2.1 adds push of completed turns to open pages, not mid-response streaming)
- Virtualized/windowed rendering — grouped/collapsed view already reduces DOM nodes
- Threaded sub-conversation nesting — creates unnavigable deep nesting; use links instead

## Current Milestone

Planning next milestone. Run `/gsd:new-milestone` to start.

## Context

- Shipped v1.0 MVP (2026-03-04): 9 phases, 24 plans, full analytics dashboard
- Shipped v1.1 Conversation View Polish (2026-03-05): 4 phases, 8 plans, progressive disclosure
- Shipped v1.2 Data Quality & Display Fixes (2026-03-05): 3 phases, 6 plans, ingestion fixes + system message UI
- Shipped v1.3 Bug Fix & Quality Audit (2026-03-08): 8 phases, 21 plans, 67 bugs fixed from UI audit
- Shipped v2.0 UX Overhaul (2026-03-09): 6 phases, 13 plans, tool viewers + navigation + compaction + subagents
- Shipped v2.1 Realtime & Live Insights (2026-03-10): 5 phases, 10 plans, typed WS events + realtime push + token widget + timeline
- Learnings from claude-devtools (matt1398/claude-devtools, 1835+ stars) captured in LEARNINGS.md
- Codebase: ~30,272 LOC (TypeScript + Vue + CSS)
- Tech stack: Vue 3 + Vite + DaisyUI (frontend), Fastify + Node.js (backend), SQLite + Drizzle (storage)
- Monorepo structure: packages/frontend, packages/backend, packages/shared
- Total: 35 phases, 82 plans across 6 milestones

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
| Replace-not-append for streaming content blocks | Matches Claude Code JSONL cumulative format; eliminates phantom duplicates | ✓ Good (v2.0) |
| XML stripping with allowlist SYSTEM_TAG_PATTERN | Preserves legitimate user XML while removing system-injected tags | ✓ Good (v2.0) |
| Hand-rolled LCS diff (~77 lines) with 500-line guard | Avoids external dependency; O(n*m) capped at reasonable size | ✓ Good (v2.0) |
| Component dispatcher pattern for ToolCallRow | v-if chain dispatches to DiffViewer/CodeViewer/BashViewer/JsonFallback; reduced 151→48 lines | ✓ Good (v2.0) |
| Singleton composable for keyboard shortcuts | Ref-counted document listener shared across all page registrations | ✓ Good (v2.0) |
| TreeWalker with text node splitting for search | Preserves DOM structure vs innerHTML replacement for match highlighting | ✓ Good (v2.0) |
| Compaction events as separate table (not message flags) | Clean schema, independent lifecycle from messages | ✓ Good (v2.0) |
| SubagentSummary as JSON column on tool_calls | 1:1 simplicity; avoids separate table + join for inline display | ✓ Good (v2.0) |
| Three-phase subagent matching (agentId → description → position) | Graceful degradation with confidence levels; handles missing metadata | ✓ Good (v2.0) |
| Discriminated union WebSocketEventPayload type | Preserves TypeScript union narrowing for typed event routing | ✓ Good (v2.1) |
| Pre/post snapshot diff for ingestion change detection | Detects granular changes (messages-added, tokens-updated, etc.) without diffing full payloads | ✓ Good (v2.1) |
| on() auto-cleans via onScopeDispose | Consumers don't need explicit WS cleanup; lifecycle-safe | ✓ Good (v2.1) |
| Separate loading/refreshing refs for WS updates | Prevents full-page spinners on live data updates | ✓ Good (v2.1) |
| Singleton useTokenRate composable with module-level dismissed ref | Widget state shared between pill and sidebar without provide/inject | ✓ Good (v2.1) |
| IntersectionObserver for timeline active tracking | Efficient scroll-position-to-event mapping without scroll event handlers | ✓ Good (v2.1) |

---
*Last updated: 2026-03-10 after v2.1 milestone*
