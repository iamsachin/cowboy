# Stack Research: Tauri v2 + Rust Backend

**Domain:** Tauri v2 desktop app with Rust backend replacing Fastify/Node.js
**Researched:** 2026-03-11
**Confidence:** HIGH

## Context: What Already Exists

This research covers ONLY the stack additions for v3.0. The existing frontend stack is validated and unchanged:

| Layer | Existing | Status |
|-------|----------|--------|
| Frontend | Vue 3 + Vite 6 + DaisyUI 5.5 + Tailwind 4.2 | Keep as-is, load in Tauri webview |
| Backend | Fastify 5.7 + better-sqlite3 12.6 + Drizzle 0.45 | **REWRITE in Rust** |
| Shared | @cowboy/shared workspace package (TypeScript types) | Keep for frontend; Rust gets its own types |
| Dev tooling | pnpm workspaces, tsx, concurrently | Keep; add Cargo workspace |

## Recommended Stack

### Core Framework: Tauri v2

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri | 2.10.3 | Desktop shell: webview, tray, menu, window management | Current stable. Rust-native, ~3MB binary vs ~150MB Electron. Chosen over Electron per PROJECT.md ("smaller footprint and learning opportunity"). |
| @tauri-apps/api | 2.10.1 | Frontend JS bindings for Tauri IPC | Required for invoke() calls from Vue frontend to Rust backend |
| @tauri-apps/cli | 2.10.1 | Dev/build CLI tooling | `cargo tauri dev` and `cargo tauri build` |

### Rust Backend Crates

| Crate | Version | Purpose | Why This Over Alternatives |
|-------|---------|---------|----------------------------|
| rusqlite | 0.38.0 | SQLite database access | Direct SQLite wrapper. `bundled` feature compiles SQLite into binary -- zero system dependency. Synchronous API is fine: all DB calls happen in Tauri async commands via `tokio::spawn_blocking`. Matches the existing better-sqlite3 (also synchronous) mental model 1:1. |
| serde | 1.0.228 | Serialization framework | Universal Rust standard. Derive macros for all structs. |
| serde_json | 1.0.149 | JSON/JSONL parsing and serialization | Required for parsing Claude Code JSONL logs and API responses. |
| notify | 8.0 | File system watching | Direct replacement for chokidar. Cross-platform, well-maintained (used by rust-analyzer, deno, cargo-watch). Pin to 8.x stable, not 9.0.0-rc.1. |
| tokio | 1.49 | Async runtime | Tauri v2 uses tokio internally. Required for async commands, file I/O, and timers. Use features: `full`. |
| chrono | 0.4 | Date/time handling | Timezone-safe timestamps, ISO 8601 parsing. Replaces JS Date operations. |
| uuid | 1.0 | UUID generation | Primary key generation for database records (existing schema uses text UUIDs). |
| tracing | 0.1 | Structured logging | Replaces console.log. Integrates with tokio ecosystem. Use with `tracing-subscriber` for output. |
| tracing-subscriber | 0.3 | Log output formatting | Console and file logging with filtering. |
| thiserror | 2.0 | Error type derivation | Clean error types for Tauri command return values. |
| glob | 0.3 | File path globbing | Finding JSONL log files by pattern (replaces Node glob usage). |
| walkdir | 2.5 | Recursive directory traversal | Scanning Claude Code/Cursor log directories. |

### Tauri Feature Flags and Plugins

| Feature/Plugin | Cargo.toml Entry | Purpose | Notes |
|----------------|------------------|---------|-------|
| tray-icon | `tauri = { features = ["tray-icon"] }` | System tray with menu | Built into tauri core, not a separate plugin. Enables `TrayIconBuilder`. |
| tauri-plugin-shell | 2.3.4 | Shell/process spawning | Only if you need to open URLs in default browser. Not needed for core functionality. |

**Plugins NOT needed:**

| Plugin | Why Skip |
|--------|----------|
| tauri-plugin-sql | Adds SQLite via JS-side plugin. We manage SQLite entirely in Rust with rusqlite. |
| tauri-plugin-store | Key-value storage. We have SQLite for all persistence (settings table). |
| tauri-plugin-fs | File system access from JS. All file operations happen in Rust backend. |
| tauri-plugin-http | HTTP client from JS. No outbound HTTP from frontend needed. |
| tauri-plugin-websocket | WebSocket from JS. We implement our own WS in Rust. |
| tauri-plugin-window-state | Saves/restores window position. Nice-to-have, not MVP. Add later if wanted. |
| tauri-plugin-log | Logging plugin. We use tracing in Rust directly. |

### Why NOT These Crates

| Crate | Why Not | Use Instead |
|-------|---------|-------------|
| sqlx | Async + compile-time SQL checking sounds appealing, but requires a running DB at compile time or `sqlx-data.json` offline mode. Adds complexity for an embedded SQLite app where the DB file lives on disk. Overkill. | rusqlite with `bundled` |
| diesel | Full ORM with DSL. Heavy learning curve, schema.rs code generation, migration system you must adopt. Existing Drizzle schema is simple (8 tables, no complex joins). Hand-written SQL with rusqlite is clearer and matches the existing query patterns. | rusqlite with hand-written SQL |
| sea-orm | Async ORM built on sqlx. Same compile-time DB issue as sqlx. Entity generation step. Too much abstraction for 8 simple tables. | rusqlite |
| axum | Originally planned in PROJECT.md, but NOT needed. Tauri IPC (`invoke()`) replaces HTTP entirely. Running an embedded HTTP server inside Tauri adds unnecessary complexity -- the webview talks to Rust via IPC, not HTTP. | Tauri IPC commands |
| tokio-tungstenite | WebSocket library. NOT needed for the same reason as axum -- Tauri's event system (`app.emit()`, `listen()`) replaces WebSocket for push notifications. | Tauri events |
| actix-web | Alternative web framework. Same reasoning as axum -- no HTTP server needed. | Tauri IPC commands |
| reqwest | HTTP client. Only needed if sync-to-remote-endpoint feature is kept. Can add later. | Nothing for MVP |

## Critical Architecture Decision: Tauri IPC, NOT Embedded HTTP Server

The original PROJECT.md mentions "axum + rusqlite + notify + tokio-tungstenite" but this is the WRONG architecture for Tauri. Here is why:

**The existing architecture** (Fastify): Frontend --[HTTP fetch]--> Fastify --[response]--> Frontend. The Vite dev proxy forwards `/api/*` to localhost:3000. WebSocket on the same port for push events.

**The Tauri architecture**: Frontend --[invoke()]--> Rust commands --[return]--> Frontend. For push events: Rust --[app.emit()]--> Frontend --[listen()]--> handler.

Running axum inside Tauri means:
1. Starting an HTTP server on a port (port conflict risk)
2. The webview fetching from localhost (security warnings, CORS setup)
3. Two communication channels to maintain (HTTP + Tauri IPC)
4. More code, more surface area, no benefit

Tauri IPC is:
1. Zero network -- direct function calls through the webview bridge
2. Type-safe with serde serialization
3. No port binding, no CORS, no proxy config
4. Built-in event system replaces WebSocket entirely

**Trade-off**: The frontend's 16 files with `fetch('/api/...')` calls need to be rewritten to use `invoke()`. This is a one-time migration cost (~200 lines of changes across composables) that eliminates an entire HTTP server from the architecture.

### Frontend API Migration Pattern

Existing:
```typescript
// useConversations.ts
const res = await fetch('/api/conversations?limit=50');
const data = await res.json();
```

New:
```typescript
// useConversations.ts
import { invoke } from '@tauri-apps/api/core';
const data = await invoke('get_conversations', { limit: 50 });
```

Existing WebSocket push:
```typescript
// useWebSocket.ts
const ws = new WebSocket('ws://localhost:3000/api/ws');
ws.onmessage = (e) => handleEvent(JSON.parse(e.data));
```

New Tauri events:
```typescript
// useEvents.ts
import { listen } from '@tauri-apps/api/event';
await listen('conversation-updated', (event) => handleEvent(event.payload));
```

## Monorepo Integration

### New: src-tauri Directory (Tauri Convention)

Tauri expects `src-tauri/` adjacent to the frontend. For the monorepo, place it at the root level pointing to `packages/frontend` as the web asset source.

```
cowboy/
  src-tauri/                     <-- NEW (Rust backend + Tauri config)
    Cargo.toml
    tauri.conf.json
    capabilities/
      default.json               # IPC permissions
    icons/                        # App icons (generated by cargo tauri icon)
    src/
      main.rs                    # Tauri entry point
      lib.rs                     # Command registration
      commands/                  # Tauri IPC command handlers
        analytics.rs
        conversations.rs
        plans.rs
        settings.rs
        health.rs
      db/
        mod.rs                   # Connection management
        schema.rs                # Table creation SQL
        queries/
          analytics.rs
          conversations.rs
          plans.rs
          settings.rs
      ingestion/
        mod.rs                   # File watcher + ingestion coordinator
        claude.rs                # Claude Code JSONL parser
        cursor.rs                # Cursor log parser
      events.rs                  # Tauri event emission (replaces WebSocket)
      state.rs                   # App state (DB connection, watcher handle)
      error.rs                   # Error types
  packages/
    frontend/                    <-- UNCHANGED (loaded by Tauri webview)
    backend/                     <-- KEPT for browser dev mode, eventually removed
    shared/                      <-- KEPT for frontend TypeScript types
  Cargo.toml                     <-- NEW (workspace root, optional)
  pnpm-workspace.yaml            <-- UNCHANGED
  package.json                   <-- Add tauri dev/build scripts
```

### Why src-tauri at Root, NOT packages/tauri

1. **Tauri CLI convention**: `cargo tauri dev` looks for `src-tauri/` relative to the working directory by default
2. **Frontend path**: `tauri.conf.json` needs `frontendDist: "../packages/frontend/dist"` -- cleaner from root than from `packages/tauri`
3. **Cargo workspace**: Root-level `Cargo.toml` workspace is standard Rust practice
4. **Precedent**: Every Tauri + monorepo example uses this pattern

### tauri.conf.json

```json
{
  "productName": "Cowboy",
  "identifier": "dev.cowboy.app",
  "build": {
    "beforeDevCommand": "pnpm --filter @cowboy/frontend dev",
    "beforeBuildCommand": "pnpm --filter @cowboy/frontend build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../packages/frontend/dist"
  },
  "app": {
    "windows": [
      {
        "title": "Cowboy",
        "width": 1400,
        "height": 900,
        "decorations": true,
        "titleBarStyle": "Overlay"
      }
    ],
    "security": {
      "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'"
    }
  },
  "bundle": {
    "active": false,
    "icon": ["icons/icon.icns", "icons/icon.ico", "icons/icon.png"]
  }
}
```

Key points:
- `beforeDevCommand` starts the Vite dev server for the frontend
- `devUrl` points to Vite's dev server (same port as existing)
- `frontendDist` points to the built frontend assets for production
- `bundle.active: false` -- no .dmg/.app packaging (personal use, run from source)
- `titleBarStyle: "Overlay"` -- native macOS traffic lights overlaid on content

### src-tauri/Cargo.toml

```toml
[package]
name = "cowboy"
version = "3.0.0"
edition = "2021"

[dependencies]
tauri = { version = "2.10", features = ["tray-icon"] }
tauri-plugin-shell = "2.3"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
rusqlite = { version = "0.38", features = ["bundled"] }
notify = "8.0"
tokio = { version = "1", features = ["full"] }
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1.0", features = ["v4"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
thiserror = "2.0"
glob = "0.3"
walkdir = "2.5"

[build-dependencies]
tauri-build = { version = "2.10", features = [] }

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

### Vite Config Changes

The existing `packages/frontend/vite.config.ts` needs minimal changes:

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

const isTauri = !!process.env.TAURI_ENV_PLATFORM;

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  clearScreen: false,  // Tauri logs visible in terminal
  server: {
    port: 5173,
    strictPort: true,  // Fail if port taken (Tauri expects this exact port)
    // Only proxy in non-Tauri mode (browser dev against Node backend)
    ...(!isTauri && {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    }),
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    outDir: 'dist',
    // Tauri webview targets
    target: isTauri ? ['es2021', 'chrome105', 'safari13'] : 'esnext',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
```

### Root package.json Additions

```json
{
  "scripts": {
    "dev": "... (existing, unchanged)",
    "dev:tauri": "cargo tauri dev",
    "build:tauri": "cargo tauri build"
  }
}
```

### Frontend @tauri-apps/api Installation

```bash
cd packages/frontend
pnpm add @tauri-apps/api@^2.10.0
```

This is the ONLY npm dependency addition across the entire project.

## Dev Workflow

### Two Dev Modes (Preserved)

| Command | What Happens | When to Use |
|---------|-------------|-------------|
| `pnpm dev` | Starts Fastify backend + Vite frontend in browser | Frontend-only changes, quick iteration |
| `pnpm dev:tauri` | `cargo tauri dev` starts Vite frontend + compiles Rust + opens Tauri window | Rust backend changes, tray/menu work, integration testing |

`cargo tauri dev`:
1. Runs `beforeDevCommand` (starts Vite dev server on :5173)
2. Compiles the Rust src-tauri crate
3. Launches the Tauri window pointing at http://localhost:5173
4. Hot reloads: Vite HMR for frontend, Rust recompiles on save

### First Rust Compile

The initial `cargo build` will take 2-5 minutes (downloading and compiling all crate dependencies + bundled SQLite). Subsequent incremental builds are 5-15 seconds.

## Rust Code Patterns

### Tauri Command (Replaces Fastify Route)

```rust
// src/commands/analytics.rs
use tauri::State;
use serde::Serialize;
use crate::db::DbPool;
use crate::error::AppError;

#[derive(Serialize)]
pub struct OverviewStats {
    pub total_conversations: i64,
    pub total_messages: i64,
    pub total_tokens: i64,
    pub total_tool_calls: i64,
}

#[tauri::command]
pub async fn get_overview_stats(
    db: State<'_, DbPool>,
) -> Result<OverviewStats, AppError> {
    let conn = db.get()?;
    tokio::task::spawn_blocking(move || {
        // rusqlite is synchronous -- run in blocking thread
        let mut stmt = conn.prepare(
            "SELECT COUNT(*) FROM conversations"
        )?;
        let total_conversations: i64 = stmt.query_row([], |row| row.get(0))?;
        // ... more queries
        Ok(OverviewStats { total_conversations, /* ... */ })
    }).await?
}
```

### DB Connection Pool

```rust
// src/db/mod.rs
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

pub type DbPool = Arc<Mutex<Connection>>;

pub fn init_db(path: &str) -> rusqlite::Result<DbPool> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    // Run migrations...
    Ok(Arc::new(Mutex::new(conn)))
}
```

Note: For a single-user desktop app, `Arc<Mutex<Connection>>` is sufficient. Connection pooling (r2d2) is overkill -- there is only one user and one connection needed. The Mutex ensures thread safety when multiple Tauri commands access the DB concurrently.

### Tauri Events (Replaces WebSocket)

```rust
// src/events.rs
use tauri::{AppHandle, Emitter};
use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct ConversationUpdated {
    pub conversation_id: String,
    pub change_type: String,  // "messages-added", "tokens-updated", etc.
}

pub fn emit_conversation_updated(app: &AppHandle, payload: ConversationUpdated) {
    app.emit("conversation-updated", payload).ok();
}
```

### File Watcher Integration

```rust
// src/ingestion/mod.rs
use notify::{Watcher, RecursiveMode, recommended_watcher};
use std::sync::mpsc;

pub fn start_watcher(
    app_handle: tauri::AppHandle,
    db: DbPool,
    paths: Vec<String>,
) -> notify::Result<impl Watcher> {
    let (tx, rx) = mpsc::channel();
    let mut watcher = recommended_watcher(tx)?;

    for path in &paths {
        watcher.watch(path.as_ref(), RecursiveMode::Recursive)?;
    }

    // Process events in background
    tauri::async_runtime::spawn(async move {
        while let Ok(event) = rx.recv() {
            // Filter for JSONL file changes, trigger ingestion
            // Emit Tauri events for frontend updates
        }
    });

    Ok(watcher)
}
```

## Database Migration Strategy

### From Drizzle Schema to rusqlite

The existing Drizzle schema (8 tables) translates to CREATE TABLE statements:

```sql
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    agent TEXT NOT NULL,
    project TEXT,
    title TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    model TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    parent_conversation_id TEXT
);
-- ... (same for all 8 tables)
```

The Rust backend reads the SAME SQLite database file that the existing Node backend creates. No migration tool needed -- just run the same CREATE TABLE IF NOT EXISTS statements on startup. The existing database is fully compatible.

### Query Translation

Drizzle ORM queries map to raw SQL in rusqlite. The existing codebase already has the SQL patterns visible in the Drizzle query builder calls -- they translate almost 1:1.

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| axum / actix-web / warp | No HTTP server needed -- Tauri IPC replaces it entirely | `#[tauri::command]` functions |
| tokio-tungstenite | No WebSocket needed -- Tauri events replace it | `app.emit()` + `listen()` |
| sqlx | Requires running DB at compile time. Async overhead for single-user embedded DB. | rusqlite with `bundled` |
| diesel | ORM overhead, DSL learning curve, code generation step. | rusqlite with hand-written SQL |
| r2d2 | Connection pooling for multi-user servers. Single user, one connection. | `Arc<Mutex<Connection>>` |
| tauri-plugin-sql | JS-side SQLite plugin. All DB access should be in Rust. | rusqlite in Rust commands |
| tauri-plugin-store | Key-value store. Already have SQLite settings table. | rusqlite |
| tauri-plugin-fs | JS file access. All file I/O in Rust. | Rust std::fs |
| tauri-plugin-websocket | JS WebSocket. Using Tauri events instead. | Tauri event system |
| reqwest | HTTP client. Not needed for MVP (sync-to-remote is deferrable). | Add later if sync feature kept |
| tauri-plugin-window-state | Window position persistence. Not MVP. | Add later if wanted |
| tauri-plugin-log | Logging from JS. Using tracing in Rust. | tracing + tracing-subscriber |

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Tauri v2 | Electron 40 | PROJECT.md explicitly chose Tauri ("smaller footprint and learning opportunity"). ~3MB vs ~150MB. Rust backend is the whole point. |
| Tauri IPC | Embedded axum HTTP server | IPC is zero-network, type-safe, no port conflicts. HTTP server inside desktop app is unnecessary complexity. |
| Tauri events | tokio-tungstenite WebSocket | Event system is built-in, no port/connection management, auto-cleanup on window close. |
| rusqlite | sqlx | sqlx requires DB at compile time (or offline mode). Async overhead meaningless for single-user. rusqlite `bundled` = zero dependencies. |
| rusqlite | diesel | Diesel's code-gen and DSL add friction for 8 simple tables. Raw SQL is clearer and matches existing query patterns. |
| Arc<Mutex<Connection>> | r2d2 pool | One user, one connection. Mutex is sufficient. Pool adds complexity for no benefit. |
| notify 8.x | notify 9.0.0-rc.1 | RC not stable. 8.x is proven and sufficient. |
| src-tauri at root | packages/tauri | Tauri CLI expects src-tauri by default. Fighting convention adds friction. |

## Version Compatibility Matrix

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| tauri | 2.10.3 | Rust 1.77.2+, macOS 10.15+ | wry (WebKit) on macOS |
| rusqlite | 0.38.0 | SQLite 3.45+ (bundled) | `bundled` feature compiles SQLite into binary |
| notify | 8.2.0 | Rust 1.85+, FSEvents on macOS | Uses native macOS file events |
| tokio | 1.49.0 | Rust 1.70+ | Tauri uses tokio internally |
| serde | 1.0.228 | Rust 1.31+ | Universal compatibility |
| Vue 3.5 | -- | WebKit (macOS webview) | Full modern API support |
| Vite 6 | -- | Tauri devUrl integration | `cargo tauri dev` manages lifecycle |
| DaisyUI 5.5 | -- | WebKit | No Electron-specific quirks |

## Installation

```bash
# 1. Install Rust toolchain (if not present)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Install Tauri CLI
cargo install tauri-cli

# 3. Add @tauri-apps/api to frontend
cd packages/frontend && pnpm add @tauri-apps/api@^2.10.0

# 4. Initialize src-tauri (or create manually per structure above)
# cargo tauri init will scaffold, but manual creation gives more control

# 5. No other npm packages needed. All Rust deps come via Cargo.toml.
```

## Sources

- [Tauri 2.0 Stable Release](https://v2.tauri.app/blog/tauri-20/) -- v2.0 release announcement, Oct 2024 (HIGH confidence)
- [Tauri Core Ecosystem Releases](https://v2.tauri.app/release/) -- v2.10.3 current stable (HIGH confidence)
- [Tauri Vite Frontend Integration](https://v2.tauri.app/start/frontend/vite/) -- official Vite config guide (HIGH confidence)
- [Tauri Project Structure](https://v2.tauri.app/start/project-structure/) -- src-tauri layout (HIGH confidence)
- [Tauri System Tray](https://v2.tauri.app/learn/system-tray/) -- tray-icon feature, TrayIconBuilder (HIGH confidence)
- [Tauri IPC Concepts](https://v2.tauri.app/concept/inter-process-communication/) -- invoke, events, custom protocol (HIGH confidence)
- [Tauri Calling Rust from Frontend](https://v2.tauri.app/develop/calling-rust/) -- #[tauri::command] patterns (HIGH confidence)
- [rusqlite 0.38.0 docs](https://docs.rs/crate/rusqlite/latest) -- bundled feature, API (HIGH confidence)
- [Rust ORMs in 2026: Diesel vs SQLx vs SeaORM vs Rusqlite](https://aarambhdevhub.medium.com/rust-orms-in-2026-diesel-vs-sqlx-vs-seaorm-vs-rusqlite-which-one-should-you-actually-use-706d0fe912f3) -- comparison (MEDIUM confidence)
- [notify 8.2.0 docs](https://docs.rs/crate/notify/latest) -- file watcher API (HIGH confidence)
- [axum 0.8.8 crates.io](https://crates.io/crates/axum) -- version check (HIGH confidence)
- [tokio-tungstenite 0.28.0 docs](https://docs.rs/crate/tokio-tungstenite/latest) -- version check (HIGH confidence)
- [serde 1.0.228 / serde_json 1.0.149](https://crates.io/crates/serde) -- version check (HIGH confidence)
- [tauri-plugin-shell 2.3.4 docs](https://docs.rs/crate/tauri-plugin-shell/latest) -- version check (HIGH confidence)
- [Tauri + Axum discussion](https://github.com/tauri-apps/tauri/discussions/11399) -- architecture patterns (MEDIUM confidence)
- [tokio::spawn in Tauri discussion](https://github.com/tauri-apps/tauri/discussions/11831) -- async runtime integration (MEDIUM confidence)

---
*Stack research for: Cowboy v3.0 Tauri v2 + Rust Backend*
*Researched: 2026-03-11*
