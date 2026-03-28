# Requirements: Cowboy

**Defined:** 2026-03-28
**Core Value:** Give developers a single, unified view of how their coding agents are performing

## v3.1 Requirements

Requirements for removing Cursor support. Each maps to roadmap phases.

### Ingestion

- [x] **ING-01**: Cursor parser module (cursor_parser.rs) is fully removed
- [x] **ING-02**: Cursor normalizer module (cursor_normalizer.rs) is fully removed
- [x] **ING-03**: Cursor file discovery module (cursor_file_discovery.rs) is fully removed
- [x] **ING-04**: Cursor processing removed from main ingestion pipeline (mod.rs)
- [x] **ING-05**: Cursor-specific data migrations removed (fix_cursor_projects, fix_cursor_messages)

### Watcher

- [x] **WATCH-01**: Cursor variant removed from AgentKind enum
- [x] **WATCH-02**: vscdb file detection and Cursor debounce timer removed from watcher

### Settings

- [x] **SET-01**: cursor_path, cursor_enabled, sync_cursor removed from DB schema and settings API
- [x] **SET-02**: Cursor path validation and default path logic removed
- [x] **SET-03**: Cursor section removed from SettingsPage UI

### Frontend

- [x] **UI-01**: Cursor removed from agent constants (colors, labels, theme classes, AGENTS array)
- [x] **UI-02**: Cursor tab and comparison data removed from AgentsPage
- [x] **UI-03**: Cursor-specific computed properties and data fetching removed from useAgentComparison
- [x] **UI-04**: Cursor settings fields removed from useSettings composable

### Pricing

- [x] **PRICE-01**: Cursor-specific model aliases and OpenAI model pricing removed

### Data

- [x] **DATA-01**: Startup migration deletes all conversations with agent='cursor' and their related records

### Architecture

- [x] **ARCH-01**: Agent field in conversations table remains generic (not hardcoded to single agent)
- [x] **ARCH-02**: Analytics queries handle single-agent gracefully (no empty comparison errors)

## Future Requirements

None — this is a cleanup milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Adding new agent support | Future milestone — architecture stays open but no new agents added now |
| Refactoring agent abstraction layer | Existing trait-based approach is sufficient; don't over-engineer |
| Removing "agent" column from DB | Keep generic schema for future agent additions |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 41 | Complete |
| ING-01 | Phase 42 | Complete |
| ING-02 | Phase 42 | Complete |
| ING-03 | Phase 42 | Complete |
| ING-04 | Phase 42 | Complete |
| ING-05 | Phase 42 | Complete |
| WATCH-01 | Phase 43 | Complete |
| WATCH-02 | Phase 43 | Complete |
| PRICE-01 | Phase 43 | Complete |
| SET-01 | Phase 44 | Complete |
| SET-02 | Phase 44 | Complete |
| SET-03 | Phase 44 | Complete |
| UI-01 | Phase 45 | Complete |
| UI-02 | Phase 45 | Complete |
| UI-03 | Phase 45 | Complete |
| UI-04 | Phase 45 | Complete |
| ARCH-01 | Phase 46 | Complete |
| ARCH-02 | Phase 46 | Complete |

**Coverage:**
- v3.1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after roadmap creation*
