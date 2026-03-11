# Requirements: Cowboy

**Defined:** 2026-03-11
**Core Value:** Give developers a single, unified view of how their coding agents are performing

## v3.0 Requirements

Requirements for Tauri v2 desktop app with Rust backend. Each maps to roadmap phases.

### Foundation

- [x] **FOUND-01**: Tauri v2 project scaffolded with native macOS window chrome loading Vue frontend
- [x] **FOUND-02**: Axum HTTP server starts on 127.0.0.1:3000 inside Tauri process
- [x] **FOUND-03**: CSP configured to allow DaisyUI inline styles, localhost API, and WebSocket
- [x] **FOUND-04**: rusqlite opens existing SQLite database with tokio-rusqlite for async access

### API

- [x] **API-01**: All conversation list/detail read endpoints ported to axum
- [ ] **API-02**: All analytics endpoints ported (token stats, cost stats, heatmap, model distribution)
- [ ] **API-03**: Plan tracking endpoints ported
- [ ] **API-04**: Settings read/write endpoints ported
- [ ] **API-05**: Database clear and refresh-all write endpoints ported
- [ ] **API-06**: JSON responses match Node.js backend (verified by diff testing)

### Realtime

- [ ] **RT-01**: WebSocket endpoint with typed event protocol matching existing discriminated union
- [ ] **RT-02**: Conversation-scoped event routing (new messages, token updates)
- [ ] **RT-03**: New conversation discovery events pushed to connected clients

### Ingestion

- [ ] **ING-01**: Claude Code JSONL parser ported to Rust (messages, tool calls, tokens, plans)
- [ ] **ING-02**: Compaction detection and subagent resolution ported
- [ ] **ING-03**: Cursor vscdb parser ported (messages, tool calls, workspace paths)
- [ ] **ING-04**: Ingestion orchestrator with snapshot diffing for change detection
- [ ] **ING-05**: Parsed data matches Node.js output (verified by row-level SQLite diff)

### File Watcher

- [ ] **WATCH-01**: notify crate watches Claude Code and Cursor log directories
- [ ] **WATCH-02**: Debounced events trigger ingestion (no duplicate processing)

### Desktop

- [ ] **DESK-01**: System tray icon with context menu (Show/Quit)
- [ ] **DESK-02**: Close-to-tray behavior (closing window hides app, tray stays)
- [ ] **DESK-03**: Minimal native menu bar (app name menu: About, Quit, Edit menu for copy/paste)

## Future Requirements

### Distribution

- **DIST-01**: Distributable .dmg installer for macOS
- **DIST-02**: Auto-update mechanism via Tauri updater plugin
- **DIST-03**: Code signing for macOS Gatekeeper

### Enhanced Desktop

- **EDESK-01**: Global keyboard shortcut to show/hide app
- **EDESK-02**: Deep link URL scheme (cowboy://) to open conversations
- **EDESK-03**: OS notifications for new conversation detection

## Out of Scope

| Feature | Reason |
|---------|--------|
| Electron | Chose Tauri v2 + Rust for smaller footprint and learning |
| Mobile app | Desktop only |
| Tauri IPC replacing HTTP | Axum preserves 30K LOC frontend unchanged |
| Authentication | Localhost only, machine access = full access |
| Windows/Linux support | macOS only for v3.0 |
| Remote sync rewrite | Settings endpoint preserved but remote posting deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 36 | Complete |
| FOUND-02 | Phase 36 | Complete |
| FOUND-03 | Phase 36 | Complete |
| FOUND-04 | Phase 36 | Complete |
| API-01 | Phase 37 | Complete |
| API-02 | Phase 37 | Pending |
| API-03 | Phase 37 | Pending |
| API-04 | Phase 38 | Pending |
| API-05 | Phase 38 | Pending |
| API-06 | Phase 38 | Pending |
| RT-01 | Phase 38 | Pending |
| RT-02 | Phase 38 | Pending |
| RT-03 | Phase 38 | Pending |
| ING-01 | Phase 39 | Pending |
| ING-02 | Phase 39 | Pending |
| ING-03 | Phase 39 | Pending |
| ING-04 | Phase 39 | Pending |
| ING-05 | Phase 39 | Pending |
| WATCH-01 | Phase 40 | Pending |
| WATCH-02 | Phase 40 | Pending |
| DESK-01 | Phase 40 | Pending |
| DESK-02 | Phase 40 | Pending |
| DESK-03 | Phase 40 | Pending |

**Coverage:**
- v3.0 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after roadmap creation*
