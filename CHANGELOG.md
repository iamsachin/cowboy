# Changelog

## v3.1.13

- Emit WebSocket events per-file instead of batching until ingestion completes
- Selective analytics fetch: conversation:changed only refetches overview stats (~67% fewer API calls)
- Reduce conversation detail debounce from 500ms to 150ms for faster live updates
- Incremental JSONL parsing via byte offset tracking (O(new) vs O(all))
- Decouple stale conversation marking to 60s periodic timer
- Net best-case latency improvement from ~1.5s to ~1.15s

## v3.1.12

- Add macOS code signing with hardened runtime to release process
- Add Apple notarization and ticket stapling for DMG releases
- Add signing environment variable validation to release script
- Document required signing/notarization environment variables in release skill
- Add security rules to prevent committing sensitive credentials

## v3.1.11

- Derive conversation titles from slash command arguments instead of raw skill text
- Highlight slash command names in chat messages
- Make title derivation /clear-aware (use first user message after last /clear)
- Strip image file paths and `[Image #N]` references from conversation titles
- Add animated number transitions to KPI cards on overview page
- Hide model badge for synthetic and unknown marker strings
- Hide last message preview when assistant group card is expanded
- Fix content centering when timeline sidebar is open
- Add dynamic right margin to prevent timeline sidebar overlap
- Use round legend indicators in chart tooltips

## v3.1.10

- Fix token rate speed display to show current minute value instead of stale data
- Make chart legend indicators rounded (circles) instead of squares across all charts

## v3.1.9

- Move skill indicator pill into metadata row (alongside Agent, Model, Project)
- Fix timeline sidebar compressing main content width — now overlays instead
- Fix activity heatmap tooltip clipped by card overflow

## v3.1.8

- Fix activity heatmap colors invisible/broken on both dark (forest) and light (emerald) themes
- Replace broken DaisyUI v4 CSS variable references with explicit theme-aware color definitions

## v3.1.7

- Fix conversation titles showing raw skill definition text when conversation starts with a skill invocation
- Add skill invocation badge (with skill name) to conversation detail header

## v3.1.6

- Switch to native macOS title bar for reliable window dragging
- Remove custom overlay drag region and reduce top padding on all pages

## v3.1.5

- Fix window dragging: add missing `core:window:allow-start-dragging` Tauri capability permission

## v3.1.4

- Fix "Refresh All Data" not re-ingesting files (ingestion cache wasn't cleared)
- Fix "Clear All Data" not clearing ingestion cache, causing subsequent refreshes to skip all files

## v3.1.3

- Add progress bar and error display for "Refresh All Data" on Settings page
- Show file ingestion progress with real-time count updates
- Display error alerts when data refresh fails
- Fix window drag z-index conflict

## v3.1.2

- Extract plans only from Claude Code plan mode (EnterPlanMode/ExitPlanMode) instead of heuristic pattern matching
- Remove hover tooltip on live connection status indicator
- Fix token rate chart showing negative Y axis values

## v3.1.1

- Fix production bundle: app now works when launched from /Applications
- Add CORS headers for Tauri webview origin (tauri://localhost)
- Route all frontend API calls through API_BASE for production builds
- Fix TypeScript build errors (Chart.js animation types, prop types)
- Fix release script to produce .app and .dmg bundles

## v3.1.0

- Add light/dark theme toggle in sidebar
- Add top conversations widget to Overview page
- Move live token rate indicator to bottom of left nav
- Fix subagent card "Open full conversation" link navigation
- Add token breakdown popover and expandable item components
- Enhance subagent summary cards with two-level expansion
- Add release script and release skill for local builds
- Add install instructions to README (Homebrew + manual with xattr)
