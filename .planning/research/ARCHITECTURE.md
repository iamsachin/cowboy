# Architecture Patterns

**Domain:** Desktop analytics app -- Tauri v2 wrapping existing Vue 3 + Vite monorepo with Rust backend replacing Node.js/Fastify
**Researched:** 2026-03-11
**Confidence:** HIGH

## Current Architecture (Baseline)

```
cowboy/                          (monorepo root)
  packages/
    frontend/                    Vue 3 + Vite on :5173 (dev), builds to dist/
    backend/                     Fastify + Node.js on :3000, SQLite via better-sqlite3/Drizzle
    shared/                      TypeScript types consumed by both
  package.json                   pnpm workspace root, concurrently dev script
```

Key facts that constrain the Tauri migration:
1. Frontend uses bare `fetch('/api/*')` across 17 composable files -- 25 REST endpoints, all relative URLs
2. WebSocket connects to `ws://${location.host}/api/ws` -- rich typed event system with seq-based gap detection, discriminated union payloads, `onScopeDispose` auto-cleanup
3. Vite proxies `/api/*` to `:3000` in dev -- frontend never hardcodes a backend URL
4. In production, Fastify serves Vue dist/ via `@fastify/static` with SPA fallback to `index.html`
5. Backend manages file watchers (chokidar), SQLite (better-sqlite3), ingestion pipeline (15 modules), and sync scheduler

## Target Architecture with Tauri v2 + Rust

```
cowboy/                          (monorepo root -- unchanged)
  packages/
    frontend/                    (Vue 3 + Vite -- UNCHANGED)
    shared/                      (TypeScript types -- UNCHANGED)
    backend/                     (Node.js/Fastify -- KEPT during migration, REMOVED after)
  src-tauri/                     (NEW -- Tauri v2 shell + Rust backend)
    Cargo.toml
    Cargo.lock
    tauri.conf.json
    capabilities/
      default.json
    icons/
    build.rs
    src/
      main.rs                    Desktop entry point
      lib.rs                     App setup, plugin registration, axum spawn
      state.rs                   Shared AppState (DB pool + broadcast channel)
      commands/                  Tauri IPC command handlers (2-3 only)
        mod.rs
      server/                    Axum HTTP + WS server
        mod.rs                   Router assembly, server spawn
        routes/
          analytics.rs           11 GET endpoints
          plans.rs               5 GET endpoints
          settings.rs            8 GET/PUT/POST/DELETE endpoints
          health.rs              1 GET endpoint
          ingest.rs              1 POST endpoint
        ws.rs                    WebSocket upgrade + broadcast
        static_files.rs          Serve Vue dist/ with SPA fallback
      db/
        mod.rs                   rusqlite connection pool (r2d2)
        migrations.rs            Schema creation and migrations
        queries/
          analytics.rs
          plans.rs
          settings.rs
      ingestion/
        mod.rs                   Orchestrator: discover + parse + store + emit events
        claude_code_parser.rs    JSONL parsing
        cursor_parser.rs         vscdb parsing
        normalizer.rs            Unified schema normalization
        plan_extractor.rs
        subagent_linker.rs
        subagent_summarizer.rs
        title_utils.rs
      watcher/
        mod.rs                   notify crate file watcher with debouncing
```

### Why src-tauri at Monorepo Root (Not Inside packages/)

Tauri expects `src-tauri/` as a sibling of the frontend source. The `tauri.conf.json` references `frontendDist` as a relative path (`../packages/frontend/dist`). Placing it at root:

1. Keeps the existing `packages/` structure untouched -- no moves, no broken imports
2. Follows Tauri convention (official docs, every Tauri tutorial assumes this layout)
3. Makes `cargo tauri dev` and `cargo tauri build` work without custom path overrides
4. Cargo workspace and pnpm workspace coexist -- different manifest files, no conflict

Do NOT put `src-tauri` inside `packages/`. Tauri CLI locates the project by searching for `tauri.conf.json`, and nested placement creates friction with both the Tauri CLI and the pnpm workspace.

### Why the Rust Backend Lives INSIDE src-tauri (Not as a Separate Crate)

The Rust backend is not a standalone service -- it only runs when the Tauri app runs. Making it a separate Cargo workspace member adds complexity (cross-crate state sharing, separate build targets) with zero benefit. The axum server, database layer, ingestion engine, and file watcher are all modules within the `src-tauri` crate. They share the same Tokio runtime and pass `Arc<AppState>` without serialization boundaries.

If the crate grows beyond ~15k lines, extract a `cowboy-core` library crate as a workspace member. Until then, modules within `src-tauri/src/` are sufficient.

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Tauri shell** (`lib.rs`) | Window management, tray, menu, lifecycle | All components via setup closure |
| **Axum HTTP server** (`server/`) | REST API on `127.0.0.1:3000`, static file serving | DB queries, ingestion, WS hub |
| **WebSocket hub** (`ws.rs`) | Broadcast ingestion events to connected clients | Axum server (upgrade), ingestion engine (events) |
| **Database layer** (`db/`) | rusqlite connection pool, migrations, typed queries | Axum routes, ingestion, settings |
| **Ingestion engine** (`ingestion/`) | Parse JSONL/vscdb, normalize, store, emit change events | DB layer, file watcher (triggered by), WS hub (emits to) |
| **File watcher** (`watcher/`) | Monitor filesystem for new/changed log files | Ingestion engine (triggers), settings DB (reads paths) |
| **IPC commands** (`commands/`) | Native-only features (show/hide window, app version) | Tauri window manager |
| **Vue frontend** (`packages/frontend/`) | UI -- completely unchanged | Axum server via HTTP/WS (same URLs as today) |

## Critical Design Decision: Frontend Talks HTTP, Not IPC

**Decision: Keep all frontend API calls as HTTP `fetch()` to `/api/*`. Do NOT rewrite them to use `invoke()` from `@tauri-apps/api`.**

Rationale:

1. **25 existing API endpoints across 17 composable files** -- rewriting each to Tauri IPC commands doubles the migration work for zero user-visible benefit
2. **WebSocket stays as-is** -- Tauri events are fire-and-forget (no seq numbers, no gap detection, no backpressure). The existing typed WS event system (`WebSocketEventPayload` discriminated union, seq-based gap detection, `system:full-refresh` on reconnect, `onScopeDispose` auto-cleanup) is more sophisticated and battle-tested across v2.1. Replicating it with `app.emit()` + `listen()` would require rebuilding all of that.
3. **The frontend does not know it is in Tauri** -- it fetches `/api/*` from `location.origin`. In Tauri production, `location.origin` is `http://127.0.0.1:3000`. Same code path.
4. **Testability** -- the Rust backend can be tested independently with HTTP requests (curl, reqwest tests). No Tauri test harness needed.
5. **Escape hatch** -- if Tauri is ever dropped, the app still works as a web app with zero frontend changes
6. **Migration safety** -- during porting, you can compare Rust HTTP responses against Node.js HTTP responses. With IPC, there is no comparison mechanism.

The only Tauri IPC commands needed are for **native-only features** that have no HTTP equivalent:

| IPC Command | Purpose |
|-------------|---------|
| `show_window` | Restore from tray click (if triggered from frontend) |
| `hide_window` | Minimize to tray (if triggered from frontend) |
| `get_app_version` | Display in Settings/About |

These are 2-3 thin commands, not 25 route rewrites.

**Why NOT pure IPC (addressing the alternative approach):**
The pure IPC approach (replacing all `fetch()` with `invoke()`) requires: (a) rewriting 17 composable files, (b) completely replacing the WebSocket system with Tauri events, (c) building a "dual-mode" API wrapper for migration compatibility, (d) making the frontend dependent on `@tauri-apps/api`, and (e) giving up browser-based development. The HTTP approach requires: (a) nothing changes in the frontend. The axum server is the same complexity regardless -- it either serves HTTP routes or Tauri commands, same Rust code underneath.

## Data Flow

### Production Mode (Tauri Desktop App)

```
[File system: ~/.claude/projects/**/*.jsonl]
    |
    v  (notify crate watches for changes)
[File Watcher] --triggers--> [Ingestion Engine]
                                    |
                                    v
                              [rusqlite DB]
                                    |
                        +-----------+-----------+
                        |                       |
                        v                       v
              [Axum HTTP routes]        [broadcast::Sender]
              on 127.0.0.1:3000               |
                        |                       v
                        |               [WS handler sends to clients]
                        |                       |
                        v                       v
              [Tauri WebView]
              loads http://127.0.0.1:3000
              Vue app fetches /api/* over HTTP
              Vue app connects ws://127.0.0.1:3000/api/ws
```

The Tauri webview loads `http://127.0.0.1:3000` where axum serves the Vue dist files AND the API. This is identical to how the current Fastify backend works in production mode. The frontend does not know it is inside Tauri.

### Development Mode (cargo tauri dev)

```
[Vite dev server at localhost:5173]  <-- hot reload, HMR
    |
    | (Vite proxy config: /api/* --> localhost:3000)
    |
    v
[Axum HTTP server at localhost:3000] <-- Rust backend
    |
    v
[rusqlite DB] + [File Watcher] + [Ingestion Engine]
```

`tauri.conf.json` sets `devUrl: "http://localhost:5173"` so the Tauri webview loads the Vite dev server. Vite's existing proxy config (`/api -> localhost:3000`) routes API calls to the axum server. This preserves hot reload for the frontend while the Rust backend runs natively.

### Legacy Mode (During Migration, No Tauri)

```
[Vite dev server at localhost:5173]
    |
    | (Vite proxy: /api/* --> localhost:3000)
    |
    v
[Fastify server at localhost:3000]  <-- Node.js backend (existing, unchanged)
```

The existing `pnpm dev` command continues to work unchanged. The Node.js backend and the Rust backend are independent -- they never run simultaneously on the same port, but either can serve the same frontend. To test the Rust backend during migration, temporarily change Vite's proxy target to `:3001`.

## How the Axum Server Runs Inside Tauri

The axum server is spawned as a Tokio task during Tauri's `setup()` phase:

```rust
// src-tauri/src/lib.rs (conceptual)
use std::sync::Arc;

mod state;
mod server;
mod watcher;
mod db;
mod ingestion;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize database and run migrations
            let db_pool = db::init_pool()?;
            db::run_migrations(&db_pool)?;

            // Shared state: DB pool + broadcast channel for WS events
            let app_state = Arc::new(state::AppState::new(db_pool));

            // Spawn axum HTTP server on 127.0.0.1:3000
            let server_state = app_state.clone();
            tauri::async_runtime::spawn(async move {
                server::run(server_state).await;
            });

            // Spawn file watcher (reads settings from DB for paths)
            let watcher_state = app_state.clone();
            tauri::async_runtime::spawn(async move {
                watcher::run(watcher_state).await;
            });

            // Run initial ingestion
            let ingest_state = app_state.clone();
            tauri::async_runtime::spawn(async move {
                ingestion::run_full(&ingest_state);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::show_window,
            commands::hide_window,
            commands::get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Key details:
- Tauri owns the Tokio runtime -- no `#[tokio::main]` needed, use `tauri::async_runtime::spawn`
- `AppState` holds the rusqlite connection pool and `tokio::sync::broadcast` channel
- The axum server, file watcher, and ingestion engine share state via `Arc<AppState>`
- The axum server is a real TCP listener on `127.0.0.1:3000`, not a custom protocol

## Shared State Architecture

```rust
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use tokio::sync::broadcast;

pub struct AppState {
    pub db: Pool<SqliteConnectionManager>,
    pub event_tx: broadcast::Sender<WsEvent>,
}

impl AppState {
    pub fn new(db: Pool<SqliteConnectionManager>) -> Self {
        let (event_tx, _) = broadcast::channel(256);
        Self { db, event_tx }
    }
}
```

- **Database**: `r2d2` connection pool wrapping rusqlite with WAL mode. Synchronous rusqlite calls run inside `tokio::task::spawn_blocking` within async axum handlers. This avoids the complexity of async SQLx while matching the existing synchronous better-sqlite3 pattern.
- **Event broadcast**: `tokio::sync::broadcast` channel. Ingestion engine sends events; WS handler subscribes each connected client. This replaces Fastify's `broadcastEvent` decorator. The seq counter moves into the WS handler (atomic increment per broadcast, matching the existing protocol).
- **Why not SQLx**: SQLx's SQLite driver links libsqlite3-sys. If rusqlite also links it (even transitively), Cargo produces a build error -- only one crate can link a given native library. The existing backend is synchronous -- rusqlite with `spawn_blocking` is the natural 1:1 port.

## Patterns to Follow

### Pattern 1: Axum Route Mirrors Fastify Route

Port each Fastify route handler 1:1 to an axum handler. Keep the same URL paths, query parameters, and JSON response shapes. The frontend does not change.

**Fastify (current):**
```typescript
app.get('/analytics/overview', async (request) => {
  const { from, to, agent } = request.query;
  return getOverviewStats(from, to, agent);
});
```

**Axum (target):**
```rust
async fn get_overview(
    Query(params): Query<DateRangeParams>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<OverviewStats>, AppError> {
    let db = state.db.clone();
    let stats = tokio::task::spawn_blocking(move || {
        let conn = db.get()?;
        queries::get_overview_stats(&conn, &params.from, &params.to, params.agent.as_deref())
    }).await??;
    Ok(Json(stats))
}
```

### Pattern 2: Static File Serving with SPA Fallback

```rust
use tower_http::services::{ServeDir, ServeFile};

let spa = ServeDir::new("../packages/frontend/dist")
    .not_found_service(ServeFile::new("../packages/frontend/dist/index.html"));

let app = Router::new()
    .nest("/api", api_routes)
    .fallback_service(spa);
```

This mirrors the current `@fastify/static` + `setNotFoundHandler` pattern exactly.

### Pattern 3: WebSocket with Broadcast Channel

```rust
use axum::extract::ws::{WebSocket, WebSocketUpgrade, Message};
use std::sync::atomic::{AtomicU64, Ordering};

static SEQ: AtomicU64 = AtomicU64::new(0);

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(mut socket: WebSocket, state: Arc<AppState>) {
    let mut rx = state.event_tx.subscribe();

    // Send connected confirmation (matches existing frontend protocol)
    let _ = socket.send(Message::Text(r#"{"type":"connected"}"#.into())).await;

    // Forward broadcast events, adding seq number
    while let Ok(mut event) = rx.recv().await {
        let seq = SEQ.fetch_add(1, Ordering::Relaxed) + 1;
        event.seq = seq;
        let json = serde_json::to_string(&event).unwrap();
        if socket.send(Message::Text(json)).await.is_err() {
            break;
        }
    }
}
```

### Pattern 4: Ingestion via Direct Function Call

The current Node.js backend triggers ingestion via `app.inject({ method: 'POST', url: '/api/ingest' })`. In Rust, the file watcher calls the ingestion function directly (no HTTP round-trip needed):

```rust
// watcher/mod.rs
async fn on_files_changed(state: Arc<AppState>) {
    let db = state.db.clone();
    let tx = state.event_tx.clone();

    let events = tokio::task::spawn_blocking(move || {
        let conn = db.get().unwrap();
        ingestion::run_full_ingestion(&conn)
    }).await.unwrap();

    for event in events {
        let _ = tx.send(event);
    }
}
```

### Pattern 5: System Tray with Close-to-Tray

```rust
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent};
use tauri::menu::{Menu, MenuItem};
use tauri::{Manager, WindowEvent};

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Cowboy", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .icon_as_template(true) // macOS: adapts to dark/light menu bar
        .menu(&menu)
        .menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up, ..
            } = event {
                if let Some(w) = tray.app_handle().get_webview_window("main") {
                    w.show().ok();
                    w.set_focus().ok();
                }
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    w.show().ok();
                    w.set_focus().ok();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

// In Tauri builder chain -- intercept window close:
.on_window_event(|window, event| {
    if let WindowEvent::CloseRequested { api, .. } = event {
        window.hide().ok();
        api.prevent_close();
    }
})
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Rewriting Frontend API Calls to Tauri IPC
**What:** Replacing `fetch('/api/conversations')` with `invoke('get_conversations')` throughout all 17 composable files.
**Why bad:** 25 endpoints to rewrite. Breaks the existing tested composables. Makes the frontend Tauri-dependent. Loses the ability to run as a standalone web app during migration. The WebSocket system (typed events, seq numbers, gap detection, `onScopeDispose` cleanup) has no Tauri event equivalent -- it would need to be completely rebuilt.
**Instead:** Keep HTTP. The axum server on localhost serves the same API at the same paths.

### Anti-Pattern 2: Using tauri-plugin-axum Instead of a Real Localhost Server
**What:** Routing through Tauri's custom protocol (`axum://localhost/` on macOS) instead of actual TCP HTTP.
**Why bad:** Custom protocols have quirks with WebSocket upgrade, CORS, and browser DevTools. The existing frontend constructs WS URLs from `location.host` -- custom protocols break this. The plugin is v0.7.2, not production stable.
**Instead:** Run axum on `127.0.0.1:3000` as a real TCP server.

### Anti-Pattern 3: Async SQLite via SQLx
**What:** Using SQLx for compile-time checked async SQLite queries.
**Why bad:** SQLx's SQLite driver links libsqlite3-sys. If rusqlite also links it, Cargo fails. The existing backend is synchronous -- rusqlite with `spawn_blocking` is the natural port.
**Instead:** Use rusqlite (synchronous) wrapped in `tokio::task::spawn_blocking`.

### Anti-Pattern 4: Running Both Backends on the Same Port During Migration
**What:** Trying to proxy between Node.js and Rust backends.
**Why bad:** Port conflicts, complex process management, unclear routing.
**Instead:** Run on different ports (Node.js on 3000, Rust on 3001). Switch by changing one line in Vite proxy config.

### Anti-Pattern 5: Embedding Frontend via Tauri's frontendDist Custom Protocol
**What:** Using Tauri's built-in asset embedding for production.
**Why bad:** Tauri serves embedded assets via custom protocol. `location.origin` becomes `tauri://localhost` or `http://tauri.localhost`. The frontend's WebSocket URL construction (`ws://${location.host}/api/ws`) breaks because the API lives on `127.0.0.1:3000`, not `tauri.localhost`.
**Instead:** Window loads `http://127.0.0.1:3000` where axum serves both static files AND API.

### Anti-Pattern 6: Giant Monolithic lib.rs
**What:** Putting all command handlers, routes, and queries in one file.
**Why bad:** The existing backend has 25 route handlers across 4 files + query modules + 15 ingestion modules. One file becomes unnavigable.
**Instead:** Module per domain: `server/routes/analytics.rs`, `db/queries/analytics.rs`, etc.

## Migration Strategy: Parallel Backends

Both backends exist in the repo simultaneously because they are independent programs in different languages.

### Stage 1: Scaffold Tauri + Minimal Rust Server
- Add `src-tauri/` with Tauri v2 boilerplate
- Rust: axum on port 3001 with `/api/health` only
- Tauri webview loads Vite dev server (frontend unchanged)
- `pnpm dev` still runs Node.js backend on :3000 -- nothing breaks
- Validation: Tauri window opens, shows existing UI, backend health returns OK

### Stage 2: Port Backend Modules to Rust (One at a Time)
Port in this order (each step independently testable):
1. **Database schema + migrations** to rusqlite -- foundation for everything
2. **Health route** -- trivial, validates the axum handler pattern
3. **Analytics routes** (11 read-only endpoints) -- most traffic, validates query porting
4. **Plans routes** (5 read-only endpoints)
5. **Settings routes** (8 endpoints including writes) -- validates mutations
6. **Ingestion engine** -- largest piece: JSONL parser, Cursor parser, normalizer, plan extractor, subagent linker (15 modules)
7. **WebSocket broadcast** -- hooks ingestion events to broadcast channel
8. **File watcher** -- notify crate watching configured paths
9. **Ingest route** -- POST endpoint triggering ingestion

At each step: point Vite proxy to `:3001` and verify the frontend works. Compare JSON responses between Node.js (:3000) and Rust (:3001) for the same database.

### Stage 3: Switch Default + Remove Node.js Backend
- Move Rust backend to port 3000
- Update root scripts: `tauri:dev` runs `cargo tauri dev`
- Run full frontend interaction tests against Rust backend
- Remove `packages/backend/`
- Remove backend Node.js dependencies from root

## Tauri Configuration

### tauri.conf.json

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Cowboy",
  "identifier": "com.cowboy.app",
  "build": {
    "beforeDevCommand": "pnpm --filter @cowboy/frontend dev",
    "beforeBuildCommand": "pnpm --filter @cowboy/frontend build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../packages/frontend/dist"
  },
  "app": {
    "withGlobalTauri": false,
    "windows": [
      {
        "title": "Cowboy",
        "width": 1280,
        "height": 800,
        "decorations": true,
        "url": "http://127.0.0.1:3000"
      }
    ],
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": true
    }
  }
}
```

**Dev vs production URL behavior:**
- Dev: `devUrl` overrides window URL to `http://localhost:5173` (Vite HMR). Vite proxies `/api/*` to `:3000`.
- Production: window's `url` field loads `http://127.0.0.1:3000`. Axum serves built Vue dist AND API on the same port.
- `frontendDist` is configured for Tauri's build system but actual serving happens through axum.

### Cargo.toml Dependencies

```toml
[package]
name = "cowboy"
version = "3.0.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["tray-icon", "image-png"] }
tauri-plugin-shell = "2"
tokio = { version = "1", features = ["full"] }
axum = { version = "0.8", features = ["ws"] }
tower-http = { version = "0.6", features = ["fs", "cors"] }
rusqlite = { version = "0.32", features = ["bundled"] }
r2d2 = "0.8"
r2d2_sqlite = "0.25"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
notify = "7"
notify-debouncer-mini = "0.5"
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4"] }
tracing = "0.1"
tracing-subscriber = "0.3"
thiserror = "2"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

## New vs Modified vs Unchanged Components

### New Components (all in src-tauri/)

| Component | Files | Purpose |
|-----------|-------|---------|
| Tauri shell | `lib.rs`, `main.rs`, `build.rs` | App lifecycle, plugin registration |
| App state | `state.rs` | Shared DB pool + event broadcast |
| Axum server | `server/mod.rs` | Router assembly, TCP binding |
| HTTP routes | `server/routes/*.rs` (5 files) | 25 endpoints mirroring Fastify |
| WebSocket | `server/ws.rs` | Upgrade + broadcast with seq |
| Static files | `server/static_files.rs` | ServeDir + SPA fallback |
| Database | `db/mod.rs`, `db/migrations.rs` | rusqlite pool + schema |
| DB queries | `db/queries/*.rs` (3 files) | SQL queries mirroring Drizzle |
| Ingestion | `ingestion/*.rs` (8 files) | JSONL/vscdb parsing |
| File watcher | `watcher/mod.rs` | notify crate |
| IPC commands | `commands/mod.rs` | show/hide window, version |
| Config | `tauri.conf.json`, `capabilities/` | Tauri configuration |

### Modified Components (Minimal)

| Component | Change | Risk |
|-----------|--------|------|
| `package.json` (root) | Add `tauri:dev` script | NONE -- additive |

### Unchanged Components

- `packages/frontend/` -- zero changes, no Tauri imports, no IPC calls
- `packages/shared/` -- TypeScript types unchanged (Rust defines its own serde structs matching same shapes)
- `packages/backend/` -- untouched during migration, removed at the end
- `vite.config.ts` -- proxy target stays `:3000`, no change needed
- `pnpm-workspace.yaml` -- no change (src-tauri is Cargo, not a pnpm package)

## Scalability Considerations

| Concern | Current (Node.js) | Target (Rust/Tauri) | Notes |
|---------|-------------------|---------------------|-------|
| Memory | ~80-120MB (Node.js) | ~20-40MB (Rust + Tauri) | Major win for always-on tray app |
| Binary size | N/A (from source) | ~15-25MB | Acceptable for desktop |
| Startup time | ~1-2s (Node.js) | ~200-400ms | Noticeable improvement |
| SQLite concurrency | Single connection | r2d2 pool + WAL mode | Reads parallelize |
| Ingestion speed | Adequate | ~3-5x faster (serde) | Not a bottleneck |
| File watching | chokidar (JS) | notify (uses FSEvents) | More efficient |

## Build Order (Dependency-Driven)

1. **Tauri scaffold** -- boilerplate, `tauri.conf.json`, empty window opens and loads Vite dev server
2. **Database layer** -- rusqlite pool, schema matching existing 8 tables, migrations
3. **Axum server + health route** -- binds `:3001`, validates "axum inside Tauri" pattern
4. **Analytics routes** (11 endpoints) -- largest read-only module, validates query porting
5. **Plans + settings routes** -- remaining endpoints including writes
6. **Ingestion engine** -- JSONL/vscdb parsing, normalization (largest module, ~15 files to port)
7. **WebSocket broadcast** -- hooks ingestion to broadcast channel, validates typed event protocol
8. **File watcher** -- notify crate, debouncing, settings-based path configuration
9. **System tray + close-to-tray + native menu** -- independent of backend, can parallel with 4-8
10. **Port 3000 cutover + Node.js backend removal** -- final switch

Phases 9 is independent and can be built alongside phases 4-8.

## Sources

- [Tauri v2 Project Structure](https://v2.tauri.app/start/project-structure/) -- official directory layout, HIGH confidence
- [Tauri v2 Vite Configuration](https://v2.tauri.app/start/frontend/vite/) -- devUrl, frontendDist settings, HIGH confidence
- [Tauri v2 Calling Rust from Frontend](https://v2.tauri.app/develop/calling-rust/) -- IPC command pattern, HIGH confidence
- [Tauri v2 System Tray](https://v2.tauri.app/learn/system-tray/) -- tray icon, menu, close-to-tray, HIGH confidence
- [Tauri v2 Configuration Reference](https://v2.tauri.app/reference/config/) -- full config schema, HIGH confidence
- [Tauri v2 WebSocket Plugin](https://v2.tauri.app/plugin/websocket/) -- evaluated for reference, HIGH confidence
- [Tauri v2 Localhost Plugin](https://v2.tauri.app/plugin/localhost/) -- alternative serving, HIGH confidence
- [tauri-plugin-axum](https://docs.rs/tauri-plugin-axum) -- v0.7.2, evaluated and rejected, MEDIUM confidence
- [Axum in Tauri discussion](https://github.com/tokio-rs/axum/discussions/2501) -- spawn pattern, MEDIUM confidence
- [Tauri async runtime issue #13330](https://github.com/tauri-apps/tauri/issues/13330) -- Tokio runtime ownership, HIGH confidence
- [Tauri src-tauri layout issue #2643](https://github.com/tauri-apps/tauri/issues/2643) -- directory flexibility, HIGH confidence
- [Tauri v2 Monorepo Guide](https://melvinoostendorp.nl/blog/tauri-v2-nextjs-monorepo-guide) -- monorepo patterns, MEDIUM confidence
- Codebase analysis: 25 Fastify routes (4 files), 1 WS endpoint, 6 plugins, 15 ingestion modules, 8 DB tables, 17 frontend composables with fetch calls

---
*Architecture research for: Cowboy v3.0 Tauri v2 + Rust Backend*
*Researched: 2026-03-11*
