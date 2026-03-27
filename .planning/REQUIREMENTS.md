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

- [ ] **WATCH-01**: Cursor variant removed from AgentKind enum
- [ ] **WATCH-02**: vscdb file detection and Cursor debounce timer removed from watcher

### Settings

- [ ] **SET-01**: cursor_path, cursor_enabled, sync_cursor removed from DB schema and settings API
- [ ] **SET-02**: Cursor path validation and default path logic removed
- [ ] **SET-03**: Cursor section removed from SettingsPage UI

### Frontend

- [ ] **UI-01**: Cursor removed from agent constants (colors, labels, theme classes, AGENTS array)
- [ ] **UI-02**: Cursor tab and comparison data removed from AgentsPage
- [ ] **UI-03**: Cursor-specific computed properties and data fetching removed from useAgentComparison
- [ ] **UI-04**: Cursor settings fields removed from useSettings composable

### Pricing

- [ ] **PRICE-01**: Cursor-specific model aliases and OpenAI model pricing removed

### Data

- [x] **DATA-01**: Startup migration deletes all conversations with agent='cursor' and their related records

### Architecture

- [ ] **ARCH-01**: Agent field in conversations table remains generic (not hardcoded to single agent)
- [ ] **ARCH-02**: Analytics queries handle single-agent gracefully (no empty comparison errors)

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
| WATCH-01 | Phase 43 | Pending |
| WATCH-02 | Phase 43 | Pending |
| PRICE-01 | Phase 43 | Pending |
| SET-01 | Phase 44 | Pending |
| SET-02 | Phase 44 | Pending |
| SET-03 | Phase 44 | Pending |
| UI-01 | Phase 45 | Pending |
| UI-02 | Phase 45 | Pending |
| UI-03 | Phase 45 | Pending |
| UI-04 | Phase 45 | Pending |
| ARCH-01 | Phase 46 | Pending |
| ARCH-02 | Phase 46 | Pending |

**Coverage:**
- v3.1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after roadmap creation*
