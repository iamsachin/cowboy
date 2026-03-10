# Project Research Summary

**Project:** Cowboy v3.0 — Electron Desktop Wrapper
**Domain:** Electron desktop wrapper for existing Vue 3 + Vite + Fastify analytics dashboard
**Researched:** 2026-03-11
**Confidence:** HIGH

## Executive Summary

Cowboy v3.0 wraps an existing, fully-functional web app (~30,272 LOC) in an Electron shell to deliver a native macOS desktop experience. The core architectural insight from all four research areas is consistent: the backend (Fastify + better-sqlite3 + chokidar) must run as a `child_process.fork()` child with `ELECTRON_RUN_AS_NODE=1`, and the BrowserWindow loads the frontend via `http://localhost` — never `file://`. This approach requires zero changes to the existing frontend code and only a 3-line addition to the backend entry point (add a `process.send({ type: 'ready' })` IPC signal after Fastify starts listening). The new `packages/electron` workspace package contains all Electron-specific code, keeping the monorepo clean and the existing browser-based dev workflow completely intact.

The recommended stack is Electron 40 + electron-vite 5 in a new `packages/electron` workspace package. electron-vite is preferred over vite-plugin-electron because it keeps the existing `vite.config.ts` untouched and provides sensible Electron defaults out of the box. There is no need for electron-builder, electron-forge, electron-store, auto-updater, or any additional Electron utilities — this is a personal tool run from source, and the existing SQLite + Drizzle stack handles all persistence. The preload script is intentionally minimal (platform detection only) because all data continues to flow through the existing HTTP/WebSocket infrastructure.

The single most dangerous pitfall — `better-sqlite3` native module ABI mismatch with Electron's bundled Node.js — is entirely sidestepped by running the backend as a forked child process with `ELECTRON_RUN_AS_NODE=1`. This causes the backend to use the system's Node.js rather than Electron's, eliminating the need for `electron-rebuild` entirely. The second most dangerous pitfall is child process orphaning: Fastify processes left running on port 3000 after Electron exits will cause `EADDRINUSE` on the next launch. Both must be addressed in Phase 1 before anything else. The development workflow must also be established in Phase 1 — a single `pnpm dev:electron` command with correct startup ordering — or friction will compound across every subsequent phase.

## Key Findings

### Recommended Stack

The existing stack (Vue 3 + Vite 6 + Fastify 5 + better-sqlite3 + Drizzle + pnpm workspaces) is kept entirely unchanged. Only two new devDependencies are added to a new `packages/electron` workspace package.

See `.planning/research/STACK.md` for full detail including the "What NOT to Add" table.

**Core technologies:**
- **Electron 40**: Desktop shell (BrowserWindow, Tray, Menu, dock, native window chrome) — current stable (40.8.0), ships Chromium 144 + Node 24.11.1
- **electron-vite 5**: Build tooling for main/preload/renderer processes — keeps existing `vite.config.ts` untouched, provides Electron-aware defaults, supports Vite 6 already in use
- **child_process.fork() with ELECTRON_RUN_AS_NODE=1**: Backend process management — avoids `electron-rebuild` entirely by running the backend under system Node rather than Electron's bundled Node

**Explicitly excluded:** electron-builder, electron-forge, electron-store, electron-updater, electron-log, @electron/remote, @electron/rebuild, electron-devtools-installer. Each is justified in STACK.md.

### Expected Features

See `.planning/research/FEATURES.md` for full detail including the prioritization matrix and competitor analysis.

**Must have — P1 (table stakes for v3.0):**
- BrowserWindow with `titleBarStyle: 'hiddenInset'` — native macOS traffic lights integrated into window chrome
- Fastify backend as managed child process (fork, IPC ready signal, graceful shutdown)
- Dev/prod URL loading (Vite dev server at :5173 in dev, Fastify at :3000 in prod)
- System tray icon with context menu (Show Cowboy / Quit)
- Close-to-tray behavior (red X hides window, tray click and dock click restore it)
- Minimal application menu (app menu with About/Quit + edit menu for clipboard shortcuts)
- Single instance lock (prevents port :3000/:5173 conflicts from duplicate launches)

**Should have — P2 (add in v3.x after validation):**
- Startup loading screen while backend initializes (prevents blank white window)
- Window state persistence (save/restore size and position)
- Backend health monitoring with auto-restart on crash

**Defer — v4+ or never for personal use:**
- Dock badge with active conversation count
- Tray tooltip with live token stats
- Native notifications for completed conversations
- Distributable .dmg (explicitly out of scope per PROJECT.md)

### Architecture Approach

The integration follows a clean separation: a new `packages/electron` workspace contains all Electron-specific code in six focused source files. The Electron main process acts purely as a lifecycle supervisor — it forks the backend, waits for the IPC ready signal, loads the URL in a BrowserWindow, and manages the tray. All application data continues to flow through the existing HTTP/WebSocket layer; the Node IPC channel between main and backend carries only two message types (`ready` and `shutdown`). The frontend is completely Electron-unaware.

See `.planning/research/ARCHITECTURE.md` for full component details, code patterns, and the build order graph.

**Major components (all new in `packages/electron`):**
1. `main.ts` — App lifecycle: ready, activate, before-quit, window-all-closed
2. `backend-manager.ts` — Fork Fastify, await IPC ready signal, handle crash/restart, kill on quit
3. `window-manager.ts` — BrowserWindow creation, close-to-tray vs actual-quit state machine
4. `tray.ts` — macOS menu bar tray icon, context menu, click-to-show
5. `menu.ts` — Native app menu (About, Quit) + edit menu (clipboard shortcuts)
6. `preload.ts` — Minimal: expose `platform` string only via contextBridge

**Required backend change:** 3 lines — add `process.send({ type: 'ready', port: 3000 })` after Fastify calls `app.listen()`. No-op when backend runs standalone (IPC channel only exists when forked).

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for all 11 pitfalls with warning signs, recovery strategies, and codebase-specific file references.

1. **better-sqlite3 ABI mismatch** — Mitigated entirely by running the backend with `ELECTRON_RUN_AS_NODE=1` so it uses system Node, not Electron's bundled Node. This eliminates `electron-rebuild`. Must be verified in Phase 1 before proceeding.

2. **Child process not killed on quit** — Store `backendProcess` at module scope, send SIGTERM in `app.on('before-quit')`, add SIGTERM handler in backend entry point (`fastify.close()` then `process.exit(0)`), add SIGKILL fallback after 5s. Orphan processes cause `EADDRINUSE: address already in use :::3000` on next launch.

3. **Relative database path causes data loss** — The current `./data/cowboy.db` default in `packages/backend/src/db/index.ts` resolves to `/data/cowboy.db` in a packaged app (`process.cwd()` returns `/` on macOS). Electron main must set `DATABASE_URL` env var to `path.join(app.getPath('userData'), 'cowboy.db')` when forking.

4. **Vue Router `createWebHistory()` breaks in Electron** — The existing `packages/frontend/src/router/index.ts` uses `createWebHistory()`. Switch to `createWebHashHistory()`. One-line change, backward-compatible, prevents blank page on deep-route refresh.

5. **Close-to-tray vs quit state machine** — Implement the `isQuitting` flag pattern: `app.on('before-quit')` sets flag; window `close` handler hides unless flag is set; `app.on('activate')` and tray click call `win.show()` + `app.dock.show()`. Must test all four paths: red X button, Cmd+W, Cmd+Q, dock right-click Quit.

## Implications for Roadmap

The dependency graph from architecture research drives the phase structure: backend process management is the foundation, window chrome and tray come next (they share the `isQuitting` state machine so must be built together), and polish features come last.

### Phase 1: Electron Scaffold + Backend Integration

**Rationale:** The backend child process lifecycle is the critical dependency for every other phase. The dev workflow, database path resolution, native module strategy, SIGTERM handling, and Vue Router fix must all be established in Phase 1 or every subsequent phase risks data loss and operational failures. Architecture research explicitly identifies the build order: scaffold → backend-manager → window-manager → main.ts lifecycle. Five of the eleven pitfalls are Phase 1 concerns.

**Delivers:** A working Electron app that launches the Fastify backend, waits for the IPC ready signal, loads the Vue frontend in a BrowserWindow (via Vite dev server in dev, Fastify in prod), and cleans up all child processes on quit. No tray, no native chrome yet — but the core integration is solid.

**Addresses (from FEATURES.md):**
- Fastify backend as managed child process (fork, health-check, graceful shutdown)
- Dev/prod URL loading
- Single instance lock (must be first thing in app entry point, before any windows)

**Avoids (from PITFALLS.md):**
- better-sqlite3 ABI mismatch (via ELECTRON_RUN_AS_NODE=1, no electron-rebuild needed)
- Child process orphan on quit (SIGTERM handler + module-scope process reference)
- Relative database path → data loss (set DATABASE_URL to app.getPath('userData'))
- Vue Router history mode breaks deep routes (switch to createWebHashHistory)
- Dev workflow race condition (wait-on backend health check before launching Electron)
- File watcher leak on unclean shutdown (explicit SIGTERM handler in backend entry point)

**Research flag:** Standard patterns — well-documented child_process.fork() + Electron lifecycle. No additional research needed.

### Phase 2: Native Window Chrome + Tray + Menu

**Rationale:** Once the integration core is working, add the macOS-native UX layer. Tray and menu are independent of each other but both depend on Phase 1's working BrowserWindow. Critically, the `isQuitting` state machine is shared state between window-manager.ts and tray.ts — implementing one without the other leaves the quit experience broken. Building them together in Phase 2 ensures all four close/quit paths are correct before moving on.

**Delivers:** Full native macOS desktop feel: traffic light window controls with `titleBarStyle: 'hiddenInset'`, system tray with Show/Quit context menu, close-to-tray behavior (X hides window, tray click restores), native app menu (so the menu bar shows "Cowboy" not "Electron", and Cmd+C/V/X/A work).

**Addresses (from FEATURES.md):**
- BrowserWindow with native macOS `titleBarStyle: 'hiddenInset'`
- System tray with context menu
- Close-to-tray behavior (all four quit paths)
- Minimal application menu (app menu + edit menu)

**Avoids (from PITFALLS.md):**
- Tray icon garbage collected (store tray reference at module scope)
- Close-to-tray semantics wrong (isQuitting flag pattern — test all 4 paths)
- CSP blocks inline styles / WebSocket connections (add meta CSP with `'unsafe-inline'` for styles, `ws://localhost:*`)
- No app menu → "Electron" in menu bar + Cmd+C/V/X/A broken

**Uses (from STACK.md):** Electron Tray API with Template image (16px + @2x 32px), Menu.buildFromTemplate with role-based items, BrowserWindow `titleBarStyle: 'hiddenInset'` with `trafficLightPosition`.

**Research flag:** Standard patterns — Electron Tray, Menu, and BrowserWindow APIs are stable and well-documented. No additional research needed.

### Phase 3: Polish + Startup Experience

**Rationale:** The app is fully functional after Phase 2. Phase 3 adds quality-of-life features that prevent the "rough edges" experience: the blank white window during backend startup, window position amnesia on relaunch, and the missing visual cue that close-to-tray is keeping the app alive. These are P2 features from FEATURES.md — important for daily usability but not blockers for the core experience.

**Delivers:** Startup loading screen while backend initializes (prevents blank window during 1-2s Fastify startup), window state persistence (remembers position and size), backend health monitoring with auto-restart on crash, first-close notification ("Cowboy is still running in the menu bar").

**Addresses (from FEATURES.md):**
- Startup loading screen (P2)
- Window state persistence (P2)
- Backend health monitoring with auto-restart (P2)

**Avoids (from PITFALLS.md):**
- Blank window while backend starts (show loading indicator, only call win.show() after health check passes)
- Window position not remembered across restarts
- Backend crash silently breaks app with no recovery path

**Research flag:** `electron-window-state` package API should be verified against Electron 40 before use. Alternatively, window bounds can be persisted manually to `app.getPath('userData')` with no extra dependency. Backend health monitoring patterns are standard.

### Phase Ordering Rationale

- Backend process management precedes window chrome because BrowserWindow has nothing to load until Fastify is ready and the dev workflow is established
- Single instance lock is the very first check in the app entry point (before any windows) — it belongs in Phase 1 because a second instance will cause immediate port conflicts
- Tray and menu are bundled in Phase 2 because `isQuitting` is shared state between window-manager.ts and tray.ts — implementing one without the other leaves quit semantics broken
- Polish features deferred to Phase 3 because they don't block the core value proposition but create noticeable daily friction if missing
- Packaging (.dmg, code signing, auto-update) is explicitly out of scope per PROJECT.md — no phase needed

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Window state persistence):** Verify `electron-window-state` package compatibility with Electron 40 before adopting it. Low-risk fallback: implement manually with `app.getPath('userData')` JSON file — roughly 20 lines and zero dependencies.

Phases with standard patterns (skip research-phase):
- **Phase 1:** child_process.fork() with ELECTRON_RUN_AS_NODE=1 is the canonical pattern for Electron + native modules; the exact backend-manager.ts implementation is fully specified in ARCHITECTURE.md
- **Phase 2:** Electron Tray, Menu, and BrowserWindow APIs are stable; the isQuitting pattern is the standard macOS close-to-tray implementation; both are well-documented with direct codebase application

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Electron 40 and electron-vite 5 verified against official release notes and npm. Decision to use child_process.fork() over utilityProcess is verified against better-sqlite3 native module constraints. All "what not to add" decisions have clear rationale. |
| Features | HIGH | Electron APIs for all P1 features are stable. Feature list derived from direct codebase analysis of the existing 30K LOC app, not speculation. P2/P3 features are clearly separated. |
| Architecture | HIGH | Architecture is informed by codebase analysis of all existing packages. The localhost HTTP data flow is a direct consequence of how frontend/backend already communicate — not an assumption. Component boundaries and code patterns are fully specified in ARCHITECTURE.md. |
| Pitfalls | HIGH | All 11 pitfalls are verified against actual Electron GitHub issues and confirmed against specific files in the existing codebase (e.g., `createWebHistory()` in `packages/frontend/src/router/index.ts`, relative DB path in `packages/backend/src/db/index.ts`, missing SIGTERM handler in `packages/backend/src/index.ts`). |

**Overall confidence:** HIGH

### Gaps to Address

- **Icon assets:** A proper macOS dock icon (.icns, 512x512) and tray template image (trayTemplate.png + trayTemplate@2x.png at 16/32px) do not yet exist. These are design assets, not code. Phase 2 cannot be completed without them — flag for early action.

- **Backend health endpoint:** The dev workflow and health monitoring features reference `http://localhost:3000/api/health`. Verify whether this endpoint exists in the current Fastify backend or needs to be added. If missing, it is a ~5-line Fastify route addition that belongs in Phase 1 alongside the IPC ready signal.

- **SIGTERM handler in backend entry point:** Confirmed missing in `packages/backend/src/index.ts`. Must be added in Phase 1: `process.on('SIGTERM', async () => { await app.close(); process.exit(0); })`. Without it, chokidar file watchers leak on shutdown.

## Sources

### Primary (HIGH confidence)
- [Electron 40.0.0 Release](https://www.electronjs.org/blog/electron-40-0) — Chromium 144, Node 24.11.1, current stable
- [Electron Releases](https://releases.electronjs.org/) — v40.8.0 current stable confirmed
- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window) — titleBarStyle, trafficLightPosition, webPreferences
- [Electron Tray API](https://www.electronjs.org/docs/latest/api/tray) — tray creation, Template images, context menu
- [Electron Custom Title Bar](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar) — hiddenInset, traffic light positioning
- [Electron Application Menu](https://www.electronjs.org/docs/latest/tutorial/application-menu) — role-based menu templates
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) — main/renderer/utility process architecture
- [Electron app.getPath() API](https://www.electronjs.org/docs/latest/api/app) — userData path for database location
- [Electron Timelines](https://www.electronjs.org/docs/latest/tutorial/electron-timelines) — release schedule, EOL June 2026
- [electron-vite Getting Started](https://electron-vite.org/guide/) — v5.0.0 config structure, renderer root pointing to existing frontend
- Codebase analysis: `packages/backend/src/index.ts`, `packages/backend/src/db/index.ts`, `packages/frontend/src/router/index.ts`, `packages/frontend/src/composables/useWebSocket.ts`, `packages/frontend/vite.config.ts`, `package.json` (root), `pnpm-workspace.yaml`

### Secondary (MEDIUM confidence)
- [Electron child process patterns](https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html) — ELECTRON_RUN_AS_NODE fork pattern
- [Blocking Electron's main process](https://medium.com/actualbudget/the-horror-of-blocking-electrons-main-process-351bf11a763c) — why backend must not run in-process
- [Fastify in child process discussion](https://github.com/fastify/fastify/discussions/3353) — fork pattern for Fastify in Electron confirmed
- [Electron tray icon disappearance issue #822](https://github.com/electron/electron/issues/822) — module-scope reference required
- [Electron tray destruction crash issue #12862](https://github.com/electron/electron/issues/12862) — don't destroy tray inside its own callback
- [Electron process.cwd() returns '/' issue #2108](https://github.com/electron/electron/issues/2108) — database relative path breaks in packaged apps
- [Electron child process termination issue #7084](https://github.com/electron/electron/issues/7084) — SIGTERM propagation not guaranteed
- [vite-plugin-electron GitHub](https://github.com/electron-vite/vite-plugin-electron) — v0.29.0 pre-1.0 status, last published ~1 year ago

### Tertiary (LOW confidence)
- [npm trends: electron-builder vs electron-forge](https://npmtrends.com/electron-vs-electron-builder-vs-electron-forge) — download stats supporting electron-builder if packaging ever needed (out of scope)
- [Electron child_process patterns gist](https://gist.github.com/maximilian-lindsey/a446a7ee87838a62099d) — Express in forked child process pattern

---
*Research completed: 2026-03-11*
*Ready for roadmap: yes*
