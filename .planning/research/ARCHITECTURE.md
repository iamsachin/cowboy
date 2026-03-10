# Architecture: Electron Desktop Wrapper Integration

**Domain:** Electron wrapper for existing Vue 3 + Vite + Fastify + SQLite analytics dashboard
**Researched:** 2026-03-11
**Confidence:** HIGH

## Current Architecture (Baseline)

```
┌──────────────────────────────────────────────────────────────┐
│  Terminal: npm run dev                                        │
│  (concurrently runs backend + frontend)                       │
├────────────────────────┬─────────────────────────────────────┤
│  @cowboy/backend        │  @cowboy/frontend                   │
│  Fastify on :3000       │  Vite dev server on :5173           │
│  - REST API (/api/*)    │  - Vue 3 SPA                        │
│  - WebSocket (/api/ws)  │  - Proxies /api → :3000             │
│  - File watchers        │  - HMR                              │
│  - SQLite + Drizzle     │                                     │
│  - Static file serving  │                                     │
│    (prod only)          │                                     │
├────────────────────────┴─────────────────────────────────────┤
│  @cowboy/shared — TypeScript types                            │
└──────────────────────────────────────────────────────────────┘
```

**Key architectural facts that constrain Electron integration:**

1. Backend uses `better-sqlite3` (native C++ addon) -- requires rebuild against Electron's Node.js headers
2. Backend listens on port 3000 -- BrowserWindow can load `http://localhost:3000` directly
3. Frontend in dev mode runs Vite on :5173 with proxy to :3000 -- BrowserWindow loads :5173 URL
4. Frontend in prod builds to `packages/frontend/dist/` -- served by Fastify via `@fastify/static`
5. WebSocket lives at `/api/ws` on the Fastify server -- BrowserWindow connects to it as a regular web page would
6. `packages/shared` provides typed interfaces consumed by both frontend and backend

## Target Architecture with Electron

```
┌─────────────────────────────────────────────────────────────────────┐
│  Electron Main Process (packages/electron/src/main.ts)              │
│                                                                      │
│  app.whenReady() →                                                   │
│    1. Fork backend as child process (child_process.fork)             │
│    2. Wait for backend "ready" message on IPC                        │
│    3. Create BrowserWindow → load backend URL                        │
│    4. Create Tray icon                                               │
│    5. Register app menu                                              │
│                                                                      │
│  Lifecycle:                                                          │
│    - window close → hide window (close-to-tray)                      │
│    - tray click → show window                                        │
│    - app quit → kill child process → app.quit()                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐    │
│  │  Child Process       │    │  BrowserWindow (Renderer)        │    │
│  │  @cowboy/backend     │◄──►│  Loads http://localhost:3000     │    │
│  │  Fastify on :3000    │    │  (or :5173 in dev via Vite)      │    │
│  │  - REST API          │    │                                  │    │
│  │  - WebSocket         │    │  @cowboy/frontend                │    │
│  │  - File watchers     │    │  - Vue 3 SPA                    │    │
│  │  - SQLite            │    │  - WebSocket to /api/ws          │    │
│  └─────────────────────┘    └──────────────────────────────────┘    │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  @cowboy/shared — TypeScript types (unchanged)                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Why This Architecture

**The backend stays as a child process communicating over HTTP/WebSocket, not Electron IPC.** This is the critical architectural decision. Rationale:

1. **Zero changes to existing frontend.** The Vue 3 SPA already communicates with Fastify over REST + WebSocket. Loading it in a BrowserWindow that points at `localhost:3000` means the frontend code does not need a single line changed. No IPC bridge, no preload script API surface, no `contextBridge` complexity.

2. **Zero changes to existing backend.** The Fastify server already serves the SPA in production, handles API routes, and runs WebSocket. It works identically whether a browser or BrowserWindow loads it.

3. **Clean process isolation.** SQLite + file watchers + chokidar run in the child process. If the backend crashes, Electron main process can restart it. The main process stays lightweight (window management + tray + lifecycle only).

4. **Development mode is trivial.** In dev, the existing `npm run dev` (concurrently) still works. Electron main process just loads `http://localhost:5173` instead of `:3000`. No electron-vite needed for the renderer -- Vite dev server handles HMR directly.

**Why NOT Electron IPC:** The existing WebSocket infrastructure is rich (typed events, discriminated unions, seq numbers, conversation-scoped routing). Replicating this over Electron IPC would require a complete communication layer rewrite with no benefit on localhost. IPC is faster, but the data volumes here (small JSON payloads, <50KB) make the difference imperceptible.

**Why NOT `utilityProcess`:** Electron's `utilityProcess.fork()` runs in a sandboxed environment using Chromium's Services API. It has restrictions on native module loading that would conflict with `better-sqlite3`. The standard Node.js `child_process.fork()` with `ELECTRON_RUN_AS_NODE=1` gives a clean Node.js environment identical to running the backend standalone. This is the established pattern for Electron apps with native module backends.

## New Package: `packages/electron`

### Directory Structure

```
packages/electron/
├── package.json
├── tsconfig.json
├── electron-builder.yml          # Build/packaging config
├── build/
│   ├── icon.icns                 # macOS app icon
│   ├── icon.png                  # Linux/fallback
│   └── trayTemplate.png          # macOS tray icon (16x16, Template suffix)
│   └── trayTemplate@2x.png       # macOS tray icon (32x32, Retina)
├── src/
│   ├── main.ts                   # Electron entry point
│   ├── backend-manager.ts        # Fork/kill/restart backend child process
│   ├── window-manager.ts         # BrowserWindow creation + show/hide
│   ├── tray.ts                   # System tray setup
│   ├── menu.ts                   # Native menu bar
│   └── preload.ts                # Minimal preload (CSP + window title)
└── dist/                         # Compiled output
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `main.ts` | App lifecycle: ready, activate, before-quit, window-all-closed | All other electron modules |
| `backend-manager.ts` | Fork backend process, listen for ready signal, handle crash/restart, kill on quit | Backend child process via Node IPC |
| `window-manager.ts` | Create BrowserWindow, load URL (dev or prod), handle close-to-tray vs quit | main.ts, tray.ts |
| `tray.ts` | Create macOS menu bar tray, click-to-show, context menu (Show/Quit) | window-manager.ts |
| `menu.ts` | App menu: About dialog, Quit accelerator, Edit menu (copy/paste/undo) | Electron Menu API |
| `preload.ts` | Minimal: expose app version to renderer via contextBridge (optional) | Renderer (BrowserWindow) |

## Component Details

### main.ts -- App Lifecycle

```typescript
import { app, BrowserWindow } from 'electron';
import { createWindow, getWindow } from './window-manager.js';
import { startBackend, stopBackend } from './backend-manager.js';
import { createTray } from './tray.js';
import { createMenu } from './menu.js';

let isQuitting = false;

app.whenReady().then(async () => {
  createMenu();

  // Start backend and wait for it to be ready
  const backendPort = await startBackend();

  // Create main window pointing at backend
  const isDev = !app.isPackaged;
  const url = isDev
    ? 'http://localhost:5173'   // Vite dev server (frontend)
    : `http://localhost:${backendPort}`;  // Fastify serves built frontend

  createWindow(url);
  createTray();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // On macOS, don't quit -- tray keeps app alive
  // On other platforms, quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // macOS dock click: show existing window
  const win = getWindow();
  if (win) win.show();
  else createWindow(/* url */);
});

app.on('will-quit', async () => {
  await stopBackend();
});

export { isQuitting };
```

### backend-manager.ts -- Child Process Management

```typescript
import { fork, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { app } from 'electron';

let backendProcess: ChildProcess | null = null;

export function startBackend(): Promise<number> {
  return new Promise((resolve, reject) => {
    const backendEntry = app.isPackaged
      ? path.join(process.resourcesPath, 'backend', 'src', 'index.js')
      : path.resolve(__dirname, '../../backend/src/index.ts');

    const execPath = app.isPackaged
      ? process.execPath  // Bundled Node within Electron
      : undefined;        // Use system tsx in dev

    const args: string[] = [];
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: app.isPackaged ? 'production' : 'development',
    };

    // In dev, use tsx to run TypeScript directly
    if (!app.isPackaged) {
      backendProcess = fork(backendEntry, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        execArgv: ['--import', 'tsx'],
      });
    } else {
      backendProcess = fork(backendEntry, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });
    }

    // Backend sends { type: 'ready', port: 3000 } when Fastify is listening
    backendProcess.on('message', (msg: any) => {
      if (msg.type === 'ready') {
        resolve(msg.port);
      }
    });

    backendProcess.on('error', reject);
    backendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Backend exited with code ${code}`);
        // Optionally restart
      }
      backendProcess = null;
    });

    // Forward backend logs to main process console
    backendProcess.stdout?.on('data', (data) => process.stdout.write(data));
    backendProcess.stderr?.on('data', (data) => process.stderr.write(data));
  });
}

export async function stopBackend(): Promise<void> {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}
```

**Required backend change:** Add IPC ready signal to `packages/backend/src/index.ts`:

```typescript
// Existing code
async function start() {
  runMigrations();
  const app = await buildApp();
  await app.listen({ port: 3000, host: '0.0.0.0' });

  // NEW: Signal to Electron main process that backend is ready
  if (process.send) {
    process.send({ type: 'ready', port: 3000 });
  }
}
```

This is a 3-line addition. `process.send` only exists when the process was forked with IPC channel, so this is a no-op when backend runs standalone.

### window-manager.ts -- BrowserWindow

```typescript
import { BrowserWindow } from 'electron';
import path from 'node:path';
import { isQuitting } from './main.js';

let mainWindow: BrowserWindow | null = null;

export function createWindow(url: string): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    titleBarStyle: 'hiddenInset',  // Native macOS traffic lights
    trafficLightPosition: { x: 15, y: 15 },
    vibrancy: 'sidebar',           // Optional macOS frosted glass
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(url);

  // Close-to-tray: hide instead of destroy
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function getWindow(): BrowserWindow | null {
  return mainWindow;
}

export function showWindow(): void {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
}
```

### tray.ts -- System Tray

```typescript
import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'node:path';
import { showWindow } from './window-manager.js';

let tray: Tray | null = null;

export function createTray(): void {
  // macOS: use Template image for automatic dark/light mode
  const iconPath = path.join(__dirname, '../build/trayTemplate.png');
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon);
  tray.setToolTip('Cowboy');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Cowboy', click: showWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);

  // macOS: left-click on tray shows window
  tray.on('click', showWindow);
}
```

## Data Flow: Dev Mode vs Production

### Dev Mode

```
Electron main process
  │
  ├── fork() → @cowboy/backend (tsx watch src/index.ts)
  │              Fastify on :3000 (API + WebSocket)
  │
  └── BrowserWindow.loadURL('http://localhost:5173')
                     │
                     └── Vite dev server with HMR
                         Proxy /api → localhost:3000
                         Proxy /api/ws → localhost:3000 (WebSocket)
```

**Dev workflow change:** Instead of `npm run dev` (concurrently), the electron package provides `npm run electron:dev` which:
1. Starts Vite dev server (`pnpm --filter @cowboy/frontend dev`)
2. Compiles electron main process with tsc or esbuild
3. Launches Electron, which forks the backend

The existing `npm run dev` continues to work for browser-based development.

### Production

```
Electron main process
  │
  ├── fork() → @cowboy/backend (compiled JS)
  │              Fastify on :3000
  │              Serves packages/frontend/dist/ via @fastify/static
  │              API + WebSocket on same port
  │
  └── BrowserWindow.loadURL('http://localhost:3000')
                     │
                     └── Fastify serves built SPA + handles API + WebSocket
                         (identical to current non-Electron production mode)
```

**Key insight:** In production, BrowserWindow loads `http://localhost:3000`, NOT a `file://` path. This means:
- No `base: './'` change needed in Vite config
- No `file://` protocol CSP issues
- No asset path rewriting
- The frontend works identically to current browser-based production mode

## IPC and WebSocket Coexistence

There are two communication channels in this architecture:

| Channel | Between | Purpose | Protocol |
|---------|---------|---------|----------|
| Node IPC | Electron main <-> Backend child process | Process lifecycle only: "ready" signal, health check | `process.send()` / `process.on('message')` |
| WebSocket | BrowserWindow (renderer) <-> Backend | All app data: typed events, conversation updates, token streams | Existing `@fastify/websocket` at `/api/ws` |

**They do NOT overlap.** Node IPC handles only process management (2-3 message types: ready, shutdown, health). WebSocket handles all application data (existing typed event system with discriminated unions). The frontend code has zero awareness of Electron IPC.

### Message Types on Node IPC

```typescript
// Backend → Main
{ type: 'ready', port: number }

// Main → Backend (optional, for graceful shutdown)
{ type: 'shutdown' }
```

That is the entire IPC surface. Everything else goes through HTTP/WebSocket as it does today.

## Build Pipeline Changes

### Current Build

```bash
pnpm --filter @cowboy/frontend build    # Vue 3 → packages/frontend/dist/
pnpm --filter @cowboy/backend build     # tsc → packages/backend/dist/  (optional, tsx runs TS directly)
```

### New Build Pipeline

```bash
# 1. Build shared types (already implicit via workspace:*)
pnpm --filter @cowboy/shared build

# 2. Build frontend (unchanged)
pnpm --filter @cowboy/frontend build

# 3. Build backend (compile TS → JS for packaging)
pnpm --filter @cowboy/backend build

# 4. Build electron main process
pnpm --filter @cowboy/electron build
# → Compiles src/*.ts → dist/*.js via tsc or esbuild

# 5. Package into .app (optional, for distribution)
pnpm --filter @cowboy/electron package
# → electron-builder packages everything into Cowboy.app
```

### Packaging Concerns

**better-sqlite3 native module:** This is the only native dependency. It requires:

1. **Rebuild against Electron headers:** Run `@electron/rebuild` after install to compile better-sqlite3 against Electron's Node.js version (not the system Node.js).
2. **ASAR unpacking:** better-sqlite3's `.node` binary cannot load from within an ASAR archive. Configuration: `"asarUnpack": ["**/node_modules/better-sqlite3/**"]`
3. **postinstall script:** Add `"postinstall": "electron-rebuild"` to packages/electron/package.json

**However:** PROJECT.md explicitly states "Distributable installer / .dmg -- personal use only, run from source" is out of scope. This means packaging/distribution is deferred. For running from source, `electron .` with the backend forked via `tsx` avoids all native module rebuild issues because the backend uses the system Node.js (via `ELECTRON_RUN_AS_NODE=1`), not Electron's bundled Node.

## Integration Points

### New Components

| Component | Package | Purpose |
|-----------|---------|---------|
| `main.ts` | `@cowboy/electron` | Electron app entry, lifecycle orchestration |
| `backend-manager.ts` | `@cowboy/electron` | Fork/manage backend child process |
| `window-manager.ts` | `@cowboy/electron` | BrowserWindow creation, close-to-tray |
| `tray.ts` | `@cowboy/electron` | System tray icon + context menu |
| `menu.ts` | `@cowboy/electron` | Native macOS app menu |
| `preload.ts` | `@cowboy/electron` | Minimal preload script (contextIsolation) |

### Modified Components (Minimal)

| Component | Package | Change | Risk |
|-----------|---------|--------|------|
| `index.ts` | `@cowboy/backend` | Add `process.send({ type: 'ready' })` after listen (3 lines) | NONE -- no-op when not forked |
| `package.json` | root | Add `electron:dev` script | NONE -- additive |
| `pnpm-workspace.yaml` | root | Add `packages/electron` to workspace | NONE -- additive |

### Unchanged Components

Everything else. The frontend, backend routes, ingestion pipeline, WebSocket system, shared types, SQLite schema, file watchers -- all unchanged. This is the primary benefit of the localhost HTTP architecture.

## Patterns to Follow

### Pattern 1: Backend as Managed Child Process

**What:** The Electron main process forks the Fastify backend using `child_process.fork()` with `ELECTRON_RUN_AS_NODE=1`. The main process acts as a supervisor: starting, monitoring, and stopping the backend.

**When:** Always -- this is the core integration pattern.

**Why fork, not spawn:** `fork()` creates a Node.js IPC channel automatically. The backend can `process.send({ type: 'ready' })` when Fastify finishes listening. No port scanning, no polling, no race conditions.

**Why ELECTRON_RUN_AS_NODE:** Without this flag, `fork()` would spawn another Electron instance. With it, the child process runs as plain Node.js, which is exactly what the backend needs.

### Pattern 2: URL-Based Window Loading

**What:** BrowserWindow loads an HTTP URL (`localhost:3000` in prod, `localhost:5173` in dev), not a `file://` path.

**When:** Always -- because the Fastify backend already serves the SPA.

**Why:** Avoids an entire class of Electron packaging issues: no `file://` CSP problems, no `base: './'` in Vite, no broken asset paths, no CORS issues. The tradeoff is consuming a localhost port, which is acceptable for a personal tool.

### Pattern 3: Close-to-Tray with Quit Guard

**What:** Window close button hides the window instead of destroying it. `app.quit()` (from tray menu or Cmd+Q) sets an `isQuitting` flag that bypasses the hide behavior.

**When:** Always on macOS. The backend must keep running to maintain file watchers and SQLite connections.

**Why a flag, not event counting:** Electron's `before-quit` fires before `window.close`. Setting a boolean in `before-quit` and checking it in the window's `close` handler is the established pattern. Trying to distinguish "user clicked X" from "app is quitting" via event types is fragile.

### Pattern 4: Minimal Preload Script

**What:** The preload script exposes at most `window.electron = { version: string }` via `contextBridge`. No IPC bridge, no Node.js API exposure.

**When:** Only if the frontend needs to display the app version or detect it is running in Electron (e.g., hide browser-specific UI).

**Why minimal:** The frontend communicates with the backend over HTTP/WebSocket. There is no need for Electron IPC in the renderer. A minimal preload keeps the security surface small and avoids coupling frontend code to Electron.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Running Backend In-Process

**What:** Import Fastify directly in the Electron main process.
**Why bad:** The main process handles all UI events (window management, tray clicks, menu actions). A busy Fastify server with file watchers and SQLite queries would block the event loop, causing the window to become unresponsive. The famous "blocking Electron's main process" problem.
**Do this instead:** Fork backend as a child process. Complete isolation.

### Anti-Pattern 2: Loading `file://` in BrowserWindow

**What:** Build the frontend and load `file://path/to/dist/index.html` in BrowserWindow, bypassing the Fastify server.
**Why bad:** The frontend needs API routes (`/api/*`) and WebSocket (`/api/ws`). Loading via `file://` means these requests have no server to hit. You would need to proxy them through Electron IPC or run a separate WebSocket client -- massive complexity for zero benefit.
**Do this instead:** Load `http://localhost:3000` where Fastify serves both the SPA and the API.

### Anti-Pattern 3: Using electron-vite for the Renderer

**What:** Configure electron-vite to manage the Vue 3 frontend as the "renderer" process.
**Why bad:** The frontend is an existing, standalone Vite project with its own config, plugins (TailwindCSS v4), and build pipeline. Wrapping it in electron-vite's renderer config would require migrating the Vite config, potentially breaking the existing browser-based dev workflow, and coupling the frontend to Electron.
**Do this instead:** Keep the frontend as-is. The Electron main process simply opens a BrowserWindow pointing at the URL where the frontend is served.

### Anti-Pattern 4: Bridging WebSocket Through Electron IPC

**What:** Have the BrowserWindow's WebSocket connect to the main process via IPC, which then forwards to the backend.
**Why bad:** Adds a hop with no benefit. The BrowserWindow can connect directly to `ws://localhost:3000/api/ws`. Adding an IPC bridge doubles the code paths and makes debugging harder.
**Do this instead:** Direct WebSocket connection from renderer to backend, same as in a browser.

### Anti-Pattern 5: Auto-Updater and Code Signing for Personal Use

**What:** Set up Squirrel/auto-updater, Apple code signing, and notarization.
**Why bad:** PROJECT.md explicitly scopes this out. It is a personal tool run from source. Code signing costs $99/year and adds build complexity.
**Do this instead:** Run from source with `npm run electron:dev` or a simple `electron .` command.

## Scalability Considerations

| Concern | Personal Use (1 user) | Notes |
|---------|----------------------|-------|
| Port collision (:3000) | Unlikely | Could make port configurable or use port 0 (random) with IPC to communicate the assigned port back |
| Backend crash | Restart child process | Main process monitors exit event, can auto-restart with backoff |
| Memory (Electron overhead) | ~80-120MB baseline for Electron shell | Acceptable for a desktop analytics tool |
| Startup time | ~2-3s (Electron init + backend fork + Fastify listen) | Show splash or loading state in BrowserWindow while waiting for backend ready signal |

## Build Order (Dependency-Driven)

Build phases should follow this order based on component dependencies:

1. **packages/electron scaffold** -- package.json, tsconfig, directory structure. No functional code yet.
2. **backend-manager.ts + backend IPC signal** -- Fork backend, wait for ready. Requires the 3-line backend change to `index.ts`. This is the foundation everything else depends on.
3. **window-manager.ts** -- Create BrowserWindow, load URL from backend-manager's resolved port. Depends on phase 2.
4. **main.ts lifecycle** -- Wire ready, activate, before-quit, window-all-closed. Depends on phases 2-3.
5. **tray.ts + close-to-tray** -- System tray icon, context menu, hide-on-close behavior. Depends on phase 3 (window-manager).
6. **menu.ts** -- Native menu bar with About and Quit. Independent, can be built alongside phase 5.
7. **Dev workflow scripts** -- Root package.json scripts for `electron:dev` that orchestrate Vite + Electron + backend. Depends on all above.

Phases 5 and 6 are independent of each other and can be built in parallel.

## Sources

- [Electron utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process) -- evaluated and rejected in favor of child_process.fork for native module compatibility
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) -- main/renderer/utility process architecture
- [Electron Tray API](https://www.electronjs.org/docs/latest/api/tray) -- macOS menu bar tray with Template images
- [electron-vite](https://electron-vite.org/guide/) -- evaluated for reference but not adopted (existing Vite setup sufficient)
- [electron-server (Fastify in Electron)](https://github.com/anonrig/electron-server) -- evaluated, not needed since we use HTTP not IPC
- [Electron child process patterns](https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html) -- ELECTRON_RUN_AS_NODE fork pattern
- [Fastify in child process discussion](https://github.com/fastify/fastify/discussions/3353) -- confirms fork pattern for Fastify in Electron
- [better-sqlite3 with Electron](https://blog.loarsaw.de/using-sqlite-with-electron-electron-forge) -- native module rebuild and ASAR unpack requirements
- [Electron IPC vs WebSocket comparison](https://www.scriptol.com/javascript/ipc-vs-websocket.php) -- latency tradeoffs (irrelevant at our data volumes)
- [Blocking Electron's main process](https://medium.com/actualbudget/the-horror-of-blocking-electrons-main-process-351bf11a763c) -- why backend must NOT run in main process
- [electron-builder vs electron-forge](https://www.electronforge.io/core-concepts/why-electron-forge) -- packaging tool comparison
- Codebase analysis: `packages/backend/src/index.ts` -- 10-line entry point, clean fork target
- Codebase analysis: `packages/backend/src/app.ts` -- Fastify plugin registration order, static file serving
- Codebase analysis: `packages/backend/src/plugins/static.ts` -- resolves frontend/dist relative path
- Codebase analysis: `packages/backend/src/plugins/websocket.ts` -- broadcastEvent decorator on Fastify instance
- Codebase analysis: `packages/frontend/vite.config.ts` -- proxy to :3000, port 5173
- Codebase analysis: `package.json` (root) -- concurrently dev script, pnpm workspace

---
*Architecture research for: Cowboy v3.0 Electron Desktop Wrapper*
*Researched: 2026-03-11*
