# Feature Research

**Domain:** Electron desktop wrapper for existing Vue 3 + Vite + Fastify analytics dashboard
**Researched:** 2026-03-11
**Confidence:** HIGH (Electron APIs for these features are stable and well-documented; the app's architecture cleanly separates frontend/backend already)

## Context

This research covers v3.0 Electron Desktop App features only. The existing web app (~30,272 LOC) is fully functional and must load unchanged inside the Electron shell. The scope is strictly the Electron wrapper layer: window chrome, tray/dock presence, menu bar, child process management, and BrowserWindow loading.

**Already built (not in scope):**
- Full Vue 3 + DaisyUI frontend on Vite (port 5173 dev, built to dist/)
- Fastify backend on port 3000 with SQLite + Drizzle + chokidar file watcher
- WebSocket live updates, keyboard shortcuts, command palette, all UI components
- Frontend proxies /api to backend in dev via Vite config

**Key architectural fact:** The frontend and backend are separate processes communicating over HTTP/WebSocket on localhost. This maps naturally to Electron: main process spawns the backend as a child, loads the frontend in a BrowserWindow.

## Table Stakes

Features users expect from a desktop-wrapped app. Missing any of these makes it feel like a broken web page in a frame.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **BrowserWindow loading Vite dev server or built files** | The entire app must appear inside the Electron window. In dev, load `http://localhost:5173`; in production, load `file://path/to/dist/index.html`. This is the fundamental feature. | LOW | Use `MAIN_WINDOW_VITE_DEV_SERVER_URL` env var or equivalent check. `win.loadURL(devUrl)` vs `win.loadFile(path.join(__dirname, '../renderer/index.html'))`. The frontend already works standalone; no code changes needed in Vue app. |
| **Fastify backend as managed child process** | The analytics backend must start automatically when the app launches and stop cleanly on quit. Users should not need to run a separate terminal command. | MEDIUM | Use `child_process.fork()` with `ELECTRON_RUN_AS_NODE=1` to run the backend entry point. Must handle: startup wait (backend ready before loading frontend), graceful shutdown (SIGTERM on app quit), crash restart, and port conflict detection. The `better-sqlite3` native module needs `electron-rebuild` to compile against Electron's Node version. |
| **Native macOS window chrome (traffic lights)** | macOS users expect the red/yellow/green window controls and native-feeling title bar. A completely frameless window feels wrong for a dashboard app. | LOW | `titleBarStyle: 'hiddenInset'` gives native traffic lights inset from the edge while hiding the title bar text. Add `titleBarOverlay: true` or CSS `padding-top` (~28px) for drag region. The existing DaisyUI navbar becomes the visual title area. No changes to Vue components needed. |
| **Dock icon presence** | macOS apps live in the Dock. The app must show a proper icon when running, not a generic Electron logo. | LOW | Provide a 512x512 .icns icon file. Set via `icon` in BrowserWindow options and in the build config. Dock is automatic on macOS when the app has a window open. |
| **System tray icon with context menu** | A tray icon in the macOS menu bar provides quick access when the window is hidden. Must show a context menu with at minimum: Show Window, Quit. | LOW | Create `Tray` instance after `app.ready`. Use a 20x20 (+ @2x 40x40) template image for macOS menu bar. Attach `Menu.buildFromTemplate([{ label: 'Show Cowboy', click: showWindow }, { type: 'separator' }, { label: 'Quit', click: app.quit }])`. Store tray reference globally to prevent GC. |
| **Minimal application menu bar (About + Quit)** | macOS requires an application menu. Without one, Cmd+Q does not work and the app name shows as "Electron" in the menu bar. | LOW | Use `Menu.buildFromTemplate([{ role: 'appMenu', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] }, { role: 'editMenu' }])`. The `editMenu` role is important -- without it, Cmd+C/V/X/A do not work in the BrowserWindow. Two menu items total: app name menu and Edit menu. |
| **Close-to-tray behavior** | Clicking the red X should hide the window, not quit the app. The backend file watcher must keep running to collect data. Re-clicking the dock icon or tray icon brings the window back. | MEDIUM | Intercept `BrowserWindow.on('close')`, call `event.preventDefault()` and `win.hide()`. On tray click or `app.on('activate')` (dock click), call `win.show()`. Set a `isQuitting` flag on `app.on('before-quit')` to allow actual quit from Cmd+Q or tray Quit. `app.dock.hide()` when window is hidden is optional -- keeping dock icon visible is more standard for dashboard apps. |

## Differentiators

Features that elevate the experience beyond a minimal wrapper. Not required for v3.0 to feel complete, but create polish.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Backend health monitoring** | Show a status indicator (tray icon color or tooltip) reflecting whether the Fastify backend is healthy. Detect crashes and auto-restart. | MEDIUM | Periodic HTTP health check to `http://localhost:3000/api/health` (add a simple health endpoint if not present). On failure, respawn child process. Update tray icon tooltip to "Cowboy -- Backend: running" or "restarting...". |
| **Startup splash / loading state** | Show a brief loading screen while the backend starts up (SQLite migrations, file watcher initialization). Prevents a white flash or connection error in the BrowserWindow. | LOW | Load a minimal HTML file first (`loading.html` with a spinner), then swap to the real app URL once the backend health check passes. Or use `win.once('ready-to-show', () => win.show())` to delay showing until content is rendered. |
| **Window state persistence** | Remember window size and position across app restarts. | LOW | Use `electron-window-state` package or manually save bounds to a JSON file in `app.getPath('userData')` on `resize`/`move` events. Restore on next launch. |
| **Single instance lock** | Prevent launching multiple copies of the app, which would cause port conflicts on 3000/5173. | LOW | `app.requestSingleInstanceLock()`. On `second-instance` event, focus the existing window. Critical because the Fastify backend binds to a fixed port. |
| **Tray tooltip with live stats** | Show "Cowboy -- 3 active conversations, 12.4k tokens/min" as the tray icon tooltip. Leverages the existing token rate endpoint from v2.1. | LOW | Periodic fetch to the token rate API from the main process. Update `tray.setToolTip()`. |
| **Dock badge with active count** | Show the number of currently active conversations as a dock badge number. | LOW | `app.dock.setBadge(String(count))`. Fetch from existing `/api/analytics/overview` endpoint. Clear badge when no conversations are active. |
| **Native notifications for long-running conversations** | "Conversation X finished after 45 minutes, 234k tokens" as a macOS notification. | MEDIUM | Use Electron `Notification` API. Requires tracking conversation start/end from the WebSocket events. Only useful for conversations that exceed a duration threshold. |

## Anti-Features

Features to explicitly NOT build for v3.0.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Distributable installer / .dmg** | Natural expectation for Electron apps. | PROJECT.md explicitly marks this out of scope. Personal use only, run from source. Adds electron-builder/electron-forge complexity, code signing, notarization. | `npm run electron:dev` for development, `npm run electron:start` for production-like local run. |
| **Auto-update mechanism** | Standard for distributed Electron apps. | No distribution = no need for updates. The app runs from the git repo. `git pull` is the update mechanism. | Document "git pull && npm install && rebuild" in README. |
| **Global keyboard shortcuts** | Register Cmd+Shift+C globally to show Cowboy from any app. | Global shortcuts conflict with other apps, require accessibility permissions on macOS, and are hard to debug. Out of scope per PROJECT.md. | Tray icon click and dock icon click are sufficient to surface the app. |
| **Deep links (cowboy:// protocol)** | Open specific conversations from external links. | Protocol handlers require registration, add complexity, and are out of scope per PROJECT.md. Personal use does not need cross-app linking. | The app has its own URL routing; navigate within the BrowserWindow. |
| **Multiple windows** | Open different conversations in separate windows. | Adds window management complexity (multiple BrowserWindow instances, shared state, IPC). The existing app is a single-page app with its own routing. | Use the existing in-app navigation. Browser tabs equivalent is not needed for a personal tool. |
| **Custom native title bar** | Replace the entire title bar with a custom-drawn one for branding. | `titleBarStyle: 'hiddenInset'` already provides native traffic lights. A custom title bar means implementing drag regions, double-click-to-maximize, and platform-specific behavior manually. | Use `hiddenInset` and let the existing DaisyUI navbar serve as the visual header. |
| **electron-vite or vite-plugin-electron** | Integrate Vite into the Electron build pipeline for HMR in the main process. | The existing app already has separate dev scripts for frontend (Vite) and backend (tsx watch). Adding electron-vite would restructure the monorepo and change the working dev workflow. Overkill when the frontend is loaded via URL in dev. | Keep the existing Vite dev server for frontend. The Electron main process is a thin wrapper (~100-150 lines) that does not need HMR -- restart is fast. |
| **IPC bridge for renderer-to-main communication** | Expose Electron APIs (file dialogs, native menus) to the Vue app via preload script. | The Vue app works entirely over HTTP/WebSocket to the Fastify backend. There is no feature that requires native Electron APIs from the renderer. Adding IPC creates a coupling between the frontend and Electron that makes the web-only mode impossible. | Keep the frontend Electron-agnostic. All data flows through Fastify HTTP/WS. |

## Feature Dependencies

```
Electron main process setup
    --> BrowserWindow creation (titleBarStyle, icon, dimensions)
        --> Loading state (show loading.html while backend starts)
            --> Load Vite dev server URL or built index.html
    --> Tray icon with context menu
        --> Close-to-tray behavior (intercept close, hide window, tray restores)
    --> Application menu (About, Quit, Edit for clipboard)
    --> Child process: fork Fastify backend
        --> Wait for backend ready (health check loop)
            --> BrowserWindow loads app URL
        --> Graceful shutdown on app quit
        --> Crash detection and restart (enhancement)

Single instance lock
    --> Must be first thing in app startup (before any windows)

Window state persistence (enhancement)
    --> Reads saved bounds on BrowserWindow creation
    --> Saves bounds on resize/move events

electron-rebuild for better-sqlite3
    --> Must run after npm install, before app can start
    --> Required because Electron bundles its own Node.js version
```

### Dependency Notes

- **Backend must start before frontend loads:** The BrowserWindow cannot load the app until Fastify is listening on port 3000. A loading screen or delayed `win.show()` bridges this gap.
- **Tray must exist before close-to-tray works:** The close handler hides the window; the tray provides the way to get it back.
- **Single instance lock prevents port conflicts:** Must be the very first check in the Electron entry point.
- **electron-rebuild is a one-time setup concern:** Needed because `better-sqlite3` is a native Node addon compiled against system Node, but Electron uses a different Node version. The `electron-rebuild` package recompiles it. This is a build/install step, not a runtime feature.
- **Edit menu is silently required:** Without `{ role: 'editMenu' }`, Cmd+C/V/X/A stop working in the BrowserWindow because macOS requires menu items to bind those shortcuts.

## MVP Definition

### Launch With (v3.0)

Minimum viable Electron wrapper -- the app works as a desktop app with native feel.

- [ ] **Electron main process entry point** -- app lifecycle, single instance lock
- [ ] **BrowserWindow with hiddenInset chrome** -- native traffic lights, proper sizing
- [ ] **Fastify backend as child process** -- fork, wait for ready, graceful shutdown
- [ ] **Dev/prod URL loading** -- loadURL for dev server, loadFile for built assets
- [ ] **System tray with context menu** -- Show/Quit, template icon
- [ ] **Close-to-tray behavior** -- hide on X, restore on tray/dock click
- [ ] **Minimal application menu** -- app menu (About, Quit) + edit menu (clipboard shortcuts)
- [ ] **electron-rebuild for better-sqlite3** -- native module compatibility

### Add After Validation (v3.x)

- [ ] **Window state persistence** -- save/restore position and size
- [ ] **Backend health monitoring** -- detect crashes, auto-restart, tray status
- [ ] **Startup loading screen** -- show spinner while backend initializes
- [ ] **Single instance enforcement** -- prevent duplicate launches

### Future Consideration (v4+)

- [ ] **Dock badge with active conversation count**
- [ ] **Tray tooltip with live stats**
- [ ] **Native notifications for completed conversations**
- [ ] **Distributable .dmg** (if ever shared beyond personal use)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| BrowserWindow with native chrome | HIGH | LOW | P1 |
| Fastify child process lifecycle | HIGH | MEDIUM | P1 |
| Dev/prod URL loading | HIGH | LOW | P1 |
| System tray + context menu | HIGH | LOW | P1 |
| Close-to-tray behavior | HIGH | LOW | P1 |
| Application menu (About/Quit/Edit) | HIGH | LOW | P1 |
| electron-rebuild for native modules | HIGH | LOW | P1 |
| Single instance lock | MEDIUM | LOW | P1 |
| Startup loading screen | MEDIUM | LOW | P2 |
| Window state persistence | MEDIUM | LOW | P2 |
| Backend health monitoring | MEDIUM | MEDIUM | P2 |
| Dock badge with active count | LOW | LOW | P3 |
| Tray tooltip with stats | LOW | LOW | P3 |
| Native notifications | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- the app does not feel like a desktop app without these
- P2: Should have, add in the same milestone if time permits
- P3: Nice to have, defer to future milestone

## Competitor Feature Analysis

| Feature | claude-devtools (Electron) | Typical Electron dashboard apps | Our Approach |
|---------|---------------------------|--------------------------------|--------------|
| Window chrome | Standard Electron frame | Mix of frameless and native | `hiddenInset` for native traffic lights without title text |
| Backend process | Runs in main process | Varies (in-process or forked) | Fork as child process -- isolates backend crashes from UI |
| Tray | Not present in most dev tools | Common in background/monitoring apps | Yes -- critical for close-to-tray since file watcher must persist |
| Close-to-tray | N/A | Standard for monitoring/dashboard apps | Yes -- the file watcher and ingestion must keep running |
| Menu bar | Default Electron menu | Minimal to full menus | Minimal: About + Quit + Edit clipboard shortcuts |

## Sources

- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window) -- titleBarStyle, loadURL, loadFile options
- [Electron Tray API](https://www.electronjs.org/docs/latest/tutorial/tray) -- system tray creation, context menu, icon requirements
- [Electron Custom Title Bar](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar) -- hiddenInset, traffic light positioning
- [Electron Application Menu](https://www.electronjs.org/docs/latest/tutorial/application-menu) -- role-based menu templates
- [Electron Dock API](https://www.electronjs.org/docs/latest/api/dock) -- dock.hide(), setBadge()
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) -- main vs renderer vs utility processes
- [Electron utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process) -- alternative to child_process.fork
- [electron-vite Getting Started](https://electron-vite.org/guide/) -- integration approaches (evaluated, rejected for this project)
- [Background Electron apps](https://moinism.medium.com/how-to-keep-an-electron-app-running-in-the-background-f6a7c0e1ee4f) -- close-to-tray patterns
- [Electron child process with native modules](https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html) -- ELECTRON_RUN_AS_NODE, fork behavior
- [better-sqlite3 with Electron](https://dev.to/arindam1997007/a-step-by-step-guide-to-integrating-better-sqlite3-with-electron-js-app-using-create-react-app-3k16) -- electron-rebuild requirement

---
*Feature research for: Cowboy v3.0 Electron Desktop App*
*Researched: 2026-03-11*
