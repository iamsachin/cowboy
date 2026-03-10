# Phase 34: Live Token Usage Widget - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can monitor real-time token consumption rate from any page via a floating pill widget. The pill shows current input and output tokens per minute, expands into a Chart.js line chart on click, and can be dismissed/restored. Backend provides a new token rate endpoint with per-minute aggregation.

</domain>

<decisions>
## Implementation Decisions

### Pill Display & Content
- Show input and output rates separately: "↑ 12k/min ↓ 3k/min" format
- Position: fixed bottom-right corner of viewport
- Updates driven by WebSocket events with existing 500ms debounce pattern
- When idle (zero tokens flowing): dim/ghost the pill to lower opacity — don't hide it
- Subtle pulse/glow animation when token rate spikes (heavy agent activity)
- Dismiss X icon appears only on hover — clean when not interacted with
- Rate shows tokens from the latest single minute (not smoothed average)

### Expanded Chart Behavior
- Click pill to open a popover card anchored above the pill — overlays page content
- Shows 60-minute history with per-minute data points
- Input and output as separate line series (matches existing TokenChart pattern)
- Chart updates live while expanded — new data points appear in real time
- Dismiss: click outside the popover or click the pill again (standard popover UX)

### Dismiss & Restore Flow
- Dismiss state persists in localStorage — stays dismissed across page refreshes and sessions
- Widget auto-shows on first visit (before user has ever dismissed)
- "Show live usage" restore button in sidebar, below the main navigation items
- Clicking restore button shows the pill again and clears the localStorage flag

### Token Rate Data Source
- New backend endpoint providing per-minute token aggregation
- 60-minute rolling window — returns 60 data points (one per minute)
- All agents combined — no agent filter (simpler, shows total activity)
- Frontend: extend existing useAnalytics composable with token rate fetching
- WebSocket-driven refetch using same debounce pattern as other analytics data

### Claude's Discretion
- Exact popover sizing and styling details
- Chart tooltip format and interaction
- Pulse/glow animation implementation (CSS or JS)
- Token rate endpoint route naming and response shape
- How to calculate "current minute" boundary in the SQL query
- Error/loading states for the chart popover

</decisions>

<specifics>
## Specific Ideas

- Pill should match DaisyUI night theme — subtle, not distracting
- Reuse NewMessagesPill.vue floating pattern (fixed position, z-50, transition animations)
- Chart should follow existing chart-theme.ts color conventions
- STATE.md flags "Chart.js lifecycle with dismiss/restore toggling needs v-show + destroy guard pattern" — research should address this

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NewMessagesPill.vue`: Floating pill pattern with fixed positioning, z-50, pill-fade transition — reuse for widget pill
- `TokenChart.vue`: Line chart with input/output/cache series using vue-chartjs — reuse chart setup pattern
- `chart-theme.ts`: CSS custom property-based chart colors — use for consistent theming
- `format-tokens.ts`: `formatTokenCount()` for compact number display (12k, 1.5M) — use in pill
- `useAnalytics.ts`: Singleton composable with debounced WS refetch — extend with token rate data
- `useWebSocket.ts`: Typed `on()` pattern with auto-cleanup — consume for live updates

### Established Patterns
- Singleton composable pattern (module-level state) — useAnalytics follows this
- Notify-then-fetch (WebSocket notifies, HTTP serves data) — maintain
- 500ms debounce for WS-triggered refetches — reuse
- Chart.js registration: register needed scales/elements, use vue-chartjs `Line` component
- `animation: false` on chart options for update performance
- localStorage for UI state persistence (sidebar collapse already uses this)

### Integration Points
- `AppSidebar.vue`: Add "Show live usage" button below navigation items
- `useAnalytics.ts`: Add token rate fetching and state
- `packages/backend/src/routes/analytics.ts`: Add new token rate endpoint
- `packages/backend/src/db/queries/analytics.ts`: Add per-minute aggregation query
- `packages/shared/src/types/api.ts`: Add TokenRatePoint type
- App root layout: Mount the floating pill widget (visible on all pages)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-live-token-usage-widget*
*Context gathered: 2026-03-10*
