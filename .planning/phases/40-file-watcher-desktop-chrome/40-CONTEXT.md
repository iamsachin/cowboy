# Phase 40: File Watcher + Desktop Chrome - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up file watching (notify crate) to trigger automatic ingestion on file changes, add system tray with close-to-tray behavior, add native menu bar (About, Quit, Edit with copy/paste), and remove the Node.js backend entirely — making `cargo tauri dev` the only way to run the app.

</domain>

<decisions>
## Implementation Decisions

### Server port
- Default port: 8123 (not 3000 or 3001 — user has other apps on 3000)
- Port 8123 used always (both dev and production builds)
- Configurable via Settings page in UI (new field in settings table)
- Port change shows toast notification: "Port changed. Restart app to apply."
- Update CSP connect-src in tauri.conf.json for :8123
- Update Vite proxy target to :8123

### System tray
- Cowboy hat silhouette as monochrome template image (~22x22pt, single color)
- macOS auto-handles light/dark menu bar adaptation
- Static icon — no status animation or badge
- Context menu: Show + Quit (no separator, no pause)
- Show: brings main window to front
- Quit: exits app completely (stops file watchers, closes connections)

### Close-to-tray behavior
- Closing the window hides the app (window hidden, not destroyed)
- File watching continues in background
- Tray "Show" restores the window
- App only fully exits via tray Quit or native menu Quit

### Native menu bar
- App name menu: About (shows Tauri about dialog) + Quit
- Edit menu: Undo, Redo, Cut, Copy, Paste, Select All (standard macOS edit shortcuts)
- No custom menus beyond these standard items

### Node.js cleanup
- Delete packages/backend entirely (full removal, not archive)
- Merge packages/shared types into packages/frontend/src/types/ (eliminate shared package)
- Delete diff-backends.sh and related migration testing scripts
- Remove `pnpm dev` command — `cargo tauri dev` is the only entry point
- Update pnpm-workspace.yaml to remove backend and shared packages
- Clean up root package.json scripts

### File watcher
- notify crate watches Claude Code and Cursor log directories
- Debounce: 1s for Claude Code (.jsonl changes), 3s for Cursor (state.vscdb)
- Only watch enabled agents (respect claudeCodeEnabled/cursorEnabled settings toggles)
- Claude Code: watch ~/.claude/projects/ (or custom path from settings), depth 5, filter .jsonl files
- Cursor: watch ~/Library/Application Support/Cursor/User/globalStorage/, depth 0, filter state.vscdb

### Watcher-settings integration
- Settings path change → auto-restart file watcher with new paths + trigger full re-ingestion
- Settings agent toggle change → restart watcher (add/remove agent watcher accordingly)
- Broadcast settings:changed WebSocket event on path/toggle changes (already wired in Phase 38)

### 501 stub resolution
- Wire up POST /settings/refresh-db → triggers run_ingestion() (no longer 501)
- Leave POST /settings/test-sync and POST /settings/sync-now as 501 (remote sync out of scope for v3.0)

### Claude's Discretion
- notify crate configuration (polling vs native events, recursive watch settings)
- Tray icon generation approach (SVG to PNG conversion, asset pipeline)
- Shared types migration strategy (bulk move vs incremental)
- File watcher module structure within src-tauri/src/
- How to pass watcher handle to settings routes for restart capability

</decisions>

<specifics>
## Specific Ideas

- User has a custom app icon (cowboy robot with hat, glowing cyan eyes, dark background) — use this for dock icon, derive silhouette for tray
- Port 8123 chosen specifically because user runs other apps on :3000
- Full Node.js removal is a clean break — no archives, no reference scripts
- Future agents (Gemini CLI, Codex, OpenCode) will be added in later phases — the enable/disable toggle pattern should be extensible

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- packages/backend/src/plugins/file-watcher.ts: Node.js reference implementation with chokidar, debounce, settings-aware restart
- src-tauri/src/ingestion/mod.rs: `run_ingestion()` function ready to be called by file watcher
- src-tauri/src/ingestion/file_discovery.rs: `discover_jsonl_files()` for Claude Code
- src-tauri/src/ingestion/cursor_file_discovery.rs: `discover_cursor_db()` for Cursor
- src-tauri/src/websocket.rs: `broadcast_event()` for WebSocket notifications
- src-tauri/src/settings.rs: Settings routes that need watcher restart wiring

### Established Patterns
- AppState (Arc<AppStateInner>) with db + broadcast::Sender — file watcher needs access to both
- `spawn_auto_ingest()` in server.rs already spawns async ingestion on startup — replace with file watcher
- Module per domain with `pub fn routes()` pattern
- db.call(|conn| { ... }).await? for async database access

### Integration Points
- lib.rs: Add tray, menu, and close-to-tray behavior in Tauri setup
- server.rs: Change port from 3001 to 8123 (or settings value), spawn file watcher instead of auto-ingest
- tauri.conf.json: Update CSP for :8123, add tray plugin features
- Cargo.toml: Add `notify` crate, enable Tauri tray-icon and menu features
- settings.rs: Wire PUT handlers to restart file watcher and trigger re-ingestion
- packages/frontend/vite.config.ts: Update proxy target from :3001 to :8123

</code_context>

<deferred>
## Deferred Ideas

- Support for additional agents (Gemini CLI, Codex, OpenCode) — future phase, the per-agent enable/disable pattern should be extensible for this
- Distributable .dmg installer — out of scope for v3.0
- Pause/resume file watching from tray menu — not needed, keep tray minimal

</deferred>

---

*Phase: 40-file-watcher-desktop-chrome*
*Context gathered: 2026-03-11*
