# Cowboy

A desktop app for monitoring and analyzing AI coding agent conversations. Track token usage, costs, and conversation patterns across Claude Code and Cursor.

Built with [Tauri](https://tauri.app/) + [Vue 3](https://vuejs.org/) + [Chart.js](https://www.chartjs.org/).

## Install

### Homebrew

```bash
brew install --cask iamsachin/cowboy/cowboy
```

### Manual download

1. Download the `.dmg` from the [latest release](https://github.com/iamsachin/cowboy/releases/latest).
2. Open the DMG and drag **Cowboy.app** to `/Applications`.
3. Remove the macOS quarantine flag (required because the app is not notarized):

```bash
xattr -cr /Applications/Cowboy.app
```

4. Launch Cowboy from Applications.

## Prerequisites (development)

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v8+)

## Setup

```bash
# Install dependencies
pnpm install
```

## Development

```bash
# Run the app in dev mode (hot-reloads frontend + rebuilds Rust on changes)
pnpm dev
```

This runs `cargo tauri dev` which starts:
- Vite dev server for the Vue frontend on `http://localhost:5173`
- Tauri native window pointing to the dev server

## Build

```bash
# Build the production app
pnpm build
```

The bundled app will be in `src-tauri/target/release/bundle/`.

## Testing

```bash
# Run frontend tests
pnpm test

# Run Rust tests
cd src-tauri && cargo test
```

## Project Structure

```
cowboy/
├── packages/frontend/   # Vue 3 + Vite frontend
│   └── src/
│       ├── components/  # Vue components (charts, cards, viewers)
│       ├── pages/       # Route pages (Overview, Conversations, Analytics)
│       ├── composables/ # Vue composables (data fetching, grouping)
│       └── utils/       # Helpers (formatting, markdown, theming)
├── src-tauri/           # Tauri + Rust backend
│   └── src/
│       ├── ingestion/   # JSONL/DB parsing for Claude Code & Cursor
│       ├── analytics.rs # Aggregation queries
│       ├── watcher.rs   # File watcher for live updates
│       └── server.rs    # HTTP API server
└── tests/               # Integration tests
```
