# Changelog

## v3.5.1

- Sort tray panel conversations by last updated time instead of creation time
- Fix text overflow for long unbroken strings (long URLs, repeated characters) in tray conversation list

## v3.5.0

- Add system tray panel: left-click cowboy icon to see current conversation with tabbed multi-conversation support
- Fix auto-scroll losing bottom during rapid streaming — intent-based tracking only scrolls when user is at bottom
- Fix timeline panel overlapping conversation content on narrow viewports with dynamic width adjustment

## v3.4.2

- Move orphaned skill definition system messages inline next to the skill tool call that used them
- Fix scroll tracker late-binding ref — auto-scroll, scroll position preservation, and new messages pill now work correctly

## v3.4.1

- Make timeline sidebar panel width responsive to container (clamps 180-260px based on available space)

## v3.4.0

- Remove Agents nav item, page, route, command palette entry, and composable (redundant with Overview)
- Show subagent entries in conversation timeline with clickable expand-and-scroll
- Use command args as conversation title (pass 0 in title derivation)
- Move title to first column in overview and browser tables
- Hide agent and project columns for subagent rows
- Add active conversations widget to overview, remove tips, make chart taller
- Hide image-only entries from conversation timeline
- Move tool call cost/token info to right side of each row
- Fix conversation detail badges: remove skill pill, reorder project first, align icons, fix export
- Fix scroll-margin-top for tool call elements under sticky header
- Fix title persistence on re-ingestion (only set when existing title is NULL)
- Native save dialog for exports, fix icon alignment, fix UTF-8 truncation panic
- Animated token decimals, thinner chart lines, 20s polling, timeline polish
- Fix theme toggle hover background
- Center timeline panel and align top with title card
- Improve usage chart visibility with theme-aware colors in dark/light modes

## v3.3.0

- Convert token rate chart into always-visible card pinned at bottom of nav sidebar
- Include token usage speed (input/output per min) in the nav card
- Remove "Show live usage" toggle from navigation
- Show skill name in tool call title (e.g., "Skill: clara-knowledge") and display only args
- Fix "unknown" status badges on tool calls — properly detect success/pending/error
- Center timeline connector line and align timeline panel top with title card

## v3.2.2

- Add rounded corners and right margin to timeline panel for floating card appearance
- Fix white connector line in timeline on light theme

## v3.2.1

- Animate new messages with smooth slide-up TransitionGroup instead of abrupt shift
- Fix timeline to be full-height with scroll position indicator
- Fix light theme markdown legibility by removing no-op :deep() selectors from global CSS
- Fix timeline connector line artifact in light mode

## v3.2.0

- Remove Plans feature from navigation, router, command palette, and all frontend code
- Auto-expand last tool call in assistant group when no text follows it
- Colorize markdown content: headings, bold, inline code, links, and list markers get distinct colors
- Reduce markdown font size and tighten spacing for better density

## v3.1.14

- Fix markdown rendering in conversation view (lists, tables, headings, blockquotes, HR all broken)
- Remove invalid `:deep()` pseudo-class from unscoped CSS — Tailwind v4 preflight resets were winning
- Improve table styling with full width, header backgrounds, and alternating row colors
- Add nested list style variants (circle, square)
- Auto-expand last assistant group when new groups arrive during streaming

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
