# Stack Research: Electron Desktop Wrapper

**Domain:** Electron desktop app wrapping existing Vue 3 + Vite + Fastify analytics dashboard
**Researched:** 2026-03-11
**Confidence:** HIGH

## Context: What Already Exists

This research covers ONLY the stack additions needed for v3.0 Electron wrapping. The existing stack is validated and not re-researched:

| Layer | Existing | Status |
|-------|----------|--------|
| Frontend | Vue 3 + Vite 6 + DaisyUI 5.5 + Tailwind 4.2 | Keep as-is, load in BrowserWindow |
| Backend | Fastify 5.7 + better-sqlite3 12.6 + Drizzle 0.45 | Keep as-is, spawn as child process |
| Shared | @cowboy/shared workspace package | Keep as-is |
| Dev tooling | pnpm workspaces, tsx, concurrently | Keep as-is |

## Recommended Stack Additions

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Electron | ^40.0.0 | Desktop shell: BrowserWindow, Tray, Menu, dock, native window chrome | Current stable (40.8.0 as of 2026-03-05). Ships Chromium 144 + Node 24.11.1. EOL June 2026; next major will release before then. |
| electron-vite | ^5.0.0 | Build tooling for main/preload/renderer processes via Vite | Single `electron.vite.config.ts` manages all three entry points. Handles `base: './'` for file:// protocol automatically. Active (v5.0.0 released Dec 2025). Supports Vite 6 which the project already uses. |

### Why electron-vite Over vite-plugin-electron

| Criterion | electron-vite | vite-plugin-electron |
|-----------|---------------|----------------------|
| Version maturity | v5.0.0 (semver stable) | v0.29.0 (pre-1.0, last published ~1 year ago) |
| Config approach | Separate `electron.vite.config.ts` -- existing frontend vite.config.ts untouched | Modifies existing `vite.config.ts` with plugin imports |
| Defaults | Pre-configured for Electron (base path, externals, source maps) | Manual configuration needed |
| Dev experience | HMR for renderer, hot restart for main, built-in dev command | Same capabilities but more setup |

**Decision: Use electron-vite** because it keeps the existing frontend config completely untouched and provides sensible Electron defaults out of the box.

### Why NOT Electron Forge

Electron Forge is a full build pipeline (init, package, make, publish) designed for distributable apps with installers, auto-updates, and code signing. Cowboy is personal-use, run from source. Forge adds significant complexity (multiple @electron-forge/* packages, forge.config.ts, makers, publishers) with zero benefit here.

If packaging is ever needed (out of scope per PROJECT.md), electron-builder is simpler for a straightforward macOS .app -- 14K GitHub stars, 600K weekly downloads, single dependency.

## Monorepo Integration

### New Package: packages/electron

Add a new workspace package. This keeps the monorepo pattern consistent and avoids polluting the root package.json with Electron concerns.

```
packages/
  electron/                    <-- NEW
    package.json
    electron.vite.config.ts
    src/
      main.ts                  # Electron main process entry
      preload.ts               # Context bridge (minimal)
    resources/
      icon.icns                # macOS dock/tray icon
  frontend/                    <-- UNCHANGED
  backend/                     <-- UNCHANGED
  shared/                      <-- UNCHANGED
```

The existing `pnpm-workspace.yaml` already covers `packages/*`, so `packages/electron` is auto-discovered. No workspace config changes needed.

### packages/electron/package.json

```json
{
  "name": "@cowboy/electron",
  "private": true,
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview"
  },
  "dependencies": {
    "@cowboy/shared": "workspace:*"
  },
  "devDependencies": {
    "electron": "^40.0.0",
    "electron-vite": "^5.0.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "@tailwindcss/vite": "^4.2.0",
    "tailwindcss": "^4.2.0",
    "daisyui": "^5.5.0",
    "vite": "^6.0.0",
    "vue": "^3.5.0"
  }
}
```

Note: The renderer section of electron-vite needs Vue/Tailwind/DaisyUI plugins to build the frontend. These are listed as devDependencies even though the frontend package already has them -- electron-vite resolves plugins from the package where `electron.vite.config.ts` lives.

### Root package.json Script Addition

```json
{
  "scripts": {
    "dev:electron": "pnpm --filter @cowboy/electron dev",
    "dev": "... (existing, unchanged)"
  }
}
```

## Architecture: Backend as Child Process

### Use child_process.fork(), NOT utilityProcess

Despite Electron docs recommending `utilityProcess` for new code, **use `child_process.fork()` for the Fastify backend** because:

1. **Native module compatibility**: `better-sqlite3` is a native Node addon compiled against the system Node headers. `utilityProcess` runs inside Chromium's service process with Electron's bundled Node -- native modules need to be rebuilt with `electron-rebuild` to work there. With `fork()` + `ELECTRON_RUN_AS_NODE=1`, the child runs as plain Node.js using the system's native module binaries. Zero rebuild needed.

2. **Existing code runs unchanged**: The backend's `src/index.ts` calls `buildApp()` then `app.listen({ port: 3000 })`. Fork it as-is. No API changes, no Electron-specific adaptations.

3. **Built-in IPC**: `child_process.fork()` provides a free IPC channel (`process.send()` / `child.on('message')`) for health checks and graceful shutdown signals.

4. **Process isolation**: If the backend crashes, the Electron main process and window survive. Restart the fork.

### Critical: Why This Avoids electron-rebuild

Because the backend runs as a forked child process with `ELECTRON_RUN_AS_NODE=1`, it uses the **system's Node.js**, not Electron's bundled Node. This means:

- `better-sqlite3` works with its existing native compilation (compiled for system Node)
- No `electron-rebuild` or `@electron/rebuild` step required
- No `postinstall` script to rebuild native modules
- No need to match Electron's Node ABI version

This is a major simplification. If the backend ran inside Electron's main process or utilityProcess, you would need to rebuild `better-sqlite3` against Electron's Node headers on every install.

### Main Process Entry Pattern

```typescript
// packages/electron/src/main.ts
import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import { fork, ChildProcess } from 'child_process';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let backendProcess: ChildProcess | null = null;

function startBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const backendEntry = path.resolve(__dirname, '../../backend/src/index.ts');
    backendProcess = fork(backendEntry, [], {
      execPath: 'node',  // Use system Node, not Electron
      execArgv: ['--import', 'tsx'],  // tsx for TypeScript in dev
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    // Poll until backend is ready
    const check = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3000/api/conversations');
        if (res.ok) { clearInterval(check); resolve(); }
      } catch { /* not ready yet */ }
    }, 200);

    setTimeout(() => { clearInterval(check); reject(new Error('Backend start timeout')); }, 10000);
    backendProcess.on('error', (err) => { clearInterval(check); reject(err); });
  });
}
```

### BrowserWindow Configuration

```typescript
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    titleBarStyle: 'hiddenInset',      // Native macOS traffic lights
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Dev: Vite dev server; Prod: built files
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Close-to-tray: hide window instead of quitting
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}
```

### Tray + Close-to-Tray Pattern

```typescript
function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../resources/icon.png')
  );
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Cowboy', click: () => { mainWindow?.show(); app.dock?.show(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => { mainWindow?.show(); app.dock?.show(); });
}
```

### Graceful Shutdown

```typescript
app.on('before-quit', () => {
  app.isQuitting = true;
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGTERM');
  }
});

// Ensure cleanup on unexpected exit
process.on('exit', () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGKILL');
  }
});
```

### Preload Script (Minimal)

```typescript
// packages/electron/src/preload.ts
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
});
```

The preload is intentionally minimal. The frontend communicates with the backend via HTTP/WebSocket (existing pattern). No IPC bridge needed for data flow. The only exposed value is `platform` for conditional UI (e.g., traffic light padding).

## electron.vite.config.ts

```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: './src/main.ts' },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: './src/preload.ts' },
      },
    },
  },
  renderer: {
    root: '../frontend',
    plugins: [vue(), tailwindcss()],
    build: {
      outDir: '../electron/out/renderer',
      rollupOptions: {
        input: '../frontend/index.html',
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  },
});
```

Key design: The renderer `root` points at `../frontend` so electron-vite builds the existing frontend code directly. No duplication, no symlinks needed. The frontend's own `vite.config.ts` remains untouched and is still used by `pnpm dev` for browser-based development.

## Dev Workflow

`electron-vite dev` handles:
1. Compiles and starts the main process
2. Starts a Vite dev server for the renderer (frontend)
3. Opens the Electron window pointing at the dev server
4. HMR for renderer, hot restart for main process changes

The main process `startBackend()` forks the Fastify backend. In dev mode, it uses `tsx` to run TypeScript directly. The proxy config in the renderer ensures `/api` calls reach the Fastify server.

**Two dev modes preserved:**
- `pnpm dev` -- browser-based development (existing, unchanged)
- `pnpm dev:electron` -- Electron desktop development (new)

## Installation

```bash
# Create the new electron package
mkdir -p packages/electron/src packages/electron/resources

# Install in the electron package
cd packages/electron
pnpm add -D electron@^40.0.0 electron-vite@^5.0.0 @vitejs/plugin-vue@^5.0.0 @tailwindcss/vite@^4.2.0 tailwindcss@^4.2.0 daisyui@^5.5.0 vite@^6.0.0 vue@^3.5.0

# No changes to packages/backend or packages/frontend
```

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| electron-store | Key-value persistence library | Already have SQLite + Drizzle for all storage |
| electron-updater | Auto-update mechanism | Personal use; `git pull` is the updater |
| electron-log | Logging framework | `console.log` in main process; backend has its own logging |
| @electron/remote | Deprecated remote module access | IPC via contextBridge (but barely needed -- HTTP/WS handles data flow) |
| electron-reload | Hot reload for dev | electron-vite provides HMR and hot restart built-in |
| electron-is-dev | Detect dev vs production | `process.env.NODE_ENV` or `!app.isPackaged` |
| @electron/rebuild | Rebuild native modules for Electron | Not needed -- backend runs as forked child process with system Node |
| electron-forge | Full build pipeline with makers/publishers | Overkill for personal-use app; electron-vite handles build, no packaging needed |
| electron-builder | Packaging into .app/.dmg | Out of scope per PROJECT.md ("run from source") |
| electron-devtools-installer | Install React/Vue devtools in Electron | Can use `BrowserWindow.webContents.openDevTools()` directly; Vue DevTools can be loaded manually if needed |

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| electron-vite | vite-plugin-electron | vite-plugin-electron is pre-1.0 (v0.29.0), last published ~1 year ago. Modifies existing vite.config.ts. electron-vite keeps configs separate. |
| electron-vite | Electron Forge + Vite plugin | Forge is a full pipeline (init/package/make/publish). We only need dev + build. Massive config overhead for no benefit. |
| child_process.fork() | utilityProcess | utilityProcess runs in Chromium service context -- native modules (better-sqlite3) need electron-rebuild. fork() with ELECTRON_RUN_AS_NODE=1 uses system Node, avoiding rebuild entirely. |
| child_process.fork() | Run backend in main process | Blocks main process during heavy ingestion. Process isolation means backend crashes do not kill the window. |
| Separate packages/electron | Electron files in root | Breaks monorepo pattern. Root package.json becomes cluttered. Harder to manage dev dependencies separately. |
| titleBarStyle: 'hiddenInset' | Default title bar | 'hiddenInset' gives native macOS traffic lights integrated into the window content area for a modern look. |
| HTTP/WS for data flow | Electron IPC for data flow | Frontend already communicates with backend via fetch() + WebSocket. Rewriting to use IPC would be a massive, pointless refactor. Keep the existing architecture. |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| electron@40 | Chromium 144, Node 24.11.1, V8 14.4 | Node 24 in main process; system Node for forked backend |
| electron-vite@5 | Vite 6.x, Electron 28+ | Matches project's existing Vite 6 |
| better-sqlite3@12.6 | System Node (22.x or 24.x) | Runs in forked child process, NOT in Electron's bundled Node |
| Vue 3.5+ | Chromium 144 (Electron 40) | Full modern browser support guaranteed |
| Tailwind 4.2 + DaisyUI 5.5 | electron-vite renderer | Built by Vite as usual; no Electron-specific concerns |

## Sources

- [Electron 40.0.0 Release](https://www.electronjs.org/blog/electron-40-0) -- Chromium 144, Node 24.11.1 (HIGH confidence)
- [Electron Releases](https://releases.electronjs.org/) -- v40.8.0 current stable (HIGH confidence)
- [Electron utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process) -- fork equivalent using Chromium services (HIGH confidence)
- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model) -- main/renderer/utility architecture (HIGH confidence)
- [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window) -- titleBarStyle, trafficLightPosition (HIGH confidence)
- [electron-vite Getting Started](https://electron-vite.org/guide/) -- v5.0.0, unified config structure (HIGH confidence)
- [electron-vite 5.0 Release Blog](https://electron-vite.org/blog/) -- version confirmation (HIGH confidence)
- [vite-plugin-electron GitHub](https://github.com/electron-vite/vite-plugin-electron) -- v0.29.0 pre-1.0 status (HIGH confidence)
- [Electron Forge - Why Electron Forge](https://www.electronforge.io/core-concepts/why-electron-forge) -- Forge vs Builder philosophy (MEDIUM confidence)
- [npm trends: electron-builder vs electron-forge](https://npmtrends.com/electron-vs-electron-builder-vs-electron-forge) -- download stats (MEDIUM confidence)
- [Electron Timelines](https://www.electronjs.org/docs/latest/tutorial/electron-timelines) -- release schedule, EOL dates (HIGH confidence)
- [Electron child_process patterns](https://gist.github.com/maximilian-lindsey/a446a7ee87838a62099d) -- Express in forked child process (MEDIUM confidence)

---
*Stack research for: Cowboy v3.0 Electron Desktop Wrapper*
*Researched: 2026-03-11*
