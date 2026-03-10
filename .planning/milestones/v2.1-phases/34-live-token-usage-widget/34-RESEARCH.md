# Phase 34: Live Token Usage Widget - Research

**Researched:** 2026-03-10
**Domain:** Vue 3 floating widget, Chart.js live charting, Fastify REST endpoint, SQLite per-minute aggregation
**Confidence:** HIGH

## Summary

This phase adds a floating pill widget showing real-time token consumption rates (input/output tokens per minute), an expandable Chart.js line chart popover showing 60-minute history, dismiss/restore persistence via localStorage, and a backend endpoint providing per-minute token aggregation. All building blocks already exist in the codebase: the NewMessagesPill pattern for floating fixed-position elements, TokenChart for vue-chartjs Line charts with input/output series, useAnalytics for WebSocket-driven data fetching, and the analytics query layer for SQL aggregation.

The primary challenge is the Chart.js lifecycle management when the widget is dismissed and restored. Quick Task 11 established that `v-show` keeps Chart.js canvases mounted to avoid remount flash. For the widget, the chart lives inside an expandable popover that toggles visibility -- the same `v-show` pattern should be used. The dismiss/restore flow uses localStorage (already precedented by sidebar collapse state).

**Primary recommendation:** Build a single `LiveTokenWidget.vue` component mounted in DashboardLayout (alongside AppSidebar), backed by a `useTokenRate` composable that extends the existing WS-driven refetch pattern, and a new `/api/analytics/token-rate` backend endpoint with per-minute SQL aggregation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Pill display: "up-arrow 12k/min down-arrow 3k/min" format, fixed bottom-right, z-50
- Updates driven by WebSocket events with existing 500ms debounce pattern
- When idle (zero tokens): dim/ghost the pill to lower opacity -- don't hide it
- Subtle pulse/glow animation when token rate spikes
- Dismiss X icon appears only on hover
- Rate shows tokens from the latest single minute (not smoothed average)
- Click pill opens popover card anchored above the pill -- overlays page content
- 60-minute history with per-minute data points
- Input and output as separate line series
- Chart updates live while expanded
- Dismiss: click outside the popover or click the pill again
- Dismiss state persists in localStorage
- Widget auto-shows on first visit
- "Show live usage" restore button in sidebar, below main navigation items
- New backend endpoint providing per-minute token aggregation
- 60-minute rolling window -- returns 60 data points
- All agents combined -- no agent filter
- Extend existing useAnalytics composable with token rate fetching
- WebSocket-driven refetch using same debounce pattern

### Claude's Discretion
- Exact popover sizing and styling details
- Chart tooltip format and interaction
- Pulse/glow animation implementation (CSS or JS)
- Token rate endpoint route naming and response shape
- How to calculate "current minute" boundary in the SQL query
- Error/loading states for the chart popover

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WIDG-01 | User sees a floating dismissable pill showing current input and output tokens per minute | NewMessagesPill.vue pattern (fixed, z-50, Transition), formatTokenCount utility, localStorage dismiss state |
| WIDG-02 | User can click the pill to expand a larger Chart.js line chart showing token rate over time | TokenChart.vue pattern (vue-chartjs Line, chart-theme.ts), v-show for lifecycle, popover anchoring |
| WIDG-03 | User can dismiss the widget and restore it via a "Show live usage" button in the sidebar | localStorage persistence pattern (sidebar collapse precedent), AppSidebar.vue integration point |
| WIDG-04 | Backend provides a token rate endpoint aggregating recent token usage by minute | Analytics route pattern, SQLite strftime per-minute grouping, token_usage table with created_at timestamps |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue | ^3.5.0 | Reactivity, components, composables | Project framework |
| vue-chartjs | ^5.3.3 | Vue wrapper for Chart.js Line component | Already used by all charts |
| chart.js | ^4.5.1 | Canvas-based charting | Already registered and configured |
| fastify | (project ver) | Backend HTTP routes | Project backend framework |
| drizzle-orm | (project ver) | SQL query builder | Project ORM |
| lucide-vue-next | (project ver) | Icons (X, Activity, ChevronUp) | Project icon library |
| daisyui | ^5.5.0 | Tailwind component classes | Project UI framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @cowboy/shared | monorepo | Shared types (TokenRatePoint) | Type definition for API response |

### Alternatives Considered
None -- all libraries are already in the project. No new dependencies needed.

## Architecture Patterns

### Recommended Project Structure
```
packages/frontend/src/
  components/
    LiveTokenPill.vue          # Floating pill + popover container
    LiveTokenChart.vue         # Chart.js Line chart for token rate history
  composables/
    useTokenRate.ts            # Token rate data fetching + WS refetch
packages/backend/src/
  routes/analytics.ts          # Add token-rate endpoint
  db/queries/analytics.ts      # Add getTokenRate query
packages/shared/src/
  types/api.ts                 # Add TokenRatePoint type
```

### Pattern 1: Singleton Composable with WS-Driven Refetch
**What:** Module-level state outside the exported function, WebSocket `on()` triggers debounced HTTP fetch.
**When to use:** Token rate data must be shared across components (pill reads current minute, chart reads array).
**Example:**
```typescript
// useTokenRate.ts -- follows useAnalytics pattern exactly
import { ref, onScopeDispose } from 'vue';
import type { TokenRatePoint } from '@cowboy/shared';
import { useWebSocket } from './useWebSocket';

const tokenRate = ref<TokenRatePoint[]>([]);
const loading = ref(false);

async function fetchTokenRate(): Promise<void> {
  const res = await fetch('/api/analytics/token-rate');
  if (!res.ok) throw new Error(`Token rate fetch failed: ${res.status}`);
  tokenRate.value = await res.json();
}

// Debounced WS refetch -- identical to useAnalytics pattern
let wsTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedRefetch(): void {
  if (wsTimer) clearTimeout(wsTimer);
  wsTimer = setTimeout(() => {
    wsTimer = null;
    fetchTokenRate();
  }, 500);
}

export function useTokenRate() {
  const { on } = useWebSocket();
  on('conversation:changed', debouncedRefetch);
  on('conversation:created', debouncedRefetch);
  on('system:full-refresh', debouncedRefetch);

  // Initial fetch on first use
  if (tokenRate.value.length === 0 && !loading.value) {
    loading.value = true;
    fetchTokenRate().finally(() => { loading.value = false; });
  }

  onScopeDispose(() => {
    if (wsTimer) { clearTimeout(wsTimer); wsTimer = null; }
  });

  return { tokenRate, loading, fetchTokenRate };
}
```

### Pattern 2: v-show for Chart.js Lifecycle (Critical)
**What:** Use `v-show` (not `v-if`) for chart visibility to keep Chart.js canvas mounted.
**When to use:** Always with vue-chartjs components. Established by Quick Task 11.
**Why critical:** Chart.js creates a canvas context on mount. `v-if` would destroy/recreate the canvas on every toggle, causing flash and memory leaks. `v-show` keeps the canvas in DOM, and vue-chartjs handles in-place data diffing via `setDatasets/setLabels + chart.update()`.
**For the widget:** The popover containing the chart should use `v-show` for the chart itself. The popover container can use `v-if` with Transition for enter/leave animation, but the Line component inside must use `v-show` or always be rendered.

### Pattern 3: Fixed-Position Floating Element
**What:** Viewport-anchored element using `fixed` positioning with `z-50`.
**When to use:** The pill and its popover.
**Example from NewMessagesPill.vue:**
```html
<button class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 btn btn-sm btn-primary">
```
**For widget pill:** `fixed bottom-6 right-6 z-50` (bottom-right corner per decisions).

### Pattern 4: localStorage UI State Persistence
**What:** Persist boolean UI state to localStorage, read on mount.
**Precedent:** `sidebar-collapsed` in AppSidebar.vue, `sidebar-hidden` in DashboardLayout.vue.
**For widget:** Key `token-widget-dismissed`, read as `localStorage.getItem('token-widget-dismissed') === 'true'`.

### Pattern 5: Popover Anchored Above Pill
**What:** A card element positioned absolutely or fixed above the pill, dismissed on outside click or pill re-click.
**Implementation:** Use a wrapping div with the pill at the bottom and the popover above it. Use `@click.stop` on the popover to prevent click-through. Add a click-outside handler (document-level click listener). The chart popover should be a DaisyUI card with `bg-base-200 rounded-box shadow-xl`.

### Anti-Patterns to Avoid
- **v-if on Chart.js components:** Causes canvas destroy/recreate flash. Always use v-show for the chart itself.
- **Fetching token rate inside useAnalytics:** Would couple widget lifecycle to dashboard page. Keep as separate composable `useTokenRate` so the widget works on all pages independently.
- **Polling instead of WS-driven refetch:** The project uses notify-then-fetch. Don't add setInterval polling.
- **Separate WebSocket event type for token rate:** Unnecessary -- conversation:changed already fires when new tokens are ingested, triggering the token rate refetch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token count formatting | Custom formatter | `formatTokenCount()` from `format-tokens.ts` | Already handles k/M formatting with trailing-zero drop |
| Chart theme colors | Hardcoded RGBA | `getChartThemeColors()` from `chart-theme.ts` | CSS custom property based, adapts to theme |
| Chart.js registration | Per-component registration | Follow TokenChart.vue pattern exactly | CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend |
| WS event cleanup | Manual removeEventListener | `on()` from `useWebSocket` | Auto-cleans via `onScopeDispose` |
| Click outside detection | Custom directive | Simple document.addEventListener('click') with `@click.stop` on popover | Minimal, matches project style (no directive library) |

## Common Pitfalls

### Pitfall 1: Chart.js Destroy on Dismiss/Restore
**What goes wrong:** Using `v-if` on the chart component causes Chart.js canvas to be destroyed when widget is dismissed, then recreated when restored -- causing flash and potential memory leak.
**Why it happens:** Vue removes the DOM node, Chart.js destroys its internal state, and vue-chartjs must rebuild everything on re-mount.
**How to avoid:** Use `v-show` for the chart container. The chart stays mounted but hidden when dismissed or popover is closed.
**Warning signs:** Brief white flash when expanding the popover, or "Canvas is already in use" errors.
**STATE.md flag:** "Chart.js lifecycle with dismiss/restore toggling needs v-show + destroy guard pattern" -- resolved by Quick Task 11's v-show pattern.

### Pitfall 2: Minute Boundary Edge Cases in SQL
**What goes wrong:** Using `strftime('%Y-%m-%d %H:%M', ...)` directly may produce unexpected results with timezone handling in SQLite.
**Why it happens:** SQLite stores timestamps as text strings (ISO 8601). If timestamps include timezone offsets, strftime may not group correctly.
**How to avoid:** The project stores all timestamps as ISO 8601 UTC strings (e.g., `2026-03-10T14:23:45.123Z`). Use `strftime('%Y-%m-%d %H:%M', created_at)` which works correctly with ISO 8601 UTC strings in SQLite. The "current minute" is simply `datetime('now', '-60 minutes')` as the rolling window start.
**Warning signs:** Missing data points, duplicate minutes, or off-by-one hour errors.

### Pitfall 3: Widget Mounted Before WebSocket Connected
**What goes wrong:** Widget mounts, calls fetchTokenRate immediately, but the WebSocket hasn't connected yet so WS-driven updates don't arrive.
**Why it happens:** The widget is mounted in DashboardLayout which renders immediately.
**How to avoid:** Not actually a problem -- the initial fetch is HTTP (not WS-dependent), and `useWebSocket` connects lazily on first `useWebSocket()` call. The `on()` listeners queue up and fire once connected. The widget just needs its initial HTTP fetch plus WS-driven subsequent fetches.

### Pitfall 4: Popover Positioning Off-Screen
**What goes wrong:** The chart popover (positioned above the pill at bottom-right) could overflow the viewport top on small screens.
**How to avoid:** Set a `max-h` on the popover and ensure it doesn't go above the viewport. Since the pill is at `bottom-6`, and a reasonable chart height is ~300px, this is unlikely to be an issue on desktop. Add `overflow-hidden` and constrain height.

### Pitfall 5: Multiple Composable Instances Creating Duplicate Listeners
**What goes wrong:** If `useTokenRate` is called from both the pill component and sidebar, duplicate WS listeners fire duplicate fetches.
**How to avoid:** Use the module-level singleton pattern (same as `useWebSocket`). The WS listeners and debounce timer should be at module scope, only registered once. Guard with a `let started = false` flag.

## Code Examples

### TokenRatePoint Type (shared)
```typescript
// packages/shared/src/types/api.ts
export interface TokenRatePoint {
  minute: string;        // ISO minute string: "2026-03-10T14:23"
  inputTokens: number;
  outputTokens: number;
}
```

### Token Rate SQL Query
```typescript
// packages/backend/src/db/queries/analytics.ts
export function getTokenRate(): TokenRatePoint[] {
  const rows = db
    .select({
      minute: sql<string>`strftime('%Y-%m-%dT%H:%M', ${tokenUsage.createdAt})`.as('minute'),
      inputTokens: sql<number>`coalesce(sum(${tokenUsage.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${tokenUsage.outputTokens}), 0)`,
    })
    .from(tokenUsage)
    .where(gte(tokenUsage.createdAt, sql`datetime('now', '-60 minutes')`))
    .groupBy(sql`minute`)
    .orderBy(sql`minute`)
    .all();

  return rows.map(r => ({
    minute: r.minute,
    inputTokens: Number(r.inputTokens),
    outputTokens: Number(r.outputTokens),
  }));
}
```

### Token Rate Route
```typescript
// In analytics.ts routes
app.get('/analytics/token-rate', async () => {
  return getTokenRate();
});
```

### Pill Component Structure
```vue
<!-- LiveTokenPill.vue -->
<template>
  <div v-if="!dismissed" class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
    <!-- Popover Chart Card (above pill) -->
    <Transition name="popover-fade">
      <div
        v-if="expanded"
        class="card bg-base-200 rounded-box shadow-xl w-96"
        @click.stop
      >
        <div class="card-body p-4">
          <h3 class="card-title text-sm">Token Rate (60 min)</h3>
          <div class="h-48">
            <Line :data="chartData" :options="chartOptions" />
          </div>
        </div>
      </div>
    </Transition>

    <!-- Pill Button -->
    <button
      class="btn btn-sm gap-2 shadow-lg group"
      :class="[isIdle ? 'opacity-50' : '', isSpike ? 'animate-pulse' : '']"
      @click="expanded = !expanded"
    >
      <span>↑ {{ formatTokenCount(currentInput) }}/min</span>
      <span>↓ {{ formatTokenCount(currentOutput) }}/min</span>
      <X
        class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
        @click.stop="dismiss"
      />
    </button>
  </div>
</template>
```

### Sidebar Restore Button
```vue
<!-- In AppSidebar.vue, below the nav items ul -->
<button
  v-if="widgetDismissed && !collapsed"
  class="btn btn-ghost btn-sm gap-2 mx-2 mt-1"
  @click="restoreWidget"
>
  <Activity class="w-4 h-4" />
  <span>Show live usage</span>
</button>
```

### Pulse/Glow Animation (CSS)
```css
/* Subtle pulse when token rate spikes */
@keyframes token-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4); }
  50% { box-shadow: 0 0 8px 4px rgba(56, 189, 248, 0.2); }
}
.animate-token-pulse {
  animation: token-pulse 2s ease-in-out infinite;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v-if/v-else on charts | v-show for all chart states | Quick Task 11 (2026-03-08) | Prevents canvas flash on data updates |
| Full page spinner on WS refetch | Separate loading/refreshing refs | Phase 32-01 (2026-03-10) | WS-driven updates don't flash spinners |

**Deprecated/outdated:**
- None relevant to this phase.

## Open Questions

1. **Spike Detection Threshold**
   - What we know: User wants pulse/glow when token rate "spikes" (heavy agent activity)
   - What's unclear: What constitutes a "spike" -- absolute threshold or relative to recent history?
   - Recommendation: Use a simple heuristic -- if current minute exceeds 2x the average of the previous 5 minutes, trigger pulse. This is Claude's discretion per CONTEXT.md.

2. **Empty Minutes in 60-Minute Window**
   - What we know: SQL only returns minutes with actual token usage -- gaps will exist
   - What's unclear: Should frontend fill gaps with zero-value points for smooth chart display?
   - Recommendation: Frontend should generate all 60 minute slots and fill missing ones with zeros. This gives a complete timeline on the chart.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 |
| Config file | Per-package package.json scripts |
| Quick run command | `cd packages/backend && npx vitest run tests/analytics/ --reporter=verbose` |
| Full suite command | `npx vitest run` (root) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIDG-04 | Token rate endpoint returns per-minute aggregation | unit | `cd packages/backend && npx vitest run tests/analytics/token-rate.test.ts -x` | No - Wave 0 |
| WIDG-01 | Pill displays formatted token rates | manual-only | Visual verification | N/A |
| WIDG-02 | Chart popover shows 60-min history | manual-only | Visual verification | N/A |
| WIDG-03 | Dismiss/restore persists across refresh | manual-only | Visual verification + localStorage check | N/A |

### Sampling Rate
- **Per task commit:** `cd packages/backend && npx vitest run tests/analytics/ --reporter=verbose`
- **Per wave merge:** `npx vitest run` (root)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/backend/tests/analytics/token-rate.test.ts` -- covers WIDG-04 (per-minute aggregation, empty window, rolling window boundary)
- [ ] Shared type export for `TokenRatePoint` in shared index

## Sources

### Primary (HIGH confidence)
- Project codebase: `packages/frontend/src/components/TokenChart.vue` -- existing Chart.js line chart pattern
- Project codebase: `packages/frontend/src/components/NewMessagesPill.vue` -- floating pill pattern
- Project codebase: `packages/frontend/src/composables/useAnalytics.ts` -- WS-driven refetch pattern
- Project codebase: `packages/backend/src/db/queries/analytics.ts` -- SQL aggregation patterns
- Project codebase: Quick Task 11 summary -- v-show pattern for Chart.js lifecycle
- Project codebase: `packages/frontend/src/layouts/DashboardLayout.vue` -- widget mount point
- Project codebase: `packages/frontend/src/components/AppSidebar.vue` -- sidebar integration point

### Secondary (MEDIUM confidence)
- Chart.js v4 docs: `animation: false` for performance on live-updating charts
- SQLite docs: `strftime` function with ISO 8601 timestamp parsing

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - every pattern has direct precedent in existing codebase
- Pitfalls: HIGH - Chart.js lifecycle issue specifically flagged in STATE.md and resolved in Quick Task 11

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no external dependencies)
