# Requirements: Cowboy

**Defined:** 2026-03-04
**Core Value:** Give developers a single, unified view of how their coding agents are performing — every conversation, tool call, token, and plan across all agents in one place.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data Ingestion

- [x] **INGEST-01**: System parses Claude Code JSONL conversation logs from `~/.claude/projects/`
- [x] **INGEST-02**: System parses Cursor state.vscdb SQLite database for conversation data
- [x] **INGEST-03**: System normalizes both agent formats into a unified schema (conversations, messages, tool_calls, token_usage)
- [x] **INGEST-04**: System watches log directories for new/modified files in real-time via chokidar
- [x] **INGEST-05**: System stores all normalized data in SQLite with deterministic deduplication
- [x] **INGEST-06**: System parses all available historical data with no retention limit

### Token & Cost Analytics

- [x] **TOKEN-01**: User can view token usage per conversation (input, output, cache_read, cache_creation)
- [x] **TOKEN-02**: User can view estimated cost per conversation based on model pricing
- [x] **TOKEN-03**: User can view aggregate token usage and cost across all conversations
- [ ] **TOKEN-04**: User can view cost trend analysis with forward spending projection
- [x] **TOKEN-05**: User can view model distribution breakdown (which models used, how often)

### Tool Call Analytics

- [x] **TOOL-01**: User can view all tool calls within a conversation (name, inputs, outputs)
- [x] **TOOL-02**: User can view tool call success/failure rates per tool name
- [x] **TOOL-03**: User can view tool call frequency and duration statistics

### Dashboard & Visualization

- [x] **DASH-01**: User sees an overview dashboard with KPI cards (total tokens, cost, conversations, active days)
- [x] **DASH-02**: User can view time-series charts for usage trends (daily/weekly/monthly)
- [x] **DASH-03**: User can filter all views by date range (presets + custom picker)
- [x] **DASH-04**: User can view per-agent dashboard pages (Claude Code, Cursor independently)
- [x] **DASH-05**: User can compare agents side-by-side (tokens, cost, tool calls, conversation counts)
- [x] **DASH-06**: User can view activity heatmap showing daily usage patterns (GitHub contribution graph style)
- [x] **DASH-07**: User can view per-project analytics grouped by codebase directory

### Conversation Browser

- [x] **CONV-01**: User can browse a list of conversations sorted by date, filterable by agent and project
- [x] **CONV-02**: User can search conversations by content/metadata
- [x] **CONV-03**: User can view full conversation detail with messages, tool calls, code blocks, and timestamps
- [x] **CONV-04**: User can see which agent and model produced each conversation

### Plan Tracking

- [ ] **PLAN-01**: System extracts multi-step plans from conversation messages using heuristic detection
- [ ] **PLAN-02**: User can view extracted plans and their completion status
- [ ] **PLAN-03**: User can view plan statistics (average steps, completion rates)

### Settings & Remote Sync

- [ ] **SYNC-01**: User can configure a remote URL endpoint for periodic data POST
- [ ] **SYNC-02**: User can set POST frequency (e.g., every 5 min, 15 min, 1 hour)
- [ ] **SYNC-03**: User can choose which data categories to include in each POST
- [ ] **SYNC-04**: User can configure log file paths for each agent in settings

### Real-Time

- [x] **LIVE-01**: Dashboard updates live via WebSocket as new log data is detected
- [x] **LIVE-02**: WebSocket reconnects automatically when connection drops (including background tab recovery)

### Infrastructure

- [x] **INFRA-01**: App runs as a single Node.js process (Fastify backend serving API + static Vue build)
- [x] **INFRA-02**: Vue 3 + Vite + DaisyUI 5 (Tailwind 4) frontend
- [x] **INFRA-03**: SQLite storage with Drizzle ORM

## v2 Requirements

### Notifications

- **NOTF-01**: User receives alerts for cost spikes or unusual usage patterns
- **NOTF-02**: User can configure alert thresholds in settings

### Full-Text Search

- **FTS-01**: User can search across all message content using SQLite FTS5
- **FTS-02**: User can search for specific code snippets across conversations

### Additional Agents

- **AGENT-01**: System supports Copilot conversation data
- **AGENT-02**: System supports Windsurf/Cody conversation data

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time agent control/intervention | Read-only analytics — controlling agents adds massive complexity and security risk |
| Authentication / multi-user | Localhost only — machine access = full access |
| Mobile / responsive design | Desktop browser only — developers at workstations |
| AI-powered insights | Premature for v1 — surface raw data clearly, let developers draw conclusions |
| Plugin/extension system | Use adapter pattern internally — adding agents is code-level work, not config |
| Data retention / cleanup | Parse all available data — SQLite handles large datasets well |
| Electron desktop wrapper | Runs as Node process, accessed via browser |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1: Project Foundation | Complete |
| INFRA-02 | Phase 1: Project Foundation | Complete |
| INFRA-03 | Phase 1: Project Foundation | Complete |
| INGEST-01 | Phase 2: Claude Code Ingestion | Complete |
| INGEST-03 | Phase 2: Claude Code Ingestion | Complete |
| INGEST-05 | Phase 2: Claude Code Ingestion | Complete |
| INGEST-06 | Phase 2: Claude Code Ingestion | Complete |
| DASH-01 | Phase 3: API + Core Dashboard | Complete |
| DASH-02 | Phase 3: API + Core Dashboard | Complete |
| DASH-03 | Phase 3: API + Core Dashboard | Complete |
| TOKEN-01 | Phase 3: API + Core Dashboard | Complete |
| TOKEN-02 | Phase 3: API + Core Dashboard | Complete |
| TOKEN-03 | Phase 3: API + Core Dashboard | Complete |
| CONV-01 | Phase 4: Conversation Browser | Complete |
| CONV-02 | Phase 4: Conversation Browser | Complete |
| CONV-03 | Phase 4: Conversation Browser | Complete |
| CONV-04 | Phase 4: Conversation Browser | Complete |
| INGEST-04 | Phase 5: Real-Time Updates | Complete |
| LIVE-01 | Phase 5: Real-Time Updates | Complete |
| LIVE-02 | Phase 5: Real-Time Updates | Complete |
| INGEST-02 | Phase 6: Cursor Integration + Agent Comparison | Complete |
| DASH-04 | Phase 6: Cursor Integration + Agent Comparison | Complete |
| DASH-05 | Phase 6: Cursor Integration + Agent Comparison | Complete |
| TOKEN-04 | Phase 7: Advanced Analytics | Pending |
| TOKEN-05 | Phase 7: Advanced Analytics | Complete |
| TOOL-01 | Phase 7: Advanced Analytics | Complete |
| TOOL-02 | Phase 7: Advanced Analytics | Complete |
| TOOL-03 | Phase 7: Advanced Analytics | Complete |
| DASH-06 | Phase 7: Advanced Analytics | Complete |
| DASH-07 | Phase 7: Advanced Analytics | Complete |
| PLAN-01 | Phase 8: Plan Tracking | Pending |
| PLAN-02 | Phase 8: Plan Tracking | Pending |
| PLAN-03 | Phase 8: Plan Tracking | Pending |
| SYNC-01 | Phase 9: Settings + Remote Sync | Pending |
| SYNC-02 | Phase 9: Settings + Remote Sync | Pending |
| SYNC-03 | Phase 9: Settings + Remote Sync | Pending |
| SYNC-04 | Phase 9: Settings + Remote Sync | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after roadmap creation*
