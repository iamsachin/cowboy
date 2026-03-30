# Changelog

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
