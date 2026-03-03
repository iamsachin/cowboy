# Cowboy

## What This Is

A localhost analytics dashboard that tracks and visualizes statistics from coding agents — primarily Claude Code and Cursor. It reads local log files, normalizes the data into a unified schema, stores it in SQLite, and presents it through a live-updating Vue 3 dashboard with DaisyUI components. Optionally posts collected data to a configurable remote endpoint.

## Core Value

Give developers a single, unified view of how their coding agents are performing — every conversation, tool call, token, and plan across all agents in one place.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Parse Claude Code JSONL conversation logs from disk
- [ ] Parse Cursor local storage/logs from disk
- [ ] Normalize agent data into a unified schema (conversations, tool calls, tokens, plans)
- [ ] Store normalized data in SQLite
- [ ] Track full conversation history with messages, roles, and timestamps
- [ ] Track tool/function calls with inputs, outputs, and durations
- [ ] Track token usage (input, output, cache reads/writes) per conversation and overall
- [ ] Track plans and their execution status
- [ ] Live dashboard updates via WebSocket as new data arrives
- [ ] Unified overview dashboard with aggregate stats across all agents
- [ ] Per-agent detail pages (Claude Code, Cursor) with agent-specific stats
- [ ] Side-by-side agent comparison view (token usage, tool calls, success rates, etc.)
- [ ] Charts and visualizations for usage trends over time
- [ ] Settings page with remote URL configuration for periodic data POST
- [ ] Configurable POST frequency in settings (e.g., every 5 min, 15 min, 1 hour)
- [ ] Configurable POST payload — choose which data categories to include
- [ ] Parse all available historical data (no retention limit)
- [ ] File watcher to detect new log entries in real-time
- [ ] Vue 3 + Vite + DaisyUI frontend
- [ ] Node.js (Express/Fastify) backend serving API and static files

### Out of Scope

- Authentication/login — localhost only, machine access = full access
- Mobile app — desktop browser only
- API/webhook intake from agents — read files only
- Electron desktop wrapper — runs as a Node process, accessed via browser
- Real-time agent control — this is read-only analytics, not agent management

## Context

- Claude Code stores conversations as JSONL files in `~/.claude/projects/` with detailed message, tool call, and token metadata
- Cursor stores data in its local application data directory (varies by OS)
- Both agents have different log formats that need normalization into a common schema
- The app runs as a single Node.js process — backend serves both the API and the built Vue frontend
- SQLite is embedded (via better-sqlite3 or similar) — no external database setup needed
- The remote POST feature enables centralized tracking across multiple machines/developers

## Constraints

- **Tech stack**: Vue 3 + Vite + DaisyUI (frontend), Node.js (backend), SQLite (storage) — user-specified
- **Runtime**: Localhost only — no cloud deployment, no Docker required
- **Data source**: File system reads only — no agent modifications or hooks
- **Platform**: macOS primary (Darwin), but file paths should be configurable for cross-platform support

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vue 3 + Vite + DaisyUI for frontend | User preference, good DX, fast builds, attractive components | — Pending |
| Node.js backend (single process) | Simplest architecture — one process serves API + static files | — Pending |
| SQLite for storage | Embedded, zero-config, good for queries and aggregation on local data | — Pending |
| Read local files (not API intake) | Passive collection, no agent configuration needed | — Pending |
| WebSocket for live updates | Real-time dashboard without polling overhead | — Pending |
| No authentication | Localhost-only app, machine access implies authorization | — Pending |
| Full historical data | Parse everything available, no retention cutoff | — Pending |

---
*Last updated: 2026-03-04 after initialization*
