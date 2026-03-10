# Feature Research

**Domain:** Tauri v2 desktop app port -- Rust backend replacing Node.js/Fastify for a coding agent analytics dashboard
**Researched:** 2026-03-11
**Confidence:** HIGH

## Context

This research covers the v3.0 Tauri Desktop App milestone. The existing web app (~30,272 LOC) has a fully functional Vue 3 + DaisyUI frontend that must load unchanged in a Tauri webview. The backend (~6,155 lines of TypeScript across 34 files) must be rewritten in Rust. The scope covers: (A) mapping every TypeScript backend module to its Rust equivalent, (B) Tauri v2 desktop features (tray, menu, close-to-tray, webview loading), and (C) expected behavior for each feature.

**Already built (frontend stays unchanged):**
- Vue 3 + DaisyUI frontend on Vite (port 5173 dev, built to dist/)
- All UI components, keyboard shortcuts, command palette, tool viewers
- WebSocket client, fetch-based API calls to /api/* endpoints

**Key architectural decision:** The Rust backend runs an embedded axum HTTP server on localhost. The Vue frontend in the Tauri webview connects to it over HTTP/WebSocket -- identical to how it talks to Fastify today. Zero frontend changes needed.

## Feature Landscape

### Table Stakes (Users Expect These)

Everything the existing app does is table stakes. This is a port, not a new product. Any missing feature is a regression.

#### A. Rust Backend -- Module-by-Module Port Map

| TS Module | TS Lines | Rust Crate/Module | Complexity | Dependencies | Notes |
|-----------|----------|-------------------|------------|--------------|-------|
| **db/schema.ts** | 107 | SQL CREATE TABLE in migrations/ | LOW | rusqlite | 8 tables: conversations, messages, tool_calls, token_usage, plans, plan_steps, compaction_events, ingested_files, settings. Drizzle schema is a 1:1 mapping to DDL. Write raw SQL. |
| **db/index.ts** | 31 | `db::pool` module -- `r2d2_sqlite::SqliteConnectionManager` | LOW | r2d2, rusqlite | Wrap connection in pool. Single-connection pool is fine for localhost. Enables safe sharing across tokio tasks. |
| **db/migrate.ts** | 8 | `db::migrate` -- run embedded SQL at startup | LOW | rusqlite | `CREATE TABLE IF NOT EXISTS` for all tables. Run once at app boot before server starts. |
| **db/queries/analytics.ts** | 1,029 | `queries::analytics` module | HIGH | rusqlite, serde | **Largest module.** 10 functions: getOverviewStats, getTimeSeries, getModelDistribution, getToolStats, getHeatmapData, getProjectStats, getConversationList, getConversationDetail, getFilterOptions, getTokenRate. Each builds dynamic SQL with optional WHERE clauses for date range, agent, project filters. Port as parameterized SQL strings with conditional appends. The SQL itself transfers nearly verbatim from Drizzle's generated output. |
| **db/queries/plans.ts** | 307 | `queries::plans` module | MEDIUM | rusqlite, serde | 5 functions: getPlanList, getPlanDetail, getPlanStats, getPlanTimeSeries, getPlansByConversation. Same dynamic SQL pattern as analytics. |
| **db/queries/settings.ts** | 105 | `queries::settings` module | LOW | rusqlite, serde | getSettings (auto-seeds default row), updateAgentSettings, updateSyncSettings, updateSyncStatus. Single-row CRUD operations. |
| **ingestion/claude-code-parser.ts** | 302 | `ingestion::claude_code_parser` | MEDIUM | serde_json, std::io::BufReader | Line-by-line JSONL parsing. Read file, split by newline, parse each line as JSON. Extract conversation structure (messages, tool calls, token usage). Rust serde_json + BufReader is a natural fit and will be significantly faster. |
| **ingestion/normalizer.ts** | 377 | `ingestion::normalizer` | MEDIUM | serde, custom structs | Converts raw parsed Claude Code data into normalized schema structs (NormalizedData: conversation, messages, tool_calls, token_usage, compaction_events). Pure data transformation. Title extraction, model derivation, streaming deduplication, XML stripping. |
| **ingestion/cursor-parser.ts** | 133 | `ingestion::cursor_parser` | MEDIUM | rusqlite | Opens Cursor's state.vscdb (a SQLite database in globalStorage), reads composer rows and bubble data. rusqlite handles this natively -- open a second read-only connection to Cursor's DB. |
| **ingestion/cursor-normalizer.ts** | 381 | `ingestion::cursor_normalizer` | MEDIUM | serde | Normalizes Cursor bubbles into the same NormalizedData shape. Assistant content extraction, workspace path derivation. |
| **ingestion/cursor-file-discovery.ts** | 31 | `ingestion::cursor_discovery` | LOW | dirs, std::fs | Finds Cursor's globalStorage path: `~/Library/Application Support/Cursor/User/globalStorage` on macOS. Use `dirs` crate for platform-safe home directory. |
| **ingestion/file-discovery.ts** | 133 | `ingestion::file_discovery` | LOW | walkdir | Recursively discovers JSONL files under `~/.claude/projects`. Identifies subagent files by path structure. Use `walkdir` crate for recursive directory traversal. Detect `subagents/` path segment for subagent identification. |
| **ingestion/index.ts** | 661 | `ingestion::engine` | HIGH | All ingestion modules, rusqlite, tokio | **Integration hub.** Orchestrates: discover files, check mtime cache (ingested_files table), parse, normalize, snapshot DB state, insert in transaction, diff snapshots for WS events, subagent linking (2 phases), Cursor ingestion, mark stale conversations. This is the most complex module -- port as a single `run_ingestion()` async fn. |
| **ingestion/plan-extractor.ts** | 296 | `ingestion::plan_extractor` | MEDIUM | regex | Extracts numbered plan steps from assistant message content using regex patterns. Infers step completion by cross-referencing later messages and tool calls. Rust regex crate is well-suited. |
| **ingestion/subagent-linker.ts** | 179 | `ingestion::subagent_linker` | MEDIUM | -- | Three-phase matching: (1) filesystem path for parent-child linking, (2) agentId matching, (3) description/position heuristics. Pure logic, no external dependencies. |
| **ingestion/subagent-summarizer.ts** | 86 | `ingestion::subagent_summarizer` | LOW | serde_json | Extracts summary stats (tool counts, token totals, duration) from parsed subagent data. Simple aggregation. |
| **ingestion/compaction-utils.ts** | 44 | `ingestion::compaction_utils` | LOW | serde_json | Detects compaction events in JSONL data by checking for summary-type entries. |
| **ingestion/migration.ts** | 499 | `ingestion::data_migration` | MEDIUM | rusqlite | Idempotent data quality fixes run at each ingestion: title cleanup, model backfill, Cursor project fixes, content deduplication, stale link clearing. Port as raw SQL UPDATE statements. Runs in a transaction. |
| **ingestion/title-utils.ts** | 88 | `ingestion::title_utils` | LOW | regex | Skip logic for system caveats, interruptions, slash commands during title extraction. String pattern matching. |
| **ingestion/id-generator.ts** | 13 | `ingestion::id_gen` | LOW | sha2 | Deterministic ID generation: SHA-256 hash of concatenated input strings. Use `sha2` crate. |
| **ingestion/types.ts** | 93 | `ingestion::types` | LOW | serde | Type definitions become Rust structs with `#[derive(Serialize, Deserialize)]`. DiscoveredFile, IngestionStats, IngestionStatus, NormalizedData. |
| **routes/analytics.ts** | 130 | `routes::analytics` | LOW | axum | 10 thin handler functions. Parse query parameters, call query module, return JSON. axum extractors (`Query<>`, `Path<>`) make this concise. |
| **routes/plans.ts** | 82 | `routes::plans` | LOW | axum | 5 handlers. Same thin-wrapper pattern. |
| **routes/settings.ts** | 258 | `routes::settings` | LOW | axum, tokio | 10 handlers including validate-path (async fs check), test-sync (reqwest POST), clear-db, refresh-db, db-stats. Slightly more logic than other routes because of path validation and sync testing. |
| **routes/health.ts** | 24 | `routes::health` | LOW | axum, rusqlite | Single endpoint: `SELECT 1` to verify DB connection. |
| **plugins/websocket.ts** | 52 | `ws::broadcast` module | MEDIUM | axum (WebSocket), tokio | WebSocket upgrade handler at `/api/ws`. Maintain `Arc<RwLock<Vec<SplitSink>>>` for connected clients. `broadcast_event()` serializes payload and sends to all. Sequence counter for ordering. axum has built-in WebSocket support via `ws::WebSocketUpgrade`. |
| **plugins/file-watcher.ts** | 227 | `watcher` module | MEDIUM | notify, tokio | Watch directories for file changes. Two watchers with different debounce timers: Claude Code (1s for JSONL changes), Cursor (3s for state.vscdb changes). `notify` crate is the standard Rust file watcher. Use tokio timers for debounce. Must support restart with new paths from settings. |
| **plugins/sync-scheduler.ts** | 270 | `sync` module | MEDIUM | reqwest, tokio | Periodic sync to remote endpoint. Exponential backoff retry (3 retries, 5s-60s). tokio::time::interval for scheduling. reqwest for HTTP POST. Read settings from DB for URL/frequency/categories. Build incremental payload from sync cursor. |
| **plugins/cors.ts** | ~15 | tower-http `CorsLayer` | LOW | tower-http | Dev-mode only. `CorsLayer::permissive()` or specific origin. |
| **plugins/static.ts** | ~15 | Not needed | -- | -- | Tauri handles serving frontend assets directly. No static file serving needed in the Rust backend. |
| **shared/types/pricing.ts** | 77 | `pricing` module | LOW | -- | Static `MODEL_PRICING` HashMap + `calculate_cost()` function. Direct port of the pricing table. No external dependencies. |
| **shared/types/websocket-events.ts** | 66 | `events` module | LOW | serde | TypeScript discriminated union becomes Rust enum: `#[serde(tag = "type")] enum WebSocketEvent { ConversationChanged {...}, ConversationCreated {...}, SystemFullRefresh {...} }`. |
| **app.ts** | 65 | `main.rs` / `lib.rs` + Tauri setup | MEDIUM | axum, tauri, tokio | Wire axum router with all routes, spawn server on tokio runtime from Tauri's `setup()` hook. This is the integration point. |

**Total backend TypeScript to port: ~5,800 lines across 30+ files. Estimated Rust output: 4,000-5,000 lines.**

#### B. Tauri Desktop Shell Features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Native macOS window chrome** | Desktop app must have native traffic lights and window behavior, not look like a web page in a frame | LOW | Default Tauri v2 behavior. `decorations: true` in tauri.conf.json. Tauri uses WKWebView on macOS which provides native window controls automatically. |
| **Dock icon** | macOS apps always appear in the Dock when running | LOW | Automatic with Tauri. Provide a 512x512 PNG icon set in `tauri.conf.json > bundle > icon`. Tauri generates all required sizes. |
| **System tray icon with menu** | Always-running analytics app needs persistent presence in menu bar | MEDIUM | Enable `tray-icon` feature in Cargo.toml: `tauri = { features = ["tray-icon", "image-png"] }`. Create `TrayIconBuilder` in setup with menu: "Show Cowboy", separator, "Quit". Left-click shows/focuses window. |
| **Minimal native menu bar** | macOS apps require an app menu for Cmd+Q to work and app name to display correctly | LOW | Tauri v2 `Menu` API. First submenu becomes app menu on macOS (automatic). Items: `.about()`, `.separator()`, `.hide()`, `.hide_others()`, `.show_all()`, `.separator()`, `.quit()`. Must add Edit submenu for Cmd+C/V/X clipboard. |
| **Close-to-tray** | Window close should hide (not quit) so file watcher and ingestion keep running in background | MEDIUM | In Tauri's `on_window_event`, handle `WindowEvent::CloseRequested`: call `window.hide().unwrap()` and `event.prevent_close()`. Tray "Show" calls `window.show()` + `window.set_focus()`. Cmd+Q via menu should actually quit. |
| **Vue frontend in webview (dev)** | Developer workflow: Vite HMR, fast iteration | LOW | Set `devUrl: "http://localhost:5173"` in tauri.conf.json. `beforeDevCommand: "cd packages/frontend && npm run dev"`. Tauri dev server proxies to Vite. |
| **Vue frontend in webview (prod)** | Production build: frontend embedded in binary | LOW | Set `frontendDist: "../packages/frontend/dist"` in tauri.conf.json. `beforeBuildCommand: "cd packages/frontend && npm run build"`. Assets bundled into the Tauri binary. |
| **Embedded axum server** | REST API and WebSocket must be reachable from the webview | MEDIUM | Spawn axum on `127.0.0.1:3000` from Tauri's `setup()` hook using `tauri::async_runtime::spawn()`. Frontend connects to `http://localhost:3000/api/*`. Server runs on tokio runtime alongside Tauri event loop. |

### Differentiators (Competitive Advantage)

Features the desktop form factor enables that the browser version cannot provide.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Reduced memory footprint** | WKWebView uses ~60-80% less memory than a Chrome tab with equivalent content | LOW | Automatic benefit of Tauri over browser. No implementation work. |
| **Single process architecture** | No separate terminal needed to start backend. One app, one process, everything wired together | LOW | Inherent to the Tauri + embedded axum design. Users just launch the app. |
| **Window state persistence** | Remember window size/position across restarts | LOW | Save bounds to a JSON file in Tauri's `app_data_dir` on window move/resize. Restore on next launch. Defer to v3.1. |
| **Auto-start on login** | Analytics always running, never miss data from overnight sessions | LOW | macOS LaunchAgent plist. Not part of Tauri. Defer to v3.1. |
| **Native notifications** | Alert on cost thresholds or long-running conversations | MEDIUM | Tauri v2 notification plugin. Defer to future. |
| **Tray tooltip with live stats** | "Cowboy -- 3 active, 12.4k tok/min" in menu bar tooltip | LOW | Periodic fetch from token-rate API. `tray.set_tooltip()`. Defer to v3.1. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Tauri IPC commands replacing REST API** | "Native IPC is faster than HTTP" | Requires rewriting every frontend `fetch()` call to use `invoke()`. ~50+ API calls in the Vue app would need migration. HTTP on localhost adds <1ms latency -- imperceptible. | Keep axum REST API. Frontend stays 100% unchanged. The Vue app does not know it is in Tauri. |
| **SQLite via tauri-plugin-sql** | "Use the official plugin" | Designed for simple KV storage, not 1,029-line analytics query modules with dynamic WHERE clauses, GROUP BY, aggregations, and subqueries. | Use rusqlite directly. Full SQL control, easy port from Drizzle-generated queries. |
| **Diesel or SeaORM** | "ORMs are safer" | The existing queries use dynamic filter composition (optional date range, agent, project, search). ORMs add compile-time overhead and fight dynamic query building. rusqlite with parameterized SQL is simpler to port from Drizzle. | Raw rusqlite with `params![]` and SQL string building. |
| **Rewrite frontend for Tauri invoke()** | "Full native experience" | 30,000 LOC Vue frontend works perfectly. Rewriting API layer is weeks of work with zero user-visible benefit. | Frontend unchanged. It talks HTTP/WS to localhost axum. |
| **Multiple windows** | "Open conversations in separate windows" | Adds Tauri multi-window state management complexity. Single window with Vue router is simpler and already works. | Single window, Vue router handles all navigation. |
| **Distributable .dmg / auto-updater** | Standard for desktop apps | PROJECT.md explicitly out of scope. Personal use only. Adds code signing, notarization, Sparkle integration. | Run from source: `cargo tauri dev` or `cargo tauri build`. |
| **Global shortcuts** | "Cmd+Shift+C to toggle from anywhere" | Conflicts with other apps, requires accessibility permissions on macOS. Out of scope per PROJECT.md. | Dock icon click and tray icon click are sufficient. |

## Feature Dependencies

```
[SQLite schema + migrations]
    |
    v
[rusqlite connection pool]
    |
    +-------> [Query modules: analytics(10), plans(5), settings(3)]
    |              |
    |              v
    |         [axum route handlers (~30 endpoints)]
    |              |
    |              v
    |         [axum Router assembled]  <-----+
    |              |                         |
    |              v                         |
    |         [WebSocket broadcast module]   |
    |              ^                         |
    |              |                         |
    +-------> [Ingestion engine] ------------+
    |              ^           |
    |              |           v
    |              |     [Parsers: claude-code, cursor]
    |              |           |
    |              |           v
    |              |     [Normalizers: claude-code, cursor]
    |              |           |
    |              |           v
    |              |     [Subagent linker + summarizer]
    |              |           |
    |              |           v
    |              |     [Plan extractor]
    |              |
    +-------> [File watcher (notify crate)]
    |
    +-------> [Sync scheduler (reqwest + tokio)]
    |
    +-------> [Pricing/cost calculation]

[Tauri app setup]
    |
    +-------> [Spawn axum server in setup() hook]
    |              |
    |              v
    |         [Frontend webview loads after server ready]
    |
    +-------> [TrayIcon + menu]
    |              |
    |              v
    |         [Close-to-tray behavior]
    |
    +-------> [App menu bar (About, Quit, Edit)]
    |
    +-------> [Window configuration (decorations, size, icon)]
```

### Dependency Notes

- **Schema must exist before anything runs:** Migrations are the first thing executed at startup.
- **Query modules depend on schema:** They issue SQL against the tables.
- **Route handlers depend on query modules:** Thin wrappers that call query functions.
- **WebSocket module is bidirectional:** Routes and ingestion both need it. Build it independently, inject via shared state.
- **Ingestion depends on parsers, normalizers, and DB:** The integration hub that ties parsing to storage.
- **File watcher triggers ingestion:** Debounced file change events call `run_ingestion()`.
- **axum server must start before webview loads:** Tauri setup() spawns the server, frontend connects on load.
- **Close-to-tray requires tray icon:** The tray provides the "Show" action to restore the hidden window.
- **Pricing module is standalone:** No dependencies. Used by frontend (shared types) and could be used by backend queries.

## MVP Definition

### Launch With (v3.0)

This is a complete port. Every feature below is required for functional parity.

**Rust Backend (all P1):**
- [ ] SQLite schema creation + rusqlite connection pool
- [ ] Analytics query module (10 functions, 1029 TS lines)
- [ ] Plans query module (5 functions, 307 TS lines)
- [ ] Settings query module (CRUD, 105 TS lines)
- [ ] Claude Code JSONL parser (302 TS lines)
- [ ] Claude Code normalizer (377 TS lines)
- [ ] Cursor SQLite parser (133 TS lines)
- [ ] Cursor normalizer (381 TS lines)
- [ ] File discovery -- both agents (164 TS lines)
- [ ] Ingestion engine orchestrator (661 TS lines)
- [ ] Plan extractor + step inference (296 TS lines)
- [ ] Subagent linker + summarizer (265 TS lines)
- [ ] Data quality migration (499 TS lines)
- [ ] ID generator, title utils, compaction utils (145 TS lines)
- [ ] Type definitions as Rust structs (159 TS lines)
- [ ] axum route handlers -- 30 endpoints across 4 route files (494 TS lines)
- [ ] WebSocket broadcast server (52 TS lines)
- [ ] File watcher with per-agent debounce (227 TS lines)
- [ ] Sync scheduler with retry (270 TS lines)
- [ ] Pricing table + cost calculation (77 TS lines)
- [ ] CORS middleware (dev mode only)

**Tauri Desktop Shell (all P1):**
- [ ] Tauri v2 project scaffolding with src-tauri/
- [ ] Native macOS window with decorations
- [ ] Embedded axum server spawned from setup() hook
- [ ] System tray icon with Show/Quit menu
- [ ] Close-to-tray (hide on X, restore on tray/dock click)
- [ ] Minimal menu bar (About, Quit, Edit for clipboard)
- [ ] Dev mode: Vite dev server proxy
- [ ] Production mode: bundled frontend assets

### Add After Validation (v3.x)

- [ ] Window state persistence (save/restore bounds)
- [ ] Tray tooltip with live stats
- [ ] Auto-start on login (LaunchAgent plist)
- [ ] Backend health self-check with tray status indicator

### Future Consideration (v4+)

- [ ] Cross-platform builds (Linux, Windows)
- [ ] Native notifications for cost/duration thresholds
- [ ] Distributable .dmg (if ever shared)
- [ ] Additional agent support (Windsurf, Copilot)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| SQLite schema + connection | HIGH | LOW | P1 |
| Analytics queries (10 fns) | HIGH | HIGH | P1 |
| Ingestion engine | HIGH | HIGH | P1 |
| Claude Code parser + normalizer | HIGH | MEDIUM | P1 |
| Cursor parser + normalizer | HIGH | MEDIUM | P1 |
| axum route handlers (30) | HIGH | LOW | P1 |
| WebSocket broadcast | HIGH | MEDIUM | P1 |
| File watcher (notify) | HIGH | MEDIUM | P1 |
| Tauri window + webview | HIGH | LOW | P1 |
| System tray + close-to-tray | HIGH | MEDIUM | P1 |
| Menu bar | MEDIUM | LOW | P1 |
| Plans queries (5 fns) | MEDIUM | MEDIUM | P1 |
| Settings queries | MEDIUM | LOW | P1 |
| Plan extractor | MEDIUM | MEDIUM | P1 |
| Subagent linker | MEDIUM | MEDIUM | P1 |
| Data quality migration | MEDIUM | MEDIUM | P1 |
| Sync scheduler | LOW | MEDIUM | P1 |
| Pricing calculation | MEDIUM | LOW | P1 |
| Window state persistence | LOW | LOW | P2 |
| Tray tooltip stats | LOW | LOW | P3 |
| Native notifications | LOW | MEDIUM | P3 |

## Tauri Desktop Feature Expected Behaviors

### System Tray Icon
- **Icon**: 22x22 template image (+ @2x for Retina) from app icon, monochrome for macOS menu bar
- **Left-click**: Show and focus the main window (use `set_focus()` not just `show()` -- `show()` raises but does not focus)
- **Right-click**: Context menu appears with "Show Cowboy", separator, "Quit Cowboy"
- **"Show Cowboy" click**: `window.show()` + `window.set_focus()`
- **"Quit Cowboy" click**: `app_handle.exit(0)` -- triggers clean shutdown including file watcher and WS cleanup
- **Implementation**: `TrayIconBuilder::new("main-tray").menu(&menu).on_menu_event(...)` in Tauri `setup()`

### Close-to-Tray
- **Window close button (red X)**: Window hides, app continues running. File watcher, ingestion, WS server all keep operating.
- **Dock icon click (macOS `activate` event)**: Window shows and focuses
- **Tray "Show Cowboy"**: Window shows and focuses
- **Tray "Quit"**: App exits cleanly
- **Cmd+Q**: App exits cleanly (via menu bar quit item, not intercepted)
- **Implementation**: `app.on_window_event(|window, event| { if let WindowEvent::CloseRequested { api, .. } = event { api.prevent_close(); window.hide().unwrap(); } })`

### Menu Bar
- **First submenu** (becomes "Cowboy" menu on macOS automatically):
  - About Cowboy (`.about(None)` -- shows default About dialog)
  - Separator
  - Hide Cowboy (Cmd+H) (`.hide()`)
  - Hide Others (Cmd+Option+H) (`.hide_others()`)
  - Show All (`.show_all()`)
  - Separator
  - Quit Cowboy (Cmd+Q) (`.quit()`)
- **Edit submenu** (required for clipboard to work in webview):
  - Undo (Cmd+Z), Redo (Cmd+Shift+Z), separator, Cut (Cmd+X), Copy (Cmd+C), Paste (Cmd+V), Select All (Cmd+A)
- **No other menus**: This is a single-purpose analytics dashboard, not a document editor.

### Dev Mode vs Production Webview Loading

| Aspect | Dev Mode (`cargo tauri dev`) | Production (`cargo tauri build`) |
|--------|------------------------------|----------------------------------|
| Frontend source | Vite dev server at http://localhost:5173 | Bundled into binary from `packages/frontend/dist` |
| tauri.conf.json `devUrl` | `"http://localhost:5173"` | Not used |
| tauri.conf.json `frontendDist` | Not used during dev | `"../packages/frontend/dist"` |
| axum server | Spawned on 127.0.0.1:3000 | Spawned on 127.0.0.1:3000 (same) |
| Hot reload | Vite HMR for Vue components | N/A |
| Rust changes | Tauri CLI watches src-tauri/, auto-rebuilds | N/A |
| `beforeDevCommand` | `"cd packages/frontend && npm run dev"` | N/A |
| `beforeBuildCommand` | N/A | `"cd packages/frontend && npm run build"` |
| Frontend API calls | `fetch("http://localhost:3000/api/...")` | Same -- axum still on 3000 |
| WebSocket | `ws://localhost:3000/api/ws` | Same |

## Complexity Summary by Category

| Category | Modules | TS Lines | Estimated Rust Effort | Rationale |
|----------|---------|----------|-----------------------|-----------|
| Database layer | 6 files | 1,480 | MEDIUM | analytics.ts is 1,029 lines of dynamic SQL. The SQL transfers almost verbatim but building dynamic WHERE clauses in Rust requires careful string/params management. |
| Ingestion engine | 15 files | 3,316 | HIGH | Most complex subsystem. JSONL parsing is straightforward in Rust (serde_json), but the orchestrator (661 lines) coordinates transactions, snapshot diffs, subagent linking across both agents. Well-modularized, but high total volume. |
| Route handlers | 4 files | 494 | LOW | Thin wrappers. axum extractors make these more concise than Fastify equivalents. |
| Server plugins | 3 files | 549 | MEDIUM | WebSocket broadcast, file watcher, sync scheduler all need async Rust (tokio). File watcher with per-agent debounce timers is the trickiest. |
| Shared types | 4 files | 236 | LOW | Rust structs with serde derive. Pricing table is a static HashMap. |
| App bootstrap | 1 file | 65 | MEDIUM | Wiring axum router, spawning in Tauri setup, shared state injection. |
| Tauri desktop | N/A | N/A | MEDIUM | Tray, close-to-tray, menu, webview config. Well-documented patterns. |
| **Total** | **33 files** | **~6,140** | | **Estimated 4,000-5,000 lines of Rust** |

## Sources

- [Tauri v2 System Tray docs](https://v2.tauri.app/learn/system-tray/) -- TrayIconBuilder API, menu events, icon requirements
- [Tauri v2 Window Menu docs](https://v2.tauri.app/learn/window-menu/) -- Menu API, macOS app menu behavior, built-in items
- [Tauri v2 Frontend Configuration](https://v2.tauri.app/start/frontend/) -- devUrl, frontendDist, beforeDevCommand/beforeBuildCommand
- [Tauri v2 Vite integration](https://v2.tauri.app/start/frontend/vite/) -- Vite-specific configuration for Tauri
- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/) -- decorations, titleBarStyle
- [Tauri v2 Configuration reference](https://v2.tauri.app/reference/config/) -- tauri.conf.json schema
- [Tauri close-to-tray discussion](https://github.com/tauri-apps/tauri/discussions/2684) -- prevent_close + window.hide() pattern
- [Tauri v2 tray-icon implementation guide](https://dev.to/rain9/tauri5-tray-icon-implementation-and-event-handling-5d1e) -- complete Rust examples
- [Tauri v2 Multi-Window and System Tray Guide](https://www.oflight.co.jp/en/columns/tauri-v2-multi-window-system-tray) -- comprehensive setup walkthrough

---
*Feature research for: Cowboy v3.0 Tauri Desktop App -- Rust backend port + desktop shell*
*Researched: 2026-03-11*
