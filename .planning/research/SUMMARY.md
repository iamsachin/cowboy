# Project Research Summary

**Project:** Cowboy v3.0 — Tauri Desktop App
**Domain:** Desktop analytics dashboard (Tauri v2 + Rust backend replacing Node.js/Fastify)
**Researched:** 2026-03-11
**Confidence:** HIGH

## Executive Summary

Cowboy v3.0 is a port of an existing, fully functional coding-agent analytics dashboard (~30k LOC Vue 3 frontend + ~6k LOC Node.js/Fastify backend) into a native macOS desktop app using Tauri v2. The frontend stays completely unchanged — it loads inside a Tauri webview and continues making standard HTTP/WebSocket calls. The migration work is entirely in the backend: rewrite the Fastify+Node.js layer (25 REST endpoints, 1 WebSocket endpoint, 15 ingestion modules, SQLite via Drizzle/better-sqlite3) as a Rust crate with axum serving an embedded HTTP server on `127.0.0.1:3000`. A Tauri shell wraps the window, system tray, and native macOS chrome around both the Rust server and the unchanged Vue frontend.

The critical architectural decision — confirmed by codebase analysis of 17 frontend composables with `fetch()` calls and the sophisticated `useWebSocket.ts` typed event system — is to run axum as a real TCP HTTP server inside the Tauri process, NOT to convert frontend API calls to Tauri IPC `invoke()`. This preserves all 30,000 LOC of Vue frontend unchanged, allows the Node.js backend to coexist during migration for parallel response diffing, and avoids rebuilding the WebSocket event system (typed discriminated union payloads, sequence-number gap detection, `onScopeDispose` cleanup). Only 2-3 thin Tauri IPC commands are needed for native-only features (show/hide window, app version). Note: an earlier draft of SUMMARY.md (written before ARCHITECTURE.md and PITFALLS.md completed) recommended the opposite approach (pure IPC). That recommendation is superseded — the axum-inside-Tauri approach is correct.

The three highest risks are: (1) blocking the Tokio async runtime with synchronous rusqlite calls — use `tokio-rusqlite` from day one; (2) Tauri's custom protocol breaking relative `/api/*` URL resolution in production builds — configure the webview window to load `http://127.0.0.1:3000` directly so axum serves both the API and Vue dist from a single origin; and (3) subtle data fidelity bugs from porting 1,000+ lines of Drizzle ORM query logic to hand-written SQL — capture Drizzle's generated SQL with `logger: true` and diff JSON responses between old and new backends on every endpoint before any phase is declared complete.

## Key Findings

### Recommended Stack

The stack adds a Rust/Tauri layer on top of the unchanged existing frontend. The only npm addition is `@tauri-apps/api@^2.10.0` in the frontend package — used exclusively for the 2-3 native IPC commands. All backend complexity moves into the `src-tauri/` Rust crate placed at the monorepo root (sibling of `packages/`).

**Core technologies:**
- **Tauri 2.10.3**: Desktop shell (window, tray, menu, webview) — ~3MB binary vs Electron's ~150MB; explicitly chosen per PROJECT.md
- **axum 0.8 + tokio 1.49**: Embedded HTTP/WebSocket server spawned from Tauri's `setup()` hook — preserves frontend unchanged, enables parallel migration testing against Node.js
- **rusqlite 0.38 (bundled) + tokio-rusqlite**: SQLite access — `bundled` compiles SQLite into binary (zero system dependency); `tokio-rusqlite` prevents Tokio runtime blocking via a dedicated background thread
- **r2d2 + r2d2_sqlite**: Connection pool — handles concurrent axum handler access safely with WAL mode
- **notify 8.x + notify-debouncer-mini**: File system watching — replaces chokidar; pin to 8.x stable (NOT 9.0.0-rc.1)
- **serde 1.0 + serde_json 1.0**: Serialization — all structs use `#[serde(rename_all = "camelCase")]` to match existing frontend expectations
- **tower-http 0.6**: Static file serving (ServeDir + SPA fallback), CORS middleware for dev mode
- **thiserror 2.0**: `AppError` type implementing `IntoResponse` — defined in Phase 1 before any route handler is written

**Do NOT add:** sqlx (linking conflict with rusqlite's bundled libsqlite3-sys), diesel/sea-orm (ORM overhead for 8 simple tables), tokio-tungstenite (axum has built-in WebSocket), tauri-plugin-sql/store/fs/websocket (all handled in Rust directly), tauri-plugin-axum (v0.7.2, breaks WebSocket URL construction).

### Expected Features

This is a complete port — every feature below is required for parity. Missing anything is a regression.

**Must have (table stakes — v3.0 P1):**
- Complete Rust port of all backend modules: SQLite schema/migrations, analytics queries (10 functions, 1,029 TS lines), plans queries (5 functions), settings queries, Claude Code JSONL parser + normalizer, Cursor SQLite parser + normalizer, file discovery for both agents, ingestion orchestrator (661 TS lines), plan extractor, subagent linker (three-phase matching: filesystem path, agentId, description/position heuristics), data quality migration, ID generator (SHA-256), pricing table + cost calculation, WebSocket broadcast with sequence numbers, file watcher with per-agent debounce (1s Claude Code, 3s Cursor), sync scheduler with exponential backoff
- All 25 REST endpoints + 1 WebSocket endpoint on axum, identical URL paths and JSON response shapes to the existing Fastify backend
- Tauri desktop shell: native macOS window chrome, system tray icon + Show/Quit menu, close-to-tray behavior, minimal menu bar (Cowboy menu + Edit submenu for clipboard), dev mode (Vite HMR proxy at `:5173`) and production mode (axum serves Vue dist from `http://127.0.0.1:3000`)

**Should have (desktop differentiators — v3.x):**
- Window state persistence (save/restore bounds across restarts)
- Tray tooltip with live token rate stats
- Auto-start on login via LaunchAgent plist
- Backend health self-check with tray status indicator

**Defer (v4+):**
- Cross-platform builds (Linux, Windows)
- Native notifications for cost/duration thresholds
- Distributable .dmg (PROJECT.md explicitly out of scope)
- Additional agent support (Windsurf, Copilot)

**Anti-features (explicitly rejected):**
- Converting frontend `fetch()` to Tauri `invoke()` — 30k LOC for zero user-visible benefit; destroys the ability to run as a web app
- Multiple windows — unnecessary complexity with Vue router handling all navigation
- Global keyboard shortcuts — requires accessibility permissions, out of scope per PROJECT.md
- tauri-plugin-sql — inadequate for 1,029-line analytics query module with dynamic WHERE clauses and subqueries

### Architecture Approach

The architecture maintains a clean separation: the Tauri shell owns window/tray/lifecycle, the axum server owns all HTTP/WebSocket communication as a real TCP listener on `127.0.0.1:3000`, and the Vue frontend remains completely unaware it is inside Tauri. Shared state flows through `Arc<AppState>` containing an r2d2 connection pool and a `tokio::sync::broadcast` channel — the pool handles concurrent reads across axum handlers, and the broadcast channel decouples ingestion events from WebSocket delivery without any shared mutable client registries. The `src-tauri/` directory lives at the monorepo root (not inside `packages/`) following Tauri CLI convention.

**Major components:**
1. **Tauri shell** (`lib.rs`) — app lifecycle, window management, tray, native menu, close-to-tray intercept via `WindowEvent::CloseRequested`
2. **Axum HTTP server** (`server/`) — TCP listener on `127.0.0.1:3000`, REST routes (25 endpoints across 4 files), WebSocket upgrade + `AtomicU64` seq-numbered broadcast, static file serving (ServeDir + SPA fallback for Vue router)
3. **Database layer** (`db/`) — r2d2 pool, rusqlite migrations (8 tables with WAL + foreign keys), typed query modules (analytics, plans, settings)
4. **Ingestion engine** (`ingestion/`) — JSONL/vscdb parsing, normalization, plan extraction, three-phase subagent linking, data quality migration, writes to DB and emits broadcast events
5. **File watcher** (`watcher/`) — notify crate with notify-debouncer-mini, separate watchers for Claude Code (1s debounce) and Cursor (3s debounce), triggers ingestion directly (no HTTP round-trip)
6. **IPC commands** (`commands/`) — exactly 3: `show_window`, `hide_window`, `get_app_version`

**Build order driven by dependencies:** scaffold → DB layer → axum health → analytics routes → plans/settings routes → ingestion engine → WebSocket broadcast → file watcher → tray/menu (parallelizable with steps 4-8) → port 3000 cutover and Node.js backend removal.

### Critical Pitfalls

1. **Blocking the Tokio runtime with synchronous rusqlite** — use `tokio-rusqlite` (not bare `Arc<Mutex<Connection>>`) from Phase 1. Four blocked workers freeze the entire app: no WebSocket messages, no HTTP responses, no file watcher events. Establish the DB access pattern before writing any query code.

2. **Relative `/api/*` URLs breaking under Tauri's custom protocol** — configure the production window `url` to `http://127.0.0.1:3000` (where axum serves both the API and Vue dist); add `const BASE_URL = window.__TAURI__ ? 'http://127.0.0.1:3000' : ''` to a centralized API client. Do NOT use Tauri's `frontendDist` custom protocol serving — it changes `location.origin` to `tauri://localhost` and breaks WebSocket URL construction.

3. **Drizzle ORM query port introducing silent data bugs** — run the existing Node.js backend with Drizzle `logger: true` to capture exact generated SQL strings; diff JSON responses between old (`:3000`) and new (`:3001`) backends for every endpoint on the same database; use rusqlite named parameters (`:param`) not positional `?` to avoid off-by-one binding errors; explicitly call `serde_json::from_str()` on Drizzle's `json`-mode columns (`tool_calls.input`, `tool_calls.output`, `subagent_summary`, `settings.sync_categories`).

4. **CSP blocking DaisyUI inline styles and API/WebSocket connections in production builds** — configure immediately in `tauri.conf.json`: `"style-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:3000 ws://127.0.0.1:3000"`. Only manifests in `tauri build`, not `tauri dev` — easy to miss.

5. **JSONL parser fidelity gap** — the existing parser has 18+ months of accumulated edge cases: streaming deduplication (replace-not-append), three-phase subagent resolution, compaction detection with token delta computation, title extraction with XML stripping and slash command filtering, double-encoded JSON in tool inputs. Use per-line error handling (skip malformed lines with `tracing::warn!`, never `unwrap()`), diff SQLite output row-by-row against Node.js, use `chars().take(100)` not byte slicing for string truncation.

6. **axum startup race with Tauri webview** — bind the TCP listener and start axum before Tauri's `run()` call; the webview must not load until axum is accepting connections. Use a `CancellationToken` for graceful shutdown to avoid DB lock errors on second launch.

7. **serde field naming** — add `#[serde(rename_all = "camelCase")]` to every struct returned to the frontend. Rust uses `snake_case`; the frontend expects `camelCase`. Missing this on one struct produces silent rendering failures.

## Implications for Roadmap

Based on research, the dependency graph drives a clear 5-phase structure:

### Phase 1: Foundation — Tauri Scaffold + Infrastructure
**Rationale:** Six critical architectural decisions must be locked in before any feature work or all subsequent code will need rework. These are: tokio-rusqlite pattern, axum startup ordering, CSP configuration, AppError type, workspace crate structure (separate library crate for fast incremental builds), and database path resolution. Small in LOC, high in correctness leverage.
**Delivers:** Tauri window opens showing existing Vue frontend via Vite dev server; axum health endpoint on `:3001` responds; CSP verified with `tauri build`; DB path resolves to Tauri app data dir; incremental Rust builds under 15 seconds.
**Addresses:** Tauri project scaffolding, empty window, dev/prod Vite proxy, Tauri capabilities config
**Avoids:** Pitfall 1 (Tokio blocking), Pitfall 2 (URL breakage), Pitfall 4 (CSP), Pitfall 6 (startup race), Pitfall 9 (AppError), Pitfall 8 (slow rebuilds), Pitfall 13 (DB path)

### Phase 2: Database Layer + Read-Only API
**Rationale:** All feature work depends on a correct DB layer. Analytics queries are the largest single module (1,029 TS lines) and establish the query-porting pattern for all that follows. Porting read-only endpoints first means the full frontend dashboard renders real data with no write-path risk. Response diffing against the Node.js backend validates correctness before any writes are introduced.
**Delivers:** All 16 read-only endpoints working (analytics × 11, plans × 5, health × 1); frontend dashboard renders with real data from existing `cowboy.db`; JSON response diff confirms parity with Node.js on every endpoint.
**Uses:** rusqlite (bundled), tokio-rusqlite, r2d2, serde with camelCase renaming, tower-http ServeDir
**Implements:** Database layer (8 tables, WAL mode, foreign keys) + axum routes (analytics, plans, health)
**Avoids:** Pitfall 3 (Drizzle query bugs), Pitfall 11 (serde naming)

### Phase 3: Settings + Writes + WebSocket
**Rationale:** Settings routes include mutations and path validation — higher risk than read-only. WebSocket must be built before ingestion so events have somewhere to go. The broadcast architecture (`tokio::sync::broadcast`, `AtomicU64` seq counter) must match the existing typed event protocol exactly — the frontend's `useWebSocket.ts` uses seq-gap detection and `system:full-refresh` reconnect semantics.
**Delivers:** All 25 REST endpoints working; WebSocket connected with correct event format (type, seq, payload matching `WebSocketEventPayload` discriminated union); settings save/load round-trips; frontend receives live updates.
**Uses:** axum WebSocket upgrade (built-in), `tokio::sync::broadcast`, `AtomicU64`
**Implements:** WebSocket hub, settings routes, ingest trigger route
**Avoids:** Pitfall 7 (WebSocket broadcast architecture)

### Phase 4: Ingestion Engine
**Rationale:** The most complex module (~1,500 LOC across 15 TypeScript files). Isolated in its own phase because it has no UI-blocking dependencies once Phase 3 is complete — it writes to DB and fires broadcast events, both of which exist. The high data-fidelity risk demands dedicated focus and thorough SQLite diffing. Git history shows 4 recent commits to `ingestion/` subagent linking, suggesting active instability that the port must faithfully reproduce.
**Delivers:** JSONL parsing for Claude Code and Cursor produces identical SQLite output to Node.js; subagent linking correct (three phases); plan extraction working; data quality migration idempotent; all existing conversations fully ingested by Rust backend.
**Uses:** serde_json BufReader for JSONL, rusqlite for Cursor vscdb, regex crate for plan extraction, sha2 for deterministic ID generation, walkdir for file discovery
**Implements:** Full ingestion engine (all 15 submodules: parser, normalizer, cursor parser/normalizer, subagent linker/summarizer, plan extractor, compaction utils, title utils, id generator, file discovery, orchestrator, data migration)
**Avoids:** Pitfall 5 (JSONL parser fidelity gap)

### Phase 5: File Watcher + Tray + Cutover
**Rationale:** File watcher depends on the ingestion engine being complete (Phase 4). Tray/menu work is independent of the entire backend and can be parallelized with Phases 2-4, but completing the backend first reduces moving targets. Cutover (moving Rust to port 3000, removing Node.js backend) is the final gate-check requiring the full "looks done but isn't" checklist.
**Delivers:** File changes in `~/.claude/projects` trigger automatic re-ingestion; system tray icon visible with Show/Quit menu; close-to-tray works (window hides, file watching continues in background); Cmd+Q quits cleanly; Node.js `packages/backend/` removed from repo.
**Uses:** notify 8.x, notify-debouncer-mini (two watchers: 1s Claude Code, 3s Cursor), Tauri TrayIconBuilder, Tauri Menu API
**Implements:** File watcher module, Tauri tray + native menu + close-to-tray
**Avoids:** Pitfall 6 (notify event model vs chokidar)

### Phase Ordering Rationale

- **Foundation first** because six pitfalls have Phase 1 prevention windows that close permanently once code is written around them: tokio-rusqlite pattern, AppError type, workspace structure, DB path, CSP, startup ordering.
- **Read-only API before writes** because analytics queries (1,029 TS lines) are the complexity benchmark — if the Drizzle query port produces correct results, the pattern is proven for all remaining query modules.
- **WebSocket before ingestion** because the broadcast channel is a shared infrastructure dependency that ingestion needs to emit events through; building it first means ingestion events work end-to-end from day one.
- **Ingestion isolated** because it is the highest data-correctness risk. Running Node.js at `:3000` and Rust at `:3001` in parallel with the same `cowboy.db` enables row-level SQLite diffing as a verification mechanism.
- **File watcher last** because it continuously fires ingestion; debugging is cleaner when ingestion itself is already verified correct.
- **Tray/menu can parallel Phase 2-4** because it has zero dependency on the backend — a developer can work on native chrome while another ports query modules.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Ingestion Engine):** The 15-module ingestion system has the most undocumented edge cases. Before implementation, run the existing Node.js backend with `logger: true` on a production database to capture all generated SQL. Review git history of `ingestion/` for comments about edge cases — especially the 4 recent subagent-linking commits. Catalog every Drizzle `onConflictDoNothing()` usage that was replaced with delete-then-insert patterns.
- **Phase 3 (WebSocket):** Verify the exact `WebSocketEventPayload` TypeScript discriminated union shape against the Rust serde enum before writing any broadcast code. The seq-gap-detection logic and `system:full-refresh` reconnect behavior in `useWebSocket.ts` must be preserved exactly.

Phases with well-documented patterns (standard, skip research-phase):
- **Phase 1 (Scaffold):** Tauri v2 official docs include exact Rust code examples; axum startup-inside-Tauri pattern is established in community discussions.
- **Phase 2 (DB + Read API):** Drizzle's `logger: true` provides ground-truth SQL; axum `Query<>` extractor patterns are standard.
- **Phase 5 (Tray/Menu):** Tauri v2 tray docs include complete `TrayIconBuilder` examples; close-to-tray is a 3-line `WindowEvent::CloseRequested` intercept.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All crate versions verified against docs.rs/crates.io; Tauri v2.10.3 is current stable (Oct 2024, 17 months production use); architecture decision (axum over pure IPC) validated by codebase analysis of 17 frontend composables with fetch calls |
| Features | HIGH | Based on direct TS-line-count analysis of the existing codebase; feature list is exhaustive (port not new product) |
| Architecture | HIGH | Based on codebase analysis of actual frontend API call patterns + official Tauri docs; anti-patterns are verified failures from codebase constraints |
| Pitfalls | HIGH | Pitfalls derived from concrete code analysis (1,029-line analytics.ts, WebSocket protocol in useWebSocket.ts, chokidar config) + official docs + Tauri/axum community discussions |

**Overall confidence:** HIGH

### Gaps to Address

- **tokio-rusqlite vs spawn_blocking conflict:** STACK.md (written before PITFALLS.md) recommends `Arc<Mutex<Connection>>` + `spawn_blocking`; PITFALLS.md strongly recommends `tokio-rusqlite`. **Resolution:** Use `tokio-rusqlite` — it eliminates the `MutexGuard across .await` deadlock footgun entirely. Treat spawn_blocking as the fallback only if tokio-rusqlite introduces unexpected issues.
- **axum omission in STACK.md:** STACK.md omits axum from its dependency list because it advocates Tauri IPC-only. ARCHITECTURE.md's Cargo.toml correctly includes axum 0.8. The axum-inside-Tauri approach is correct per codebase analysis — ARCHITECTURE.md takes precedence.
- **notify version discrepancy:** STACK.md recommends notify 8.x; ARCHITECTURE.md Cargo.toml shows notify "7". Use notify 8.x (more recent research, current stable).
- **Sync scheduler scope:** FEATURES.md lists it as P1 but requires reqwest (outbound HTTP). Validate whether sync-to-remote is actively used in the existing app before committing to it in v3.0 — it may be a safe P2 deferral.
- **WebKit rendering:** The frontend was developed in Chrome; Tauri macOS uses WebKit (Safari engine). Test the existing frontend in Safari before Phase 1 completes to catch rendering differences early (scrollbar styling, `backdrop-filter`, date inputs).

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Official Docs](https://v2.tauri.app) — IPC, system tray, window management, configuration, Vite integration, CSP
- [rusqlite 0.38.0 docs.rs](https://docs.rs/crate/rusqlite/latest) — bundled feature, connection API
- [notify 8.2.0 docs.rs](https://docs.rs/crate/notify/latest) — file watcher API, RecursiveMode
- [axum docs.rs](https://docs.rs/axum/latest) — WebSocket upgrade, error handling, Query extractor
- [tokio-rusqlite lib.rs](https://lib.rs/crates/tokio-rusqlite) — async SQLite wrapper pattern
- Codebase analysis: 25 Fastify routes (4 files), 17 frontend composables with `fetch()`, `useWebSocket.ts` event protocol, `analytics.ts` (1,029 LOC Drizzle queries), `file-watcher.ts` (chokidar dual-debounce config), `ingestion/` (15 modules, 4 recent subagent-linking commits)

### Secondary (MEDIUM confidence)
- [Tauri + Axum community discussion](https://github.com/tokio-rs/axum/discussions/2501) — spawn pattern inside Tauri setup
- [Tauri close-to-tray discussion](https://github.com/tauri-apps/tauri/discussions/2684) — prevent_close + window.hide() pattern
- [Tauri async runtime issue #13330](https://github.com/tauri-apps/tauri/issues/13330) — Tokio runtime ownership in Tauri
- [Rust ORMs comparison 2026](https://aarambhdevhub.medium.com/rust-orms-in-2026-diesel-vs-sqlx-vs-seaorm-vs-rusqlite-which-one-should-you-actually-use-706d0fe912f3) — rusqlite choice validation

### Tertiary (LOW confidence)
- notify-debouncer-mini behavior vs chokidar — untested against real JSONL workloads; verify debounce collapse of Create+Modify events during Phase 5 testing

---
*Research completed: 2026-03-11*
*Ready for roadmap: yes*
