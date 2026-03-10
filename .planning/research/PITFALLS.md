# Pitfalls Research

**Domain:** Tauri v2 desktop app rewrite -- Node.js/Fastify to Rust/axum with existing Vue 3 frontend
**Researched:** 2026-03-11
**Confidence:** HIGH (based on codebase analysis + official docs + community experience)

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or major architectural rework.

### Pitfall 1: Blocking the Tokio Runtime with Synchronous rusqlite Calls

**What goes wrong:**
rusqlite is entirely synchronous. Calling `conn.execute()` or `conn.query_row()` directly from an async context (whether Tauri commands or axum handlers) blocks the Tokio worker thread. With the default 4-worker runtime, just 4 concurrent slow queries stall the entire application -- no WebSocket messages get sent, no HTTP responses go out, no file watcher events get processed.

**Why it happens:**
The current Cowboy backend uses better-sqlite3 which is also synchronous, but Node.js runs on a single thread with a synchronous call model, so blocking is the expected behavior. In Rust with Tokio, the expectation flips: handlers are async and must not block. Developers port the existing synchronous call pattern 1:1 and create silent performance cliffs. Additionally, rusqlite's `Connection` is `!Sync`, so you cannot share it across async tasks with `Arc<Mutex<Connection>>` without risking deadlocks when the `MutexGuard` is held across `.await` points.

**How to avoid:**
Use `tokio-rusqlite` which wraps a `Connection` on a dedicated background thread and provides an async `call()` method:

```rust
let db = tokio_rusqlite::Connection::open("data/cowboy.db").await?;

// Every query runs on a dedicated thread -- never blocks Tokio workers
let stats = db.call(|conn| {
    let mut stmt = conn.prepare("SELECT count(*) FROM conversations WHERE ...")?;
    Ok(stats)
}).await?;
```

Pass `db: tokio_rusqlite::Connection` as shared state. A single connection is sufficient for Cowboy (single-user desktop app). Set `busy_timeout` to 5000ms so SQLite retries instead of failing when the file watcher's write collides with a dashboard read.

**Warning signs:**
- WebSocket broadcast delays under load
- UI freezes briefly when navigating between pages while ingestion is running
- File watcher events pile up instead of processing promptly

**Phase to address:**
Phase 1 (Rust backend scaffold) -- establish the database access pattern before writing any query logic.

---

### Pitfall 2: Frontend API Calls Break Under Tauri Custom Protocol

**What goes wrong:**
The existing Vue 3 frontend makes all API calls via relative URLs (`fetch('/api/conversations')`). In development with Vite's dev server proxy, these resolve correctly. In a Tauri production build, the frontend is served via `tauri://localhost` (macOS) custom protocol. Relative `/api/...` fetches resolve against this custom protocol origin, not any running HTTP server, and return network errors. The WebSocket connection (`ws://` from `location.host`) also breaks.

**Why it happens:**
The Vite dev proxy masks the fact that API calls and static assets would be served from different origins. In the current Node.js setup, Fastify serves both the API and the static frontend from the same origin. In Tauri, these are different origins.

**How to avoid:**
Run axum on `127.0.0.1:3000` inside the Tauri process. Create a centralized API client in the Vue frontend with a configurable `baseURL`:

```typescript
const BASE_URL = window.__TAURI__ ? 'http://127.0.0.1:3000' : '';
export const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`${BASE_URL}${path}`, opts);
```

Why axum (embedded HTTP server) instead of pure Tauri IPC:
- Cowboy uses WebSocket for real-time push updates (typed events, conversation-scoped routing, sequence numbers). Tauri IPC events are one-way broadcasts without the bidirectional stream semantics the frontend relies on.
- The frontend has ~30 API endpoints. Converting every `fetch()` to `invoke()` is far more work than adding a `baseURL`.
- The existing `useWebSocket.ts` composable assumes a standard WebSocket protocol. Rewriting it for Tauri events would touch every page component.

**Warning signs:**
- API calls work in `tauri dev` (Vite proxy active) but fail in `tauri build`
- Console shows `Failed to fetch` or `net::ERR_FAILED` in production webview
- WebSocket refuses to connect

**Phase to address:**
Phase 1 (scaffold) -- this architectural decision cascades through every subsequent phase.

---

### Pitfall 3: Porting Drizzle ORM Queries to Raw SQL Incorrectly

**What goes wrong:**
The current codebase has ~1,000 lines of Drizzle ORM queries in `analytics.ts` alone, using Drizzle's query builder with `sql` template literals, `.innerJoin()`, `.groupBy()`, `.where(and(...))`, dynamic sort columns, NULLS LAST logic, EXISTS subqueries, and per-model cost aggregation. Porting these to hand-written SQL strings for rusqlite introduces subtle bugs: wrong JOIN conditions, missing NULL coalescing, broken GROUP BY columns, dropped filter conditions, or incorrect parameter binding order.

**Why it happens:**
Rust has no direct equivalent of Drizzle's TypeScript query builder for SQLite. The pragmatic choice is raw SQL with rusqlite, but hand-translating complex queries like `getConversationList()` -- which has dynamic sort columns, NULLS LAST via CASE WHEN, EXISTS subqueries for search and parent/child filtering, per-model secondary queries, and JS-side cost sort -- is error-prone.

**How to avoid:**
1. **Capture Drizzle's generated SQL first**: Enable Drizzle's `logger: true` option and run the existing Node.js backend. Log every SQL statement. Use those exact SQL strings as the starting point.
2. **Port queries incrementally with response diffing**: For each API endpoint, run both backends against the same `cowboy.db` and diff JSON responses. They must be identical.
3. **Use rusqlite named parameters** (`:param`) instead of positional `?` to avoid off-by-one binding errors.
4. **Handle Drizzle's `json` mode columns explicitly**: Drizzle auto-parses `text('input', { mode: 'json' })`. In rusqlite, `tool_calls.input`, `tool_calls.output`, `tool_calls.subagent_summary`, and `settings.sync_categories` are raw text -- call `serde_json::from_str()` explicitly.
5. **Preserve the Number() casts**: The current JS code does `Number(row.totalInput)` because Drizzle returns bigints for aggregates. rusqlite returns `i64` natively -- verify types match.

**Warning signs:**
- Dashboard numbers differ between old and new backends on the same database
- NULL project names crash instead of showing "Unknown"
- Cost sort produces different ordering
- Pagination returns wrong total counts
- Search returns fewer results (broken EXISTS subquery)

**Phase to address:**
Phase 2 (database and query layer) -- port all queries with logged SQL from Drizzle as reference.

---

### Pitfall 4: CSP Blocks Inline Styles, API Calls, and WebSocket Connections

**What goes wrong:**
Tauri v2 enforces a Content Security Policy by default. DaisyUI themes use oklch() color values set via inline `style` attributes on `<html>`. The CSP must also allow `connect-src` for both `http://127.0.0.1:3000` (API) and `ws://127.0.0.1:3000` (WebSocket). Missing any of these causes silent failures that only manifest in production builds.

**Why it happens:**
Tauri's CSP is strict by default. At compile time, Tauri appends nonces for bundled scripts, but inline styles from DaisyUI theming and connections to an embedded HTTP server are not automatically handled.

**How to avoid:**
Configure CSP explicitly in `tauri.conf.json`:

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:3000 ws://127.0.0.1:3000; img-src 'self' data:; script-src 'self'"
    }
  }
}
```

- `'unsafe-inline'` in `style-src` is required for DaisyUI's dynamic theming
- `connect-src` must include both HTTP and WS schemes
- Test with `tauri build`, not just `tauri dev` (CSP may be relaxed in dev)

**Warning signs:**
- "Refused to connect" or "Refused to apply inline style" in console
- Dashboard loads but shows no data (API blocked silently)
- Theme switching stops working
- Works in `tauri dev` but breaks in `tauri build`

**Phase to address:**
Phase 1 (scaffold) -- configure CSP immediately and verify with the existing frontend.

---

### Pitfall 5: JSONL Parser Fidelity Gap

**What goes wrong:**
The existing TypeScript JSONL parser handles dozens of edge cases accumulated over 6 milestones: streaming content deduplication (replace-not-append), compaction detection with token delta computation, three-phase subagent resolution (agentId/description/position), title extraction with skip logic (XML stripping, caveat skipping, slash command filtering), content block type disambiguation (string vs array), double-encoded JSON in tool inputs, and NULL-model backfill from token usage. The Rust rewrite misses edge cases and produces different data.

**Why it happens:**
The parser is ~1,500 LOC across `ingestion/`. Subtle behaviors are encoded in TypeScript idioms:
- `JSON.parse(line)` in try/catch silently skips bad lines -- Rust `serde_json::from_str().unwrap()` panics
- `content.substring(0, 100)` in JS handles multi-byte correctly -- Rust `&content[..100]` panics on UTF-8 boundary
- `toolResultLookup` uses `Map` with string keys -- Rust `HashMap` behaves the same but the builder pattern is different
- Drizzle's `onConflictDoNothing()` was replaced with delete-then-insert (v1.3) -- must port the exact same idempotency logic

**How to avoid:**
1. Write the Rust parser against the SAME JSONL test files used during Node.js development
2. Run BOTH backends against real JSONL files and diff the SQLite output row-by-row
3. Port edge cases one-by-one with explicit test coverage for each
4. Handle per-line errors gracefully:
   ```rust
   let trimmed = line.trim();
   if trimmed.is_empty() { continue; }
   match serde_json::from_str::<Value>(trimmed) {
       Ok(v) => { /* process */ },
       Err(e) => { tracing::warn!(line_num, %e, "Skipping malformed line"); continue; }
   }
   ```
5. For string truncation, use `content.chars().take(100).collect::<String>()` not byte slicing

**Warning signs:**
- Conversation count differs between backends on same data
- Missing subagent links
- Wrong token counts
- Panics on real JSONL files

**Phase to address:**
Phase 2 (ingestion) -- this is the highest-risk port because it affects data correctness for everything downstream.

---

### Pitfall 6: notify Crate Event Model Differs Fundamentally from Chokidar

**What goes wrong:**
The current file watcher uses chokidar with per-agent debouncing (1s Claude Code, 3s Cursor), `depth: 5`, and file extension filtering. The `notify` crate has no built-in glob filtering, no depth limiting, different event types, and different debouncing semantics. A naive port gets duplicate events, missed events, or excessive resource consumption.

**Why it happens:**
Chokidar is high-level; notify is low-level. Specific differences:
- chokidar `add` = notify `Create` -- but on macOS, a new file fires BOTH `Create` AND `Modify`
- chokidar `change` = notify `Modify(Data)` -- but notify also fires `Modify(Metadata)` which should be filtered
- chokidar has `depth: 5` built in; notify watches recursively with no depth control
- chokidar has `ignoreInitial: true`; notify does not fire initial events (implementation detail)

**How to avoid:**
1. Use `notify-debouncer-mini` rather than raw notify for debouncing
2. Create TWO separate watchers (Claude Code at 1s, Cursor at 3s) matching current architecture
3. Filter by extension manually: `path.extension() == Some("jsonl")`
4. Filter Cursor by filename: `path.file_name() == Some("state.vscdb")`
5. Filter out metadata-only changes: only react to `ModifyKind::Data`
6. The debouncer collapses Create+Modify within the window

**Warning signs:**
- Ingestion fires twice per file change
- New JSONL files not detected (wrong event kind)
- Excessive CPU from watching too deep

**Phase to address:**
Phase 3 (file watcher) -- needs testing with real JSONL writes.

---

### Pitfall 7: WebSocket Broadcast Architecture Mismatch

**What goes wrong:**
The current Fastify WebSocket uses `websocketServer.clients` for broadcasting -- a simple `Set<WebSocket>` loop. In tokio-tungstenite, there is no built-in client registry. Each connection is an independent stream/sink. Without proper architecture, developers fight the borrow checker trying to share sink references.

**Why it happens:**
Fastify's plugin manages client lifecycle automatically. In Rust, you must build the broadcast infrastructure with Tokio primitives.

**How to avoid:**
Use `tokio::sync::broadcast` channel:

```rust
let (tx, _rx) = broadcast::channel::<String>(100);

// Per-client: subscribe and forward
let mut rx = tx.subscribe();
tokio::spawn(async move {
    while let Ok(msg) = rx.recv().await {
        if ws_sink.send(Message::Text(msg)).await.is_err() { break; }
    }
});

// Broadcast from ingestion callback:
let _ = tx.send(serde_json::to_string(&event)?);
```

- Capacity 100 is sufficient for Cowboy's event volume
- Lagging receivers get `RecvError::Lagged` -- log and continue
- The `seq` counter becomes `AtomicU64`
- Client cleanup is automatic when the spawned task drops

**Warning signs:**
- Borrow checker errors around sink sharing
- Memory growing over time
- Messages arriving out of order

**Phase to address:**
Phase 4 (WebSocket layer) -- after HTTP API works.

---

### Pitfall 8: Rust Compilation Time Destroys Development Flow

**What goes wrong:**
Clean build with axum + rusqlite + tokio + serde + notify + Tauri takes 3-8 minutes. Incremental rebuilds take 15-40 seconds. Current Node.js hot-reloads in <1 second. This 15-40x slowdown causes developers to batch changes and skip integration testing.

**Why it happens:**
Rust compilation + Tokio/serde proc macros + Tauri platform bindings.

**How to avoid:**
1. **Develop axum standalone** with `cargo watch -x run` -- skip Tauri overhead during backend development
2. **Split into workspace crates**: `cowboy-backend` (library) + `cowboy-tauri` (binary). Library changes don't trigger Tauri rebuilds.
3. **Optimize Cargo.toml**:
   ```toml
   [profile.dev.package."*"]
   opt-level = 2  # Optimize deps, not your code
   ```
4. Use `sccache` for cross-build caching
5. Only use `tauri dev` for integration testing, not regular development

**Warning signs:**
- >30 second rebuilds for one-line changes
- Developer avoids running in Tauri
- Backend tests take >10 seconds to compile

**Phase to address:**
Phase 1 (scaffold) -- crate workspace structure from day one. Retrofitting later requires moving files across the entire codebase.

---

### Pitfall 9: axum Error Handling -- Infallible Requirement

**What goes wrong:**
axum requires handler return types to implement `IntoResponse`. Returning `Result<Json<T>, rusqlite::Error>` fails to compile because `rusqlite::Error` does not implement `IntoResponse`. Developers fight type system errors or litter code with `.unwrap()`.

**Why it happens:**
Fastify catches thrown exceptions with a global error handler. Rust has no exceptions -- errors must be explicit. axum enforces this at compile time.

**How to avoid:**
Define `AppError` once:

```rust
pub enum AppError {
    NotFound(String),
    Database(rusqlite::Error),
    Internal(anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, msg) = match self {
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, m),
            AppError::Database(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            AppError::Internal(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        };
        (status, Json(json!({ "error": msg }))).into_response()
    }
}

impl From<rusqlite::Error> for AppError { ... }
```

All handlers return `Result<Json<T>, AppError>` and use `?` freely.

**Warning signs:**
- "the trait `IntoResponse` is not implemented" compile errors
- Handlers full of `.map_err()` chains
- `unwrap()` in handler code

**Phase to address:**
Phase 1 (scaffold) -- define before writing any route handler.

---

### Pitfall 10: Tauri + axum Process Coordination

**What goes wrong:**
axum must be listening before the Tauri webview loads. If spawned concurrently, the webview races the server -- showing a blank page or connection errors. On quit, axum must shut down gracefully (close DB, stop watchers) but Tauri's exit may not wait.

**How to avoid:**
Start axum before Tauri, verify it's listening:

```rust
#[tokio::main]
async fn main() {
    let listener = TcpListener::bind("127.0.0.1:3000").await.unwrap();
    let server_handle = tokio::spawn(axum::serve(listener, app).into_future());

    tauri::Builder::default()
        .setup(|_app| { /* axum already running */ Ok(()) })
        .run(tauri::generate_context!())
        .expect("tauri error");

    server_handle.abort(); // After Tauri exits
}
```

For graceful shutdown, use `CancellationToken` shared between Tauri and axum.

**Warning signs:**
- Blank screen on launch (axum not ready)
- "Connection refused" on startup
- Database lock errors on second launch (previous instance still running)

**Phase to address:**
Phase 1 (scaffold) -- startup/shutdown sequence must be correct from the start.

---

## Moderate Pitfalls

### Pitfall 11: Serde Field Name Mismatches

**What goes wrong:** Rust uses `snake_case`; the frontend expects `camelCase` JSON keys. Without `#[serde(rename_all = "camelCase")]`, the frontend receives `total_conversations` instead of `totalConversations`.

**Prevention:** Add `#[serde(rename_all = "camelCase")]` to EVERY struct returned to the frontend. Create a lint rule or code review checklist item.

### Pitfall 12: WebKit Rendering Differences

**What goes wrong:** The frontend was developed in Chrome. Tauri macOS uses WebKit (Safari engine). Known differences: date/time inputs not styled correctly, `scrollbar-width: thin` is Firefox-only, and `backdrop-filter` may render differently.

**Prevention:** Test in Safari before and during development. oklch() colors are supported (Safari 15.4+ / macOS 12+). The `details/summary` pattern already used by the codebase works in WebKit. Require macOS 12+ minimum.

### Pitfall 13: Database Path Resolution

**What goes wrong:** The current backend uses `./data/cowboy.db` (relative). In Tauri, the binary's working directory is unpredictable. The app creates the database in an unexpected location or cannot find the existing one.

**Prevention:** Use Tauri's `app.path().app_data_dir()` for the database path. Detect and migrate the existing `./data/cowboy.db` if found. Set via environment variable so the axum server (running in the same process) knows the path.

### Pitfall 14: Tauri v2 Capabilities/Permissions

**What goes wrong:** Tauri v2 has a capability-based security model. Commands and plugins must be listed in `src-tauri/capabilities/`. Missing entries cause silent failures.

**Prevention:** For this localhost-only personal app, create a permissive default capability file. Even if using HTTP instead of IPC commands, plugins like system-tray need capabilities configured.

### Pitfall 15: Cargo.lock Not Committed

**What goes wrong:** Some projects .gitignore Cargo.lock for libraries. For applications (Tauri apps), Cargo.lock MUST be committed for reproducible builds.

**Prevention:** Ensure Cargo.lock is tracked in git from the first commit.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `unwrap()` on database results | Faster prototyping | Panics crash Tauri app | Never in production; OK in tests |
| `String` everywhere instead of typed enums for agent/role/status | Matches SQLite text columns | No compile-time validation | Early prototype; convert to enums by Phase 3 |
| Cloning large JSON for broadcast | Avoids lifetime complexity | Memory pressure | Acceptable for Cowboy (single-user, <5 clients) |
| Single tokio-rusqlite Connection | Simpler architecture | Serializes all DB access | Acceptable for Cowboy (single-user desktop) |
| Using HTTP server when IPC would suffice for some calls | Consistent single pattern | Extra dependency, port binding | Acceptable -- consistency trumps minimalism for 30+ endpoints |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Tauri + axum startup | Running both without ordering | Start axum first, then Tauri; or use readiness signal |
| Vue fetch + custom protocol | Leaving relative URLs unchanged | Centralized API client with `baseURL = http://127.0.0.1:3000` |
| DaisyUI + WKWebView | Assuming Chrome testing is sufficient | Test in Safari during development |
| rusqlite + WAL mode | Forgetting pragma (rusqlite defaults to DELETE journal) | `conn.pragma_update(None, "journal_mode", "WAL")?` on open |
| rusqlite + foreign keys | Foreign keys OFF by default | `conn.pragma_update(None, "foreign_keys", "ON")?` on open |
| System tray + close-to-tray | Default close terminates process | Intercept `CloseRequested` event, call `window.hide()` |
| Shared types (TS + Rust) | Defining types twice, drift | Use `ts-rs` crate or manually mirror `@cowboy/shared` types |
| Drizzle json-mode columns | Expecting auto-parse in rusqlite | Explicit `serde_json::from_str()` on tool_calls.input/output/subagent_summary |
| Database path | Relative `./data/cowboy.db` | Use `app.path().app_data_dir()` for stable absolute path |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sync rusqlite in async context | UI freezes during queries | Use tokio-rusqlite | When 5+ concurrent requests |
| Cloning full conversation for broadcast | Memory spike | Broadcast metadata only; client re-fetches | Conversations with >1000 messages |
| Recursive watch without depth filter | CPU spike from FSEvents | Filter by path depth | >50 projects with deep trees |
| Re-parsing unchanged JSONL files | Ingestion takes seconds | Port mtime/size check from ingestedFiles | >100 conversation files |
| Large serde_json serialization on async thread | Blocks Tokio worker | spawn_blocking for >100KB responses | Conversation detail >1MB |
| Full Tauri rebuild on every Rust change | 30-40 second rebuilds | Separate library crate; cargo watch standalone | During active development |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Binding axum to `0.0.0.0` | Exposes API to LAN | Always `127.0.0.1:3000` |
| Permissive CSP (`default-src *`) | XSS if content injected | Minimal CSP with specific origins |
| DB in asset protocol scope | Database readable from JS | Never expose data directory |
| String interpolation in SQL | SQL injection | Parameterized queries only |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| WKWebView scrollbar differences | Default macOS overlay scrollbars | Use `::-webkit-scrollbar` pseudo-elements |
| `backdrop-filter` in WKWebView | Different rendering | Test in Safari; solid fallback |
| oklch on old macOS | Colors broken pre-Monterey | Require macOS 12+ (Safari 15.4+) |
| Blank screen during startup | Confusing first impression | Start axum before Tauri webview loads |
| Custom title bar CSS | Conflicts with native chrome | Use `decorations: true` + `titleBarStyle: "visible"` |

## "Looks Done But Isn't" Checklist

- [ ] **API parity**: All 4 route files return identical JSON shapes -- diff old vs new backend responses
- [ ] **WebSocket event format**: Events include `seq`, `type`, and payload matching `WebSocketEventPayload` union
- [ ] **Ingestion idempotency**: Re-run on unchanged files produces no DB changes (mtime/size guard)
- [ ] **Migrations idempotent**: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`
- [ ] **File watcher restart**: Settings save triggers watcher restart with new paths
- [ ] **Subagent linking**: Three-phase matching produces same parent-child links
- [ ] **Cost calculation**: Ported `calculateCost()` produces identical values for all model pricing
- [ ] **Close-to-tray**: Window close hides to tray; file watching continues in background
- [ ] **CSP in production**: `tauri build` app loads dashboard with data and WebSocket
- [ ] **Debounce timing**: Claude Code 1s, Cursor 3s (matching Node.js)
- [ ] **Database location**: Created under Tauri app data dir, not relative to binary
- [ ] **SQLite pragmas**: WAL mode + foreign keys ON on every connection

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Blocked Tokio runtime | MEDIUM | Wrap all DB calls in tokio-rusqlite; mechanical but touches every handler |
| URL breakage in Tauri | LOW | Add baseURL to API client; one utility file |
| Wrong SQL from Drizzle port | HIGH | Re-derive queries; diff JSON responses as validation |
| CSP blocks connections | LOW | Update CSP in tauri.conf.json; immediate fix |
| notify double-fire | LOW | Add notify-debouncer-mini; drop-in |
| WebSocket broadcast | MEDIUM | Refactor to broadcast channel; WebSocket module only |
| JSONL parse panics | LOW | Per-line error handling; localized parser change |
| Slow rebuilds | LOW-MEDIUM | Restructure into workspace crates; one-time |
| Error handling | LOW | Define AppError once; all handlers benefit |
| Startup race | MEDIUM | Restructure main() to order startup |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Blocking Tokio runtime | Phase 1: Scaffold | All DB calls use tokio-rusqlite |
| URL breakage | Phase 1: Scaffold | Frontend fetches from `http://127.0.0.1:3000/api/health` in Tauri |
| CSP | Phase 1: Scaffold | WS + API work in `tauri build` |
| Error handling | Phase 1: Scaffold | AppError defined; handlers use `?` |
| Startup race | Phase 1: Scaffold | No blank screen on launch |
| Slow rebuilds | Phase 1: Scaffold | Library crate incremental rebuild <15s |
| Database path | Phase 1: Scaffold | DB in Tauri app data dir |
| Drizzle query port | Phase 2: Database | JSON diff of all endpoints = zero differences |
| JSONL parser fidelity | Phase 2: Ingestion | Conversation count matches Node.js exactly |
| Serde naming | Phase 2: Database | Frontend renders all fields correctly |
| notify event model | Phase 3: File watcher | Single ingestion trigger per file change |
| WebSocket broadcast | Phase 4: WebSocket | Live updates appear in webview |
| WebKit rendering | Phase 5: Integration | Visual comparison Safari vs Chrome |
| Close-to-tray | Phase 5: Integration | Tray icon present; file watching continues |

## Sources

- [Tauri v2 CSP Documentation](https://v2.tauri.app/security/csp/)
- [Tauri v2 IPC Concepts](https://v2.tauri.app/concept/inter-process-communication/)
- [Tauri v2 Webview Versions](https://v2.tauri.app/reference/webview-versions/)
- [Tauri v2 Development Guide](https://v2.tauri.app/develop/)
- [Tauri v2 Frontend Configuration](https://v2.tauri.app/start/frontend/)
- [Tauri v2 Localhost Plugin](https://v2.tauri.app/plugin/localhost/)
- [Tauri v2 Configuration Reference](https://v2.tauri.app/reference/config/)
- [tokio-rusqlite crate](https://lib.rs/crates/tokio-rusqlite)
- [rusqlite async issues](https://github.com/rusqlite/rusqlite/issues/697)
- [Common Mistakes with Rust Async](https://www.qovery.com/blog/common-mistakes-with-rust-async)
- [notify crate](https://crates.io/crates/notify)
- [notify-debouncer-mini](https://docs.rs/notify-debouncer-mini/latest/notify_debouncer_mini/)
- [notify-debouncer-full](https://docs.rs/notify-debouncer-full)
- [axum error handling](https://docs.rs/axum/latest/axum/error_handling/index.html)
- [axum anyhow example](https://github.com/tokio-rs/axum/blob/main/examples/anyhow-error-response/src/main.rs)
- [tokio-tungstenite broadcast](https://github.com/snapview/tokio-tungstenite/issues/271)
- [rusqlite_migration](https://cj.rs/rusqlite_migration/)
- [OKLCH browser support](https://caniuse.com/mdn-css_types_color_oklch)
- [Tailwind CSS browser support](https://tailwindcss.com/docs/browser-support)
- [SQLite pragma cheatsheet](https://cj.rs/blog/sqlite-pragma-cheatsheet-for-performance-and-consistency/)
- Codebase: `packages/backend/src/db/queries/analytics.ts` (~1000 LOC of Drizzle queries), `packages/backend/src/plugins/websocket.ts` (broadcast pattern), `packages/backend/src/plugins/file-watcher.ts` (chokidar with dual debounce), `packages/backend/src/ingestion/normalizer.ts` (~380 LOC with edge cases), `packages/frontend/vite.config.ts` (proxy config)

---
*Pitfalls research for: Cowboy v3.0 Tauri v2 + Rust backend rewrite*
*Researched: 2026-03-11*
