# Pitfalls Research

**Domain:** Adding Electron desktop wrapper to existing Node.js + Vue 3 + Vite analytics app
**Researched:** 2026-03-11
**Confidence:** HIGH (well-documented problem space, verified against codebase specifics)

## Critical Pitfalls

### Pitfall 1: better-sqlite3 Native Module ABI Mismatch

**What goes wrong:**
The app crashes on startup with `NODE_MODULE_VERSION mismatch` or `was compiled against a different Node.js version`. better-sqlite3 is a C++ native addon compiled against system Node.js headers, but Electron ships its own Node.js with a different ABI version. The `.node` binary compiled for your system Node simply will not load in Electron.

**Why it happens:**
`pnpm install` compiles better-sqlite3 against your system Node.js (e.g., Node 22). Electron 33+ uses a different Node ABI. The compiled `.node` binary is architecture- and ABI-specific. This is the single most common failure when adding Electron to a project that uses native modules.

**How to avoid:**
1. Install `@electron/rebuild` as a dev dependency.
2. Add a postinstall script: `"postinstall": "electron-rebuild"` or use `npx @electron/rebuild -f -w better-sqlite3`.
3. In electron-builder config, set `npmRebuild: true` (default) so packaging also rebuilds.
4. Set `asarUnpack: ["**/better-sqlite3/**", "**/node_modules/better-sqlite3/**"]` in electron-builder config. Native `.node` binaries cannot be loaded from inside an ASAR archive because the OS needs direct filesystem access to `dlopen()` them.
5. Verify with: `node -e "require('better-sqlite3')"` from within the Electron context, not your system shell.

**Warning signs:**
- `Error: Module did not self-register` at startup
- `NODE_MODULE_VERSION` mismatch errors in console
- App works in `pnpm dev` but crashes in Electron
- Works on your machine but fails in packaged `.app`

**Phase to address:**
Phase 1 (Electron scaffolding) -- this must be solved before anything else runs. The backend literally cannot start without a working better-sqlite3.

---

### Pitfall 2: Relative Database Path Resolves to Wrong Location

**What goes wrong:**
The current `DB_PATH` in `packages/backend/src/db/index.ts` defaults to `'./data/cowboy.db'` -- a relative path. In development this resolves relative to `process.cwd()` (the repo root). In a packaged Electron app, `process.cwd()` returns `/` on macOS, so the app tries to create `/data/cowboy.db`, fails silently or with EACCES, and either crashes or creates the database in an unexpected location.

**Why it happens:**
`process.cwd()` is unreliable in packaged Electron apps. On macOS it returns `/` when launched from Finder/Dock. On Linux it depends on the `.desktop` file. The relative `'./data/cowboy.db'` path that works perfectly in development becomes meaningless in production.

**How to avoid:**
The Electron main process must resolve a stable absolute path using `app.getPath('userData')` (e.g., `~/Library/Application Support/cowboy/`) and pass it to the backend child process via environment variable:
```typescript
// In Electron main process:
const dbPath = path.join(app.getPath('userData'), 'cowboy.db');
// Pass to child process:
fork('./backend', [], { env: { ...process.env, DATABASE_URL: dbPath } });
```
The backend already respects `process.env.DATABASE_URL` -- the only change needed is ensuring Electron always sets it. Do NOT use `app.getAppPath()` (points inside the ASAR archive, read-only).

**Warning signs:**
- Database appears empty after restarting the packaged app
- EACCES errors in logs when trying to create `./data/` directory
- Data persists in dev but disappears in packaged builds
- Multiple `cowboy.db` files in unexpected locations

**Phase to address:**
Phase 1 (Electron scaffolding) -- backend spawning must set this env var from the start. This is a data-loss bug if missed.

---

### Pitfall 3: Child Process (Fastify Backend) Not Killed on Quit

**What goes wrong:**
Electron spawns the Fastify backend as a child process. When the user quits Electron (Cmd+Q, dock right-click Quit, or force quit), the child process is not automatically terminated. It becomes an orphan process, holding the SQLite database lock (WAL mode) and listening on port 3000. Next launch fails with `EADDRINUSE` or database lock contention.

**Why it happens:**
`child_process.fork()` and `child_process.spawn()` create independent OS processes. Electron's `app.quit()` only exits the Electron process tree. On macOS, SIGHUP propagation to child processes is not guaranteed, especially for detached processes or when the parent exits abruptly (e.g., force quit from Activity Monitor).

**How to avoid:**
1. Store the child process reference in a module-level variable.
2. Send graceful shutdown signal in `app.on('before-quit')`:
   ```typescript
   app.on('before-quit', () => {
     if (backendProcess && !backendProcess.killed) {
       backendProcess.kill('SIGTERM');
     }
   });
   ```
3. In the backend, handle SIGTERM to call `fastify.close()` (which triggers the `onClose` hook that already calls `closeWatchers()`).
4. Add a timeout fallback: if SIGTERM does not cause exit within 3 seconds, send SIGKILL.
5. Consider using Electron's `utilityProcess` API (Electron 22+) instead of `child_process.fork()` -- utility processes are tied to the Electron lifecycle and are killed automatically when the app exits.
6. On startup, add a port-check that detects and kills stale backend processes from previous crashed sessions.

**Warning signs:**
- `EADDRINUSE: address already in use :::3000` on second launch
- `Activity Monitor` shows orphaned `node` processes after quitting
- SQLite "database is locked" errors
- Backend keeps running after Electron window is closed

**Phase to address:**
Phase 1 (backend child process management) -- must be correct from the first implementation. This is the most operationally dangerous pitfall.

---

### Pitfall 4: Vue Router createWebHistory Breaks in Electron

**What goes wrong:**
The app currently uses `createWebHistory()` in `packages/frontend/src/router/index.ts`. This relies on the browser History API with real URL paths (`/conversations/123`). In Electron, the renderer loads content either from a local file (`file://`) or from `http://localhost:3000`. With `file://`, the History API has no server to handle routes, so refreshing or deep-linking to `/conversations/123` shows a blank page. Even with localhost loading, if the Fastify static plugin's catch-all is not perfectly configured, navigation breaks.

**Why it happens:**
`createWebHistory()` requires the server to return `index.html` for all unmatched routes (SPA fallback). In development with Vite's dev server this works automatically. In Electron production mode, if loading from `file://` protocol there is no server-side routing at all.

**How to avoid:**
Switch to `createWebHashHistory()` in the router:
```typescript
import { createRouter, createWebHashHistory } from 'vue-router';
export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
```
Hash-based routing (`/#/conversations/123`) works regardless of how content is loaded because the hash is never sent to the server. This change is backward-compatible -- existing links just get a `#` prefix. The Vite dev server and standalone browser mode both work fine with hash history.

Alternatively, if the app always loads from Fastify (`http://localhost:3000`) and the static plugin has a proper SPA catch-all, `createWebHistory()` can work. But hash history is the safer, simpler choice.

**Warning signs:**
- Blank page after clicking browser back/forward in Electron
- Routes work on first load but break on refresh
- Deep links from notifications/tray show wrong page

**Phase to address:**
Phase 1 or Phase 2 (frontend loading) -- must be changed before the frontend loads in BrowserWindow. This is a one-line change but easy to forget.

---

### Pitfall 5: Vite HMR and WebSocket URL Resolution in Electron

**What goes wrong:**
In development, you want Vite HMR so you can edit Vue components and see changes instantly. But Electron's BrowserWindow loads content differently than a browser tab. If Electron loads `http://localhost:5173` (Vite dev server), HMR works. If it loads a built `file://...index.html`, there is no HMR. The common mistake is not branching the `loadURL` based on dev vs. production mode, or not configuring the Vite dev server to accept connections from Electron's renderer.

Additionally, the app's own WebSocket (`/api/ws` for real-time updates) connects using `location.host`. In Electron, if the renderer loads from Vite dev server (port 5173) but the backend runs on port 3000, the WebSocket URL computation in `useWebSocket.ts` produces `ws://localhost:5173/api/ws` which is proxied by Vite. This works because of the existing Vite proxy config (`/api` -> `localhost:3000` with `ws: true`). But in production Electron (loading built files via `file://`), `location.host` is empty.

**Why it happens:**
The dual-mode nature of Electron development (dev server vs. packaged files) creates two completely different runtime environments. Code that uses `location.protocol` and `location.host` (like `getWsUrl()` in `useWebSocket.ts`) assumes a browser-like HTTP environment.

**How to avoid:**
1. In Electron main process, branch on environment:
   ```typescript
   if (isDev) {
     mainWindow.loadURL('http://localhost:5173');
   } else {
     mainWindow.loadURL('http://localhost:3000');
   }
   ```
2. **Recommended for this app**: Always load from localhost (Vite in dev, Fastify in prod). The backend already serves static files in production mode and handles WebSocket connections. This sidesteps all `file://` protocol issues (CSP, WebSocket URLs, router history mode).
3. Never load from `file://` -- it causes too many downstream problems for an app that relies on WebSocket connections to a local server.
4. Set `webPreferences.webSecurity` to `true` (default) -- never disable it.

**Warning signs:**
- HMR updates don't appear in the Electron window during development
- WebSocket connection fails with `ws://localhost:NaN/api/ws` or empty host
- Console shows `Mixed Content` or CSP errors
- App works in browser but not in Electron window

**Phase to address:**
Phase 1 (development workflow setup) -- this determines the entire dev experience. Get it right early or every subsequent phase has friction.

---

### Pitfall 6: Tray Icon Disappears or Crashes on macOS

**What goes wrong:**
Three common failure modes: (1) The Tray object is garbage collected because it is stored in a local variable instead of a module-level variable, causing the tray icon to vanish after ~1 minute. (2) Destroying the tray while a tray menu event handler is executing causes a segfault crash. (3) The app leaves "ghost" tray icons when it crashes or is force-quit, which persist until the user hovers over them.

**Why it happens:**
(1) JavaScript garbage collection. If `const tray = new Tray(icon)` is inside a function scope and the reference is not stored globally, V8 GCs the Tray instance. (2) Electron's native tray code is not re-entrant -- destroying the tray object while its own callback is on the stack causes undefined behavior. (3) macOS does not remove tray icons when a process dies unexpectedly; it only removes them when the mouse hovers over the dead icon area.

**How to avoid:**
1. Store the Tray instance in a module-level variable: `let tray: Tray | null = null;`
2. Create the tray in `app.whenReady()`, not in a window creation function.
3. Never call `tray.destroy()` inside a tray event handler. If needed, defer with `setImmediate()`.
4. Use a proper Template image for macOS (filename must end with `Template.png` or `Template@2x.png`) so it adapts to light/dark menu bar automatically.
5. For close-to-tray: intercept `window.on('close')`, call `event.preventDefault()` + `window.hide()` + `app.dock.hide()`. On tray click, call `window.show()` + `app.dock.show()`.
6. Accept that ghost icons after force-quit are an OS-level limitation -- not fixable.

**Warning signs:**
- Tray icon visible for ~60 seconds then disappears
- App crashes when clicking tray menu items
- Tray icon appears but menu does not respond
- Icon looks wrong in dark mode (not using Template image)

**Phase to address:**
Phase 2 or 3 (tray and dock integration) -- after basic Electron shell works.

---

### Pitfall 7: CSP Blocks Inline Styles, eval, or WebSocket Connections

**What goes wrong:**
Electron displays security warnings in the console: "Insecure Content-Security-Policy". If you then add a strict CSP, DaisyUI/Tailwind inline styles break, Chart.js may use `eval()` for canvas rendering, and WebSocket connections to `ws://localhost:3000` are blocked by `connect-src` restrictions.

**Why it happens:**
Electron recommends setting a CSP to prevent XSS in the renderer process. But this app uses: (1) Tailwind/DaisyUI which generates inline styles, (2) Chart.js which may use dynamic code evaluation, (3) WebSocket connections to localhost. A naive CSP like `default-src 'self'` breaks all three.

**How to avoid:**
Since this is a localhost-only personal tool (not distributed publicly, no untrusted content loaded), use a pragmatic CSP that silences the warning without breaking functionality:
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self';
    style-src 'self' 'unsafe-inline';
    script-src 'self';
    connect-src 'self' ws://localhost:* http://localhost:*;
    img-src 'self' data:;">
```
If loading from Fastify (recommended), `'self'` covers everything. The `'unsafe-inline'` for styles is necessary for Tailwind. Do NOT add `'unsafe-eval'` unless Chart.js specifically requires it (test first -- modern Chart.js v4 does not).

**Warning signs:**
- Console filled with `Refused to apply inline style` errors
- Charts render as blank canvas
- WebSocket connection silently fails (no error, just never connects)
- `Electron Security Warning (Insecure Content-Security-Policy)` in console

**Phase to address:**
Phase 2 (BrowserWindow configuration) -- set the CSP in the HTML meta tag or via `session.defaultSession.webRequest.onHeadersReceived`.

---

### Pitfall 8: ASAR Packaging Excludes or Breaks SQLite Binary

**What goes wrong:**
When packaging with electron-builder, the entire app is bundled into an ASAR archive (a tar-like readonly filesystem). Native `.node` binaries inside ASAR cannot be loaded by `dlopen()` because the OS cannot read files from inside the archive. The app works in development but the packaged `.app` crashes with `Error: Cannot open database` or `dlopen failed`.

**Why it happens:**
electron-builder defaults to ASAR packaging for performance and to prevent casual source tampering. But native modules (better-sqlite3's `.node` binary) need real filesystem access. The ASAR virtual filesystem does not support `dlopen()` or random-access file writes.

**How to avoid:**
In `electron-builder` config (package.json or electron-builder.yml):
```json
{
  "build": {
    "asar": true,
    "asarUnpack": [
      "**/node_modules/better-sqlite3/**",
      "**/node_modules/bindings/**",
      "**/node_modules/file-uri-to-path/**"
    ]
  }
}
```
This keeps most files in the ASAR for performance but extracts better-sqlite3 and its dependencies to `app.asar.unpacked/`. The `bindings` module (used by better-sqlite3 to locate its `.node` file) automatically looks in the unpacked directory.

Important: The database file itself must NEVER be inside the ASAR. Use `app.getPath('userData')` for the database location (see Pitfall 2).

**Warning signs:**
- Works in `electron .` but fails in packaged `.app`
- `Error: Dynamic Linking Error` or `Cannot find module` for `.node` files
- Database reads work but writes fail (ASAR is read-only)

**Phase to address:**
Phase 3 or 4 (packaging) -- only matters when you first try `electron-builder`. But configure `asarUnpack` early so you are not surprised.

---

### Pitfall 9: Development Workflow Friction -- Three Processes to Coordinate

**What goes wrong:**
The current dev workflow is `pnpm dev` which runs Vite frontend + Fastify backend via `concurrently`. Adding Electron means a third process. Developers end up with: (1) Vite dev server, (2) Fastify backend, (3) Electron main process. Starting all three manually, restarting on changes, and understanding which logs come from which process becomes chaotic. Many tutorials show a `wait-on` + `concurrently` setup that is fragile and has race conditions (Electron launches before backend is ready).

**Why it happens:**
Electron is a process launcher, not a bundler. It does not replace Vite or the backend -- it wraps them. The development workflow must orchestrate three independent processes with startup ordering (backend must be ready before Electron loads the URL).

**How to avoid:**
1. **Keep the existing `pnpm dev` unchanged** for browser-based development. Not every change needs Electron.
2. Add a separate `pnpm dev:electron` script that:
   - Starts Vite dev server (port 5173)
   - Starts Fastify backend (port 3000)
   - Waits for backend to be ready (poll `http://localhost:3000/api/health`)
   - Launches Electron, loading `http://localhost:5173`
3. Use `concurrently` with `wait-on`:
   ```json
   "dev:electron": "concurrently \"pnpm --filter @cowboy/backend dev\" \"pnpm --filter @cowboy/frontend dev\" \"wait-on http://localhost:3000/api/health && electron .\""
   ```
4. For Electron main process changes, use `electronmon` or `nodemon` watching the main process file to auto-restart Electron without restarting the backend/frontend.
5. Do NOT embed the backend inside Electron's main process during development -- keep them separate for faster iteration.

**Warning signs:**
- Electron window shows "connection refused" on first launch (backend not ready)
- Developers avoid running Electron and just use the browser (losing integration testing)
- Phantom processes after Ctrl+C (concurrently does not always propagate signals cleanly)

**Phase to address:**
Phase 1 (project scaffolding) -- the dev workflow must be smooth from day one or it will slow every subsequent phase.

---

### Pitfall 10: close-to-tray vs. Quit Semantics on macOS

**What goes wrong:**
On macOS, Cmd+W closes the window but should not quit the app (standard macOS behavior). Cmd+Q should quit. The red window close button should minimize to tray. But implementing this incorrectly causes: (1) Cmd+Q does not actually quit because `window.on('close')` always prevents default, (2) the dock icon disappears but the app cannot be restored, (3) `app.on('activate')` (clicking dock icon) does not recreate the window because `app.dock.hide()` was called.

**Why it happens:**
macOS app lifecycle is fundamentally different from Windows/Linux. The distinction between "close window" and "quit app" is an OS convention that Electron does not enforce. You must manually implement the state machine: Window close -> hide to tray. Cmd+Q -> actually quit. Dock click -> show window. Tray click -> show window + dock icon.

**How to avoid:**
Implement an `isQuitting` flag pattern:
```typescript
let isQuitting = false;

app.on('before-quit', () => { isQuitting = true; });

mainWindow.on('close', (event) => {
  if (!isQuitting) {
    event.preventDefault();
    mainWindow.hide();
    app.dock?.hide();
  }
  // If isQuitting is true, let the default close happen
});

app.on('activate', () => {
  mainWindow.show();
  app.dock?.show();
});

// Tray click handler:
tray.on('click', () => {
  mainWindow.show();
  app.dock?.show();
});
```
Test all four paths: red close button, Cmd+W, Cmd+Q, dock right-click Quit.

**Warning signs:**
- Cmd+Q does not quit the app (requires Force Quit)
- Clicking dock icon after closing window does nothing
- App disappears entirely (no tray, no dock, no window) but process is still running
- Multiple BrowserWindows created on `activate`

**Phase to address:**
Phase 2 (window management and tray) -- must get the state machine right before moving on.

---

### Pitfall 11: Chokidar File Watchers Leak on Unclean Shutdown

**What goes wrong:**
The current file watcher plugin has a clean `closeWatchers()` + `onClose` hook pattern. But in Electron, if the backend child process is killed with SIGKILL (timeout fallback from Pitfall 3), the Fastify `onClose` hook never runs. The chokidar watchers keep file descriptors open in the dying process, and on macOS this can cause FSEvents resource exhaustion if it happens repeatedly during development.

**Why it happens:**
SIGKILL is not catchable -- the process is terminated immediately without running any cleanup handlers. If the graceful SIGTERM timeout expires and SIGKILL is sent as a fallback, chokidar's FSEvents handles are leaked.

**How to avoid:**
1. Make the SIGTERM timeout generous enough (5 seconds) that the backend has time to close Fastify and its watchers.
2. In the backend entry point, add an explicit SIGTERM handler:
   ```typescript
   process.on('SIGTERM', async () => {
     await app.close(); // triggers onClose hooks including closeWatchers
     process.exit(0);
   });
   ```
3. Only use SIGKILL as a last resort (>5s timeout).
4. On Electron startup, check for and clean up stale lock files or ports from previous sessions.

**Warning signs:**
- `ulimit` errors after many restart cycles during development
- Backend takes longer and longer to shut down
- macOS "too many open files" errors

**Phase to address:**
Phase 1 (child process management) -- wire up SIGTERM handling when first implementing the backend spawn.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Loading `file://` instead of localhost | No need to start backend first | CSP issues, WebSocket URL broken, router history broken, duplicated static serving logic | Never for this app -- always load from Fastify |
| Running backend inside Electron main process | One fewer process to manage | Blocks the main process (UI freezes during ingestion), native module context conflicts | Never -- main process must stay responsive |
| Disabling `webSecurity` in BrowserWindow | Fixes CORS/CSP errors quickly | Opens renderer to arbitrary remote code injection | Never -- configure CSP properly instead |
| Hardcoding `localhost:3000` in renderer | Quick fix for WebSocket URL | Breaks if port changes, breaks in tests | Never -- use `location.host` (already correct when loading from localhost) |
| Skipping `@electron/rebuild` | Fewer build steps | Breaks on Electron upgrade, breaks in CI, breaks on different arch | Never |
| Using `nodeIntegration: true` in BrowserWindow | Renderer can `require()` Node modules directly | Massive security hole -- any XSS in renderer has full Node access | Never -- use preload scripts with contextBridge if Node APIs are needed |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| better-sqlite3 + Electron | Compiling against system Node headers | Use `@electron/rebuild` after every `npm install`; set `asarUnpack` for packaging |
| Fastify as child process | Using relative module path in `fork()` | Use absolute path resolved from `app.getAppPath()` or `__dirname`; in packaged mode, resolve from `app.asar.unpacked` |
| Chokidar in child process | Assuming watchers clean up on process exit | Explicit SIGTERM handler calling `fastify.close()` before `process.exit()` |
| Vue Router in Electron | Using `createWebHistory()` | Switch to `createWebHashHistory()` for reliable routing regardless of load method |
| WebSocket URL (`useWebSocket.ts`) | Assuming `location.host` always resolves correctly | Works when loading from localhost; verify URL computation in both dev (port 5173) and production (port 3000) Electron modes |
| Vite proxy in dev | Assuming Electron uses same proxy config as browser | Electron loads from Vite dev server URL, so the proxy in `vite.config.ts` works -- but only in dev mode |
| Drizzle migrations in child process | Running migrations from ASAR path | Migrations directory must also be in `asarUnpack`, or use absolute path to unpacked location |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Backend in main process | UI freezes during SQLite queries or JSONL parsing | Always run backend as child/utility process | Immediately on first large ingestion |
| Full Electron restart on main process file change | 3-5 second restart cycle, loses window state | Use `electronmon` watching only main process files | During active development, every save |
| Not unpacking better-sqlite3 from ASAR | Slower cold start (ASAR read + extract to temp) | `asarUnpack` in electron-builder config | On every cold start of packaged app |
| Bundling all node_modules in ASAR | Large app size (>200MB), slow startup | Use electron-builder `files` config to exclude dev dependencies and test files | When packaging |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `nodeIntegration: true` in BrowserWindow | Full Node.js access from renderer -- any XSS has shell access | Default is `false`; use `contextBridge` + preload for any Node APIs needed in renderer |
| `webSecurity: false` | Disables same-origin policy; renderer can load arbitrary remote content | Never disable; configure CSP properly instead |
| No CSP header/meta tag | Electron prints security warnings; renderer is vulnerable to injected scripts | Add meta tag CSP allowing `'self'` + `'unsafe-inline'` for styles + `ws://localhost:*` |
| Exposing broad `ipcMain` handlers | Renderer could call arbitrary main process functions | Validate all IPC message shapes; use a typed IPC channel pattern |
| Loading remote URLs in BrowserWindow | Opens the app to remote code execution | Only load `localhost` URLs; set `webPreferences.allowRunningInsecureContent: false` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual indicator that app is still running in tray | User thinks app crashed after closing window | Show a brief notification on first close-to-tray: "Cowboy is still running in the menu bar" |
| Electron DevTools open by default in production | Users see confusing developer tools | Only open DevTools when `isDev` is true or via a hidden menu item |
| Window position not remembered across restarts | Window appears in different position each launch | Use `electron-window-state` or manually persist bounds to `app.getPath('userData')` |
| No menu bar at all | macOS shows "Electron" in menu bar instead of "Cowboy" | Always create a minimal Menu with app name; even if it only has About and Quit |
| Backend startup delay shows blank window | User sees empty white window for 1-2 seconds while Fastify starts | Show a loading indicator or splash screen; only call `mainWindow.show()` after backend health check passes |

## "Looks Done But Isn't" Checklist

- [ ] **Native module rebuild:** `better-sqlite3` loads in Electron context (not just in `node` CLI) -- verify by opening Electron and checking for crash
- [ ] **Database path:** DB is created in `app.getPath('userData')`, NOT in `./data/` -- verify by checking the file location after first run in Electron
- [ ] **Child process cleanup:** Kill the app via Cmd+Q, then check Activity Monitor for orphaned `node` processes on port 3000
- [ ] **Router history mode:** Navigate to a deep route (`/#/conversations/abc123`), then refresh -- page should not go blank
- [ ] **Close-to-tray:** Close window (red button) -> verify tray icon visible -> click tray -> window reappears -> Cmd+Q -> verify process actually exits
- [ ] **CSP:** Open DevTools console in Electron -- should have zero CSP violation warnings
- [ ] **ASAR unpacking:** Run the packaged `.app` (not `electron .`) and verify better-sqlite3 loads and database works
- [ ] **Dev workflow:** `pnpm dev:electron` starts all three processes and Electron window shows the dashboard with HMR working
- [ ] **Window state:** Close and reopen the app -- window should appear at the same position and size
- [ ] **WebSocket in Electron:** Real-time updates (file changes -> dashboard update) work in both dev and production Electron modes

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Native module ABI mismatch | LOW | `npx @electron/rebuild -f -w better-sqlite3` and restart |
| Wrong database path | MEDIUM | Find the rogue `cowboy.db`, move it to the correct `userData` location; update the path resolution code |
| Orphaned child processes | LOW | `pkill -f "node.*cowboy"` or `lsof -i :3000` then `kill`; add cleanup to app startup |
| createWebHistory routing breaks | LOW | One-line change to `createWebHashHistory()`; existing routes just get `#` prefix |
| Tray icon garbage collected | LOW | Move `tray` variable to module scope; restart app |
| CSP blocks functionality | LOW | Adjust CSP meta tag; test in DevTools console |
| ASAR packaging breaks native module | LOW | Add `asarUnpack` config; rebuild package |
| Dev workflow race condition | LOW | Add `wait-on` for backend health check before launching Electron |
| Close-to-tray state machine wrong | MEDIUM | Implement `isQuitting` flag pattern; test all four quit/close paths |
| File watcher leak | LOW | Add explicit SIGTERM handler in backend entry point; increase shutdown timeout |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Native module ABI mismatch | Phase 1: Electron scaffolding | `better-sqlite3` loads in Electron without errors |
| Relative database path | Phase 1: Backend child process | `cowboy.db` exists in `~/Library/Application Support/cowboy/` |
| Child process not killed | Phase 1: Backend child process | No orphan `node` processes after Cmd+Q |
| Vue Router history mode | Phase 1 or 2: Frontend loading | Deep route refresh works in Electron |
| Vite HMR + WebSocket URLs | Phase 1: Dev workflow | Editing a `.vue` file updates the Electron window; WebSocket connects in both modes |
| Tray icon disappears | Phase 2: Tray integration | Tray icon persists after 5+ minutes of running |
| CSP blocks functionality | Phase 2: BrowserWindow config | Zero CSP warnings in DevTools console |
| ASAR breaks native module | Phase 3+: Packaging | Packaged `.app` starts without errors |
| Dev workflow friction | Phase 1: Project scaffolding | Single `pnpm dev:electron` command starts everything |
| Close-to-tray semantics | Phase 2: Window management | All four close/quit paths work correctly |
| File watcher cleanup | Phase 1: Backend process management | Clean shutdown in <3 seconds on Cmd+Q |

## Sources

- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process)
- [Electron app.getPath() API](https://www.electronjs.org/docs/latest/api/app)
- [Electron Tray API - Ghost icons issue #31134](https://github.com/electron/electron/issues/31134)
- [Electron Tray destruction crash issue #12862](https://github.com/electron/electron/issues/12862)
- [Electron Tray icon disappearance issue #822](https://github.com/electron/electron/issues/822)
- [Electron process.cwd() returns '/' issue #2108](https://github.com/electron/electron/issues/2108)
- [Electron child process termination issue #7084](https://github.com/electron/electron/issues/7084)
- [electron-vite HMR documentation](https://electron-vite.org/guide/hmr)
- [electron-vite troubleshooting](https://electron-vite.org/guide/troubleshooting)
- [Fastify graceful shutdown](https://github.com/hemerajs/fastify-graceful-shutdown)
- [better-sqlite3 Electron rebuild issue #1163](https://github.com/WiseLibs/better-sqlite3/issues/1163)
- [electron-builder path issues #4289](https://github.com/electron-userland/electron-builder/issues/4289)
- [Electron CSP for file:// protocol](https://blog.coding.kiwi/electron-csp-local/)
- [Electron dock.hide() + app.hide() conflict #16093](https://github.com/electron/electron/issues/16093)
- [Electron Forge Vue 3 integration](https://www.electronforge.io/guides/framework-integration/vue-3)
- Codebase analysis: `packages/backend/src/db/index.ts` (relative path `./data/cowboy.db`), `packages/frontend/src/router/index.ts` (`createWebHistory()`), `packages/frontend/src/composables/useWebSocket.ts` (`location.host` URL construction), `packages/backend/src/plugins/file-watcher.ts` (chokidar cleanup hooks), `packages/backend/src/index.ts` (backend entry point lacks SIGTERM handler)

---
*Pitfalls research for: Electron desktop wrapper for Cowboy analytics dashboard*
*Researched: 2026-03-11*
