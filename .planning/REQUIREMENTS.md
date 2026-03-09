# Requirements: Cowboy

**Defined:** 2026-03-09
**Core Value:** Give developers a single, unified view of how their coding agents are performing

## v2.0 Requirements

Requirements for the v2.0 UX Overhaul milestone. Each maps to roadmap phases.

### Data Quality

- [x] **DATA-01**: Streaming entries deduplicated by requestId so token counts reflect final values only
- [x] **DATA-02**: Parser content blocks use replace-not-append to eliminate phantom duplicate tool calls
- [x] **DATA-03**: getTurnContent passes sanitized (XML-stripped) content to parseContent instead of raw content

### Conversation Display

- [ ] **DISP-01**: User can see the last AI text response on collapsed assistant groups without expanding
- [ ] **DISP-02**: User messages longer than 500 characters are truncated with a "Show more" toggle
- [ ] **DISP-03**: Thinking blocks, tool calls, and tool results have distinct semantic color tints (purple/amber/green/red)

### Tool Viewers

- [ ] **TOOL-01**: Edit tool calls display a line-level LCS diff with red/green highlighting, line numbers, and +N/-M stats
- [ ] **TOOL-02**: Read/Write tool results display syntax-highlighted code with line numbers and language badge from file extension
- [ ] **TOOL-03**: Bash tool calls display description as label and command in terminal-styled code block
- [ ] **TOOL-04**: Tool input rendering dispatches by tool name (Edit->diff, Read->code, Bash->terminal, others->JSON fallback)

### Navigation & Search

- [ ] **NAV-01**: User can search within a conversation via Cmd+F with match highlighting and "X of Y" navigation
- [ ] **NAV-02**: User can open a command palette via Cmd+K to jump to conversations, pages, or actions
- [ ] **NAV-03**: Keyboard shortcuts work for common actions (Cmd+B sidebar, J/K navigation, E expand/collapse, ? cheat sheet)

### Compaction Detection

- [ ] **COMP-01**: Compaction boundaries detected during ingestion from JSONL compaction signals
- [ ] **COMP-02**: Compaction boundaries render as amber markers with token delta ("45k -> 12k, 33k freed")

### Subagent Resolution

- [ ] **AGENT-01**: Subagent JSONL files discovered and linked to parent Task tool calls via three-phase matching
- [ ] **AGENT-02**: Subagent execution traces display as summary cards within Task tool call rows (tool names, statuses, files touched)

### Code Cleanup

- [x] **CLEAN-01**: Unused ToolCallCard.vue removed
- [x] **CLEAN-02**: Duplicated markdown CSS extracted to shared file
- [x] **CLEAN-03**: Inconsistent cost formatters consolidated into single utility

## Future Requirements

Deferred to v3+. Tracked but not in current roadmap.

### Advanced Display

- **VSCROLL-01**: Virtual scrolling for conversation display with variable-height items
- **PANE-01**: Multi-pane split view for side-by-side conversation comparison
- **CTX-01**: Context window reconstruction across 7 token categories

### Theming

- **THEME-01**: Light/dark/system theme toggle with CSS variable approach

### Organization

- **PIN-01**: Session pinning and hiding for conversation management

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time streaming display | File watcher picks up completed turns within seconds; marginal analytics value |
| Monaco/CodeMirror editors | 1-3MB bundle for read-only display; highlight.js + CSS counters suffice |
| Full recursive subagent rendering | Deep nesting creates unnavigable UI; flat summary cards instead |
| Character-level diffs | Line-level is the right granularity for code edits; character-level adds noise |
| FTS5 full-text search | Title-only search via existing API + Fuse.js; add FTS5 only if latency exceeds 200ms |
| Virtual scrolling | Collapse pattern already manages DOM size; variable-height virtualization is buggy |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 25 | Complete |
| DATA-02 | Phase 25 | Complete |
| DATA-03 | Phase 25 | Complete |
| DISP-01 | Phase 26 | Pending |
| DISP-02 | Phase 26 | Pending |
| DISP-03 | Phase 26 | Pending |
| TOOL-01 | Phase 27 | Pending |
| TOOL-02 | Phase 27 | Pending |
| TOOL-03 | Phase 27 | Pending |
| TOOL-04 | Phase 27 | Pending |
| NAV-01 | Phase 28 | Pending |
| NAV-02 | Phase 28 | Pending |
| NAV-03 | Phase 28 | Pending |
| COMP-01 | Phase 29 | Pending |
| COMP-02 | Phase 29 | Pending |
| AGENT-01 | Phase 30 | Pending |
| AGENT-02 | Phase 30 | Pending |
| CLEAN-01 | Phase 25 | Complete |
| CLEAN-02 | Phase 25 | Complete |
| CLEAN-03 | Phase 25 | Complete |

**Coverage:**
- v2.0 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*
