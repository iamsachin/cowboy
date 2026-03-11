# Phase 40: File Watcher + Desktop Chrome - Research

**Researched:** 2026-03-11
**Domain:** Rust file watching (notify crate), Tauri v2 system tray/menu, Node.js cleanup
**Confidence:** HIGH

## Summary

Phase 40 converts Cowboy from a hybrid Node.js+Rust app into a pure Tauri desktop app. The three main domains are: (1) file watching via the `notify` crate to trigger automatic ingestion on JSONL/vscdb changes, (2) desktop chrome -- system tray with close-to-tray behavior and native menu bar, and (3) cleanup -- removing packages/backend, merging shared types into frontend, and updating all configuration to use port 8123.

The existing Node.js file-watcher.ts provides a clear reference implementation with the exact debounce timings, path patterns, and settings-aware restart logic. The Rust implementation maps cleanly: `notify` + `notify-debouncer-mini` replace `chokidar`, Tauri's built-in `TrayIconBuilder` and `MenuBuilder` handle all desktop chrome needs, and `on_window_event` with `CloseRequested`/`prevent_close` implements hide-to-tray.

**Primary recommendation:** Use `notify` 8.x with custom tokio-based debouncing (simpler than notify-debouncer-mini for this use case), Tauri's built-in tray-icon and menu features (no plugins needed), and a bulk file operation for the Node.js cleanup.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Default port: 8123 (not 3000 or 3001 -- user has other apps on 3000)
- Port 8123 used always (both dev and production builds)
- Configurable via Settings page in UI (new field in settings table)
- Port change shows toast notification: "Port changed. Restart app to apply."
- Update CSP connect-src in tauri.conf.json for :8123
- Update Vite proxy target to :8123
- Cowboy hat silhouette as monochrome template image (~22x22pt, single color) for tray
- macOS auto-handles light/dark menu bar adaptation
- Static icon -- no status animation or badge
- Context menu: Show + Quit (no separator, no pause)
- Show: brings main window to front
- Quit: exits app completely (stops file watchers, closes connections)
- Closing the window hides the app (window hidden, not destroyed)
- File watching continues in background
- Tray "Show" restores the window
- App only fully exits via tray Quit or native menu Quit
- App name menu: About (shows Tauri about dialog) + Quit
- Edit menu: Undo, Redo, Cut, Copy, Paste, Select All (standard macOS edit shortcuts)
- No custom menus beyond these standard items
- Delete packages/backend entirely (full removal, not archive)
- Merge packages/shared types into packages/frontend/src/types/ (eliminate shared package)
- Delete diff-backends.sh and related migration testing scripts (in scripts/ dir)
- Remove `pnpm dev` command -- `cargo tauri dev` is the only entry point
- Update pnpm-workspace.yaml to remove backend and shared packages
- Clean up root package.json scripts
- notify crate watches Claude Code and Cursor log directories
- Debounce: 1s for Claude Code (.jsonl changes), 3s for Cursor (state.vscdb)
- Only watch enabled agents (respect claudeCodeEnabled/cursorEnabled settings toggles)
- Claude Code: watch ~/.claude/projects/ (or custom path from settings), depth 5, filter .jsonl files
- Cursor: watch ~/Library/Application Support/Cursor/User/globalStorage/, depth 0, filter state.vscdb
- Settings path change: auto-restart file watcher with new paths + trigger full re-ingestion
- Settings agent toggle change: restart watcher (add/remove agent watcher accordingly)
- Broadcast settings:changed WebSocket event on path/toggle changes (already wired in Phase 38)
- Wire up POST /settings/refresh-db to trigger run_ingestion() (no longer 501)
- Leave POST /settings/test-sync and POST /settings/sync-now as 501 (remote sync out of scope)

### Claude's Discretion
- notify crate configuration (polling vs native events, recursive watch settings)
- Tray icon generation approach (SVG to PNG conversion, asset pipeline)
- Shared types migration strategy (bulk move vs incremental)
- File watcher module structure within src-tauri/src/
- How to pass watcher handle to settings routes for restart capability

### Deferred Ideas (OUT OF SCOPE)
- Support for additional agents (Gemini CLI, Codex, OpenCode) -- future phase
- Distributable .dmg installer -- out of scope for v3.0
- Pause/resume file watching from tray menu -- not needed, keep tray minimal

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WATCH-01 | notify crate watches Claude Code and Cursor log directories | notify 8.x with RecommendedWatcher, FSEvents backend on macOS; file_discovery.rs already has path logic |
| WATCH-02 | Debounced events trigger ingestion (no duplicate processing) | Custom tokio::time-based debouncing with per-agent timers (1s Claude, 3s Cursor); run_ingestion() already exists |
| DESK-01 | System tray icon with context menu (Show/Quit) | Tauri built-in tray-icon feature, TrayIconBuilder with MenuItem::with_id for Show/Quit |
| DESK-02 | Close-to-tray behavior (closing window hides app, tray stays) | on_window_event with CloseRequested + api.prevent_close() + window.hide() |
| DESK-03 | Minimal native menu bar (app name menu: About, Quit; Edit menu for copy/paste) | Tauri built-in menu feature, SubmenuBuilder with PredefinedMenuItem for standard items |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| notify | 8.x | Cross-platform filesystem event watching | De facto Rust file watcher; uses FSEvents on macOS (native, efficient) |
| tauri | 2.10.3 | Desktop app framework (already in project) | Built-in tray-icon and menu features, no plugins needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tokio | 1.x (already present) | Async runtime, debounce timers | Custom debounce via tokio::time::sleep + select! |
| image | 0.25+ | PNG tray icon generation (if needed) | Only if hand-creating tray icon from SVG at build time |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom debounce | notify-debouncer-mini 0.7 | Mini debouncer uses crossbeam channels (sync); custom tokio debounce integrates better with existing async code and allows per-agent debounce durations |
| notify RecommendedWatcher | notify PollWatcher | PollWatcher needed only for network filesystems; local dirs use native FSEvents |

**Installation:**
```bash
# In src-tauri/Cargo.toml
cargo add notify@8
```

```toml
# Update tauri features
tauri = { version = "2", features = ["tray-icon", "image-png"] }
```

## Architecture Patterns

### Recommended Project Structure
```
src-tauri/src/
  lib.rs              # Tauri setup: tray, menu, close-to-tray, spawn server
  server.rs           # Axum server on :8123, spawn file watcher instead of auto-ingest
  watcher.rs          # NEW: File watcher module (notify + debounce + settings integration)
  settings.rs         # Updated: watcher restart on path/toggle changes, refresh-db wired
  ingestion/mod.rs    # Existing: run_ingestion() called by watcher
  websocket.rs        # Existing: broadcast_event() called by watcher
  ...
src-tauri/icons/
  icon.png            # Existing app icon
  tray-icon.png       # NEW: 22x22 monochrome template image for macOS tray
```

### Pattern 1: File Watcher with Tokio Integration
**What:** Spawn notify watcher in a dedicated thread, bridge events to tokio via mpsc channel, debounce in async context.
**When to use:** When the watcher needs to trigger async operations (DB writes, WebSocket broadcasts).
**Example:**
```rust
// Source: notify docs + tokio pattern
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config, Event};
use std::path::Path;
use tokio::sync::mpsc;

pub struct FileWatcherHandle {
    _watcher: RecommendedWatcher,
    shutdown_tx: tokio::sync::oneshot::Sender<()>,
}

pub fn start_watcher(
    state: AppState,
    claude_path: Option<String>,
    cursor_path: Option<String>,
    claude_enabled: bool,
    cursor_enabled: bool,
) -> Result<FileWatcherHandle, notify::Error> {
    let (tx, mut rx) = mpsc::channel::<Event>(100);

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = tx.blocking_send(event);
            }
        },
        Config::default(),
    )?;

    // Watch paths based on enabled agents
    if claude_enabled {
        let path = claude_path.unwrap_or_else(default_claude_path);
        watcher.watch(Path::new(&path), RecursiveMode::Recursive)?;
    }
    if cursor_enabled {
        if let Some(path) = cursor_path.or_else(default_cursor_path) {
            watcher.watch(Path::new(&path), RecursiveMode::NonRecursive)?;
        }
    }

    let (shutdown_tx, mut shutdown_rx) = tokio::sync::oneshot::channel();

    // Spawn debounce loop
    tokio::spawn(async move {
        let mut claude_timer: Option<tokio::time::Instant> = None;
        let mut cursor_timer: Option<tokio::time::Instant> = None;

        loop {
            tokio::select! {
                Some(event) = rx.recv() => {
                    // Classify event and reset appropriate timer
                    for path in &event.paths {
                        if path.extension().map_or(false, |e| e == "jsonl") {
                            claude_timer = Some(tokio::time::Instant::now()
                                + std::time::Duration::from_secs(1));
                        } else if path.file_name().map_or(false, |n| n == "state.vscdb") {
                            cursor_timer = Some(tokio::time::Instant::now()
                                + std::time::Duration::from_secs(3));
                        }
                    }
                }
                _ = async {
                    if let Some(deadline) = claude_timer {
                        tokio::time::sleep_until(deadline).await;
                    } else {
                        std::future::pending::<()>().await;
                    }
                } => {
                    claude_timer = None;
                    // Trigger ingestion
                    trigger_ingestion(&state).await;
                }
                _ = async {
                    if let Some(deadline) = cursor_timer {
                        tokio::time::sleep_until(deadline).await;
                    } else {
                        std::future::pending::<()>().await;
                    }
                } => {
                    cursor_timer = None;
                    trigger_ingestion(&state).await;
                }
                _ = &mut shutdown_rx => break,
            }
        }
    });

    Ok(FileWatcherHandle { _watcher: watcher, shutdown_tx })
}
```

### Pattern 2: Watcher Handle in AppState for Restart
**What:** Store watcher handle behind Arc<Mutex<>> in AppState so settings routes can restart it.
**When to use:** When settings changes need to stop old watcher and start new one.
**Example:**
```rust
pub struct AppStateInner {
    pub db: Connection,
    pub tx: broadcast::Sender<String>,
    pub watcher: Mutex<Option<FileWatcherHandle>>,
}

// In settings.rs update_agent handler:
async fn update_agent(State(state): State<AppState>, ...) -> ... {
    // ... update DB ...

    // Restart file watcher with new settings
    let mut watcher_guard = state.watcher.lock().await;
    if let Some(old) = watcher_guard.take() {
        drop(old); // Sends shutdown signal via oneshot drop
    }
    *watcher_guard = Some(start_watcher(state.clone(), ...)?);

    // Trigger re-ingestion
    tokio::spawn(run_ingestion(state.clone(), ...));
}
```

### Pattern 3: Tauri Setup with Tray + Menu + Close-to-Tray
**What:** Configure all desktop chrome in lib.rs setup hook.
**When to use:** App initialization.
**Example:**
```rust
use tauri::{
    menu::{MenuBuilder, MenuItem, Menu, SubmenuBuilder},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    Manager, WindowEvent, image::Image,
};

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // -- Database init (existing) --
            let db = ...;

            // -- Native menu bar --
            let app_menu = SubmenuBuilder::new(app, "Cowboy")
                .about(None::<tauri::menu::AboutMetadata>)
                .separator()
                .quit()
                .build()?;
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let menu = MenuBuilder::new(app)
                .items(&[&app_menu, &edit_menu])
                .build()?;
            app.set_menu(menu)?;

            // -- System tray --
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let tray_icon = Image::from_path("icons/tray-icon.png")?;
            TrayIconBuilder::new()
                .icon(tray_icon)
                .icon_as_template(true) // macOS template image
                .menu(&tray_menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // -- Spawn HTTP server --
            tauri::async_runtime::spawn(server::start(db));

            Ok(())
        })
        // -- Close-to-tray --
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Anti-Patterns to Avoid
- **Creating watcher inside tokio runtime directly:** notify's RecommendedWatcher uses a background thread internally. Create it with `new()`, don't try to make it async. Bridge to tokio via mpsc channel.
- **Polling instead of native events:** macOS FSEvents is very efficient; don't default to PollWatcher unless on a network FS.
- **Watching too broadly:** Don't watch the entire home directory. Watch specific paths with appropriate depth.
- **Forgetting `icon_as_template(true)`:** Without this, the tray icon won't adapt to macOS light/dark menu bar.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File system events | Custom FSEvents bindings | `notify` crate | Handles macOS FSEvents, Linux inotify, etc. with unified API |
| Tray icon | Raw NSStatusItem via objc | Tauri's `TrayIconBuilder` | Already integrated with Tauri lifecycle, handles cleanup |
| Native menu | NSMenu via objc | Tauri's `MenuBuilder` + `SubmenuBuilder` | PredefinedMenuItem handles all standard items with correct accelerators |
| Close-to-tray | Custom window management | `on_window_event` + `prevent_close` | Tauri's API handles platform differences |

**Key insight:** Tauri v2 has all desktop chrome built in -- no plugins needed for tray, menu, or window management on macOS.

## Common Pitfalls

### Pitfall 1: notify watcher dropped too early
**What goes wrong:** File watcher stops immediately after creation.
**Why it happens:** `RecommendedWatcher` stops watching when dropped. If stored in a local variable, it's dropped at end of scope.
**How to avoid:** Store the watcher in a long-lived struct (FileWatcherHandle) that's held in AppState. The watcher must live as long as the app.
**Warning signs:** File changes not detected, no events in logs.

### Pitfall 2: Debounce race with ingestion lock
**What goes wrong:** Multiple debounce timers fire simultaneously, causing concurrent ingestion attempts.
**Why it happens:** Claude Code and Cursor timers can both expire at the same time.
**How to avoid:** The existing `run_ingestion()` already checks `status.running` and returns early if already running. Ensure the watcher uses the same SharedStatus instance.
**Warning signs:** "Ingestion already in progress" log messages during normal operation (benign but noisy).

### Pitfall 3: Tray icon not visible on macOS dark mode
**What goes wrong:** Tray icon invisible or hard to see on dark menu bar.
**Why it happens:** Using a colored icon instead of a template image.
**How to avoid:** Use `.icon_as_template(true)` on TrayIconBuilder. Provide a monochrome PNG where the shape is black on transparent background. macOS automatically inverts for dark mode.
**Warning signs:** Icon visible on light menu bar but disappears on dark.

### Pitfall 4: shared types import breakage during cleanup
**What goes wrong:** Frontend build fails after removing @cowboy/shared package.
**Why it happens:** 20+ files import from `@cowboy/shared`. All need updating to local paths.
**How to avoid:** Move shared types files first, update imports via find-and-replace, verify `pnpm --filter @cowboy/frontend build` succeeds before deleting shared package.
**Warning signs:** TypeScript compilation errors referencing `@cowboy/shared`.

### Pitfall 5: CSP blocking new port
**What goes wrong:** API calls fail silently after port change to 8123.
**Why it happens:** CSP connect-src still references :3001.
**How to avoid:** Update ALL port references: tauri.conf.json CSP, vite.config.ts proxy, server.rs bind address.
**Warning signs:** Network errors in browser devtools, CSP violation in console.

### Pitfall 6: Window close on macOS Cmd+Q bypasses tray
**What goes wrong:** Cmd+Q kills the app instead of hiding to tray.
**Why it happens:** Native Quit menu item (or Cmd+Q) doesn't go through CloseRequested -- it exits directly.
**How to avoid:** This is correct behavior per the user's spec: "App only fully exits via tray Quit or native menu Quit." Cmd+Q via the native menu Quit item should exit. Only the window close button (red X) should hide to tray.
**Warning signs:** None -- this is expected behavior.

## Code Examples

### Tray Icon Template Image
The tray icon needs to be a monochrome PNG, approximately 22x22pt (44x44px for Retina). Black shape on transparent background. Save as `src-tauri/icons/tray-icon.png`.

For the cowboy hat silhouette, create a simple black-on-transparent PNG. This can be created manually or derived from the existing app icon.

### Port Configuration from Settings
```rust
// In server.rs -- read port from settings, default to 8123
pub async fn start(db: Connection) {
    let port: u16 = db.call(|conn| {
        conn.query_row(
            "SELECT port FROM settings WHERE id = 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map(|p| p as u16)
        .or_else(|_| Ok(8123u16))
    })
    .await
    .unwrap_or(8123);

    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await
        .expect(&format!("failed to bind to {}", addr));
    // ...
}
```

### Wiring refresh-db to run_ingestion
```rust
// In settings.rs -- replace 501 stub
async fn refresh_db(State(state): State<AppState>) -> Result<Json<Value>, AppError> {
    let status = new_shared_status();
    tokio::spawn({
        let state = state.clone();
        async move {
            if let Err(e) = run_ingestion(&state, status).await {
                eprintln!("Refresh-db ingestion error: {}", e);
            }
        }
    });
    Ok(Json(json!({"message": "Database refresh started"})))
}
```

### Shared Types Migration
```
# Move shared types to frontend
cp packages/shared/src/types/*.ts packages/frontend/src/types/

# Update all imports in frontend:
# FROM: import type { ... } from '@cowboy/shared';
# TO:   import type { ... } from '../types';
# (relative path varies by file depth)

# For value imports (autoGranularity, isConversationChanged, etc.):
# FROM: import { autoGranularity } from '@cowboy/shared';
# TO:   import { autoGranularity } from '../types';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| notify 5.x with built-in debounce | notify 8.x + separate debouncer crate | 2024 | Cleaner separation; use notify-debouncer-mini or custom |
| Tauri v1 SystemTray plugin | Tauri v2 built-in tray-icon feature | 2024 (Tauri 2.0) | No plugin needed, feature flag on tauri crate |
| Tauri v1 Menu::new() | Tauri v2 MenuBuilder/SubmenuBuilder | 2024 (Tauri 2.0) | Builder pattern, PredefinedMenuItem for standard items |

**Deprecated/outdated:**
- `tauri-plugin-system-tray`: Not needed in Tauri v2, use built-in `tray-icon` feature
- notify 5.x/6.x debounce API: Removed in notify 7+, use separate debouncer crate or custom

## Open Questions

1. **Tray icon asset creation**
   - What we know: Need 22x22pt monochrome cowboy hat silhouette PNG
   - What's unclear: Whether to create manually, derive from existing icon.png, or use a build-time tool
   - Recommendation: Create a simple hand-crafted PNG asset. The existing icon.png is a full-color robot -- a simple hat silhouette at 44x44px is straightforward to create as a static asset.

2. **Settings table port column**
   - What we know: Port 8123 needs to be configurable via settings
   - What's unclear: Whether to add a `port` column to the settings table or use a separate config mechanism
   - Recommendation: Add `port INTEGER DEFAULT 8123` column to settings table. Read at server start. Settings UI gets a new field.

3. **notify crate version pinning**
   - What we know: notify 8.2.0 is current, uses FSEvents on macOS
   - What's unclear: Whether 8.x has breaking changes between minor versions
   - Recommendation: Pin to `notify = "8"` (semver-compatible range). The API is stable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | cargo test (built-in, Rust) + vitest (frontend, existing) |
| Config file | src-tauri/Cargo.toml (Rust), packages/frontend/vitest.config.ts (if exists) |
| Quick run command | `cd src-tauri && cargo test --lib` |
| Full suite command | `cd src-tauri && cargo test && cd .. && pnpm --filter @cowboy/frontend build` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WATCH-01 | notify watches correct paths based on settings | unit | `cd src-tauri && cargo test watcher -x` | No -- Wave 0 |
| WATCH-02 | Debounced events trigger ingestion (not duplicates) | unit | `cd src-tauri && cargo test watcher::debounce -x` | No -- Wave 0 |
| DESK-01 | System tray icon with Show/Quit menu | manual-only | Manual: run app, check tray | N/A (requires GUI) |
| DESK-02 | Close-to-tray hides window, tray stays | manual-only | Manual: close window, verify tray, click Show | N/A (requires GUI) |
| DESK-03 | Native menu bar with About/Quit and Edit items | manual-only | Manual: check menu bar items and shortcuts | N/A (requires GUI) |

### Sampling Rate
- **Per task commit:** `cd src-tauri && cargo test --lib`
- **Per wave merge:** `cd src-tauri && cargo test && pnpm --filter @cowboy/frontend build`
- **Phase gate:** Full suite green + manual verification of tray/menu/close-to-tray

### Wave 0 Gaps
- [ ] `src-tauri/src/watcher.rs` -- new module with unit tests for path filtering and debounce logic
- [ ] Verify `cargo build` succeeds with notify + tray-icon features before implementation
- [ ] Verify `pnpm --filter @cowboy/frontend build` succeeds after shared types migration

## Sources

### Primary (HIGH confidence)
- [Tauri v2 System Tray docs](https://v2.tauri.app/learn/system-tray/) - TrayIconBuilder API, event handling, icon_as_template
- [Tauri v2 Window Menu docs](https://v2.tauri.app/learn/window-menu/) - MenuBuilder, SubmenuBuilder, PredefinedMenuItem
- [notify crate docs.rs](https://docs.rs/notify/latest/notify/) - v8.2.0 API, RecommendedWatcher, Event types
- [notify-debouncer-mini docs.rs](https://docs.rs/notify-debouncer-mini/latest/notify_debouncer_mini/) - v0.7.0, DebouncedEvent
- [Tauri CloseRequestApi docs.rs](https://docs.rs/tauri/latest/tauri/struct.CloseRequestApi.html) - prevent_close API
- Existing codebase: `packages/backend/src/plugins/file-watcher.ts` (Node.js reference implementation)
- Existing codebase: `src-tauri/src/ingestion/mod.rs` (run_ingestion, spawn_auto_ingest)
- Existing codebase: `src-tauri/src/settings.rs` (settings routes, broadcast_event on changes)

### Secondary (MEDIUM confidence)
- [notify GitHub repo](https://github.com/notify-rs/notify) - FSEvents backend details, macOS behavior
- [Tauri tray-icon discussion](https://github.com/tauri-apps/tauri/discussions/11567) - Community patterns for tray setup

### Tertiary (LOW confidence)
- None -- all findings verified with official docs or existing code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - notify 8.x and Tauri 2.x tray/menu are well-documented, verified with official docs
- Architecture: HIGH - Node.js reference implementation maps cleanly to Rust patterns; existing AppState pattern supports watcher handle
- Pitfalls: HIGH - Based on Tauri docs (template icons), notify docs (watcher lifetime), and direct codebase analysis (20+ shared imports)
- Cleanup: HIGH - Direct codebase inspection shows exact files, imports, and scripts to remove

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable libraries, low churn)
