# Requirements: Cowboy v1.1

**Defined:** 2026-03-05
**Core Value:** Give developers a single, unified view of how their coding agents are performing — every conversation, tool call, token, and plan across all agents in one place.

## v1.1 Requirements

Requirements for conversation view polish milestone. Each maps to roadmap phases.

### Response Grouping

- [x] **GROUP-01**: User sees all items in an assistant turn (output, thinking, tool calls) grouped into a single collapsible response block
- [x] **GROUP-02**: User sees the main agent output text without expanding the response block
- [x] **GROUP-03**: User sees a summary header on each collapsed block showing model name, tool call count, duration, and timestamp
- [x] **GROUP-04**: User can expand a response block to see thinking content as a collapsible section inside the group
- [x] **GROUP-05**: User can expand a response block to see a list of tool call rows (name, status, duration)
- [x] **GROUP-06**: User can expand an individual tool call row to see its input/output details

### Metadata Display

- [x] **META-01**: User sees per-turn input/output/cache token counts in the response block summary header
- [x] **META-02**: User sees estimated cost per assistant turn in the summary header
- [x] **META-03**: User sees distinct icons per tool call type (Read=file, Bash=terminal, Edit=pencil, Write=file-plus, Grep=search, Glob=folder-search, Agent=bot, WebSearch=globe)
- [x] **META-04**: User sees color-coded model name badges in the summary header

### UX Controls

- [x] **UX-01**: User can expand or collapse all response blocks with a single toggle button

## Future Requirements

Deferred to v1.1.x or later.

### Visual Polish

- **POLISH-01**: Duration bar visualization showing relative tool call duration
- **POLISH-02**: Anchor links per response block for deep-linking to specific turns

### Power User

- **POWER-01**: Keyboard navigation between response blocks (arrow keys, Enter to expand)
- **POWER-02**: Sub-conversation linking for Agent tool calls (navigate to child conversation)
- **POWER-03**: Block-level search/filter by keyword, tool type, or model

## Out of Scope

| Feature | Reason |
|---------|--------|
| Editable/replayable conversations | Cowboy is read-only analytics, not an agent client |
| Real-time streaming of active responses | File watcher picks up completed turns within seconds; streaming adds massive complexity |
| Inline search within conversation | Browser Ctrl+F sufficient; collapsed content is intentionally hidden |
| Syntax highlighting for tool call I/O JSON | Large payloads cause rendering jank; plain `pre` with Copy button sufficient |
| Virtualized/windowed rendering | Grouped/collapsed view already reduces DOM nodes; defer unless performance issues arise |
| Threaded sub-conversation nesting | Creates unnavigable deep nesting; use links instead |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GROUP-01 | Phase 10 | Complete |
| GROUP-02 | Phase 10 | Complete |
| GROUP-03 | Phase 11 | Complete |
| GROUP-04 | Phase 11 | Complete |
| GROUP-05 | Phase 11 | Complete |
| GROUP-06 | Phase 11 | Complete |
| META-01 | Phase 12 | Complete |
| META-02 | Phase 12 | Complete |
| META-03 | Phase 13 | Complete |
| META-04 | Phase 13 | Complete |
| UX-01 | Phase 11 | Complete |

**Coverage:**
- v1.1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
