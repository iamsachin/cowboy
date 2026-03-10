# Phase 33: Realtime Conversation Discovery - Research

**Researched:** 2026-03-10
**Domain:** Vue 3 reactive list updates, WebSocket-driven refetch with pagination/sort preservation
**Confidence:** HIGH

## Summary

Phase 33 makes new conversations appear automatically in two locations: the Conversations page (full browser with filters/search/sort/pagination) and the Overview page (KPI cards + conversation table). The WebSocket event infrastructure from Phase 31 already broadcasts `conversation:created` events with summary data, and the composables already subscribe to these events -- but with significant gaps in debouncing, pagination preservation, and visual feedback.

The critical finding is that two composables handle conversation lists but only one subscribes to WebSocket events. `useConversationBrowser` (used by ConversationsPage) already has `on('conversation:created', () => fetchConversations())` wired up. However, `useConversations` (used by ConversationTable on the Overview page) has NO WebSocket subscription at all -- it only refetches when `dateRange` or `agentFilter` changes. This is the primary gap for PUSH-05.

The secondary challenge is UX quality: both composables do a naive full refetch on every WebSocket event with no debouncing. During active agent sessions that create multiple subagent conversations rapidly, this will flood the API. The `useConversationBrowser` composable already has a debounced search mechanism (400ms) that can serve as a pattern for WebSocket-driven debounce. Additionally, neither composable provides visual feedback (e.g., highlight/animation) when new rows appear.

**Primary recommendation:** Add WebSocket subscription to `useConversations`, add debounced refetch to both list composables, and preserve pagination/sort/filter state during live updates. Keep the full-refetch approach -- the API already returns paginated results respecting current filters/sort, so a refetch naturally preserves these. Add subtle row highlight animation for newly appeared conversations.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PUSH-04 | New conversations automatically appear in the conversation list without page refresh | `useConversationBrowser` already subscribes to `conversation:created` -- needs debounce and row highlight for UX quality. Pagination/sort/filter state preserved because `fetchConversations()` uses current reactive state for API params |
| PUSH-05 | New conversations automatically appear in the overview dashboard without page refresh | `useConversations` (ConversationTable) has NO WebSocket subscription -- must add `on('conversation:created')` and `on('conversation:changed')`. `useAnalytics` (KPIs/charts) already subscribes to all events |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | ^3.5.0 | Component framework | Already in use; reactive refs, watch, nextTick, Transition |
| @cowboy/shared | workspace:* | Shared WebSocket event types | Already provides ConversationCreatedEvent with summary data |
| vue-router | ^4.5.0 | URL query sync for pagination | Already in use for page query param |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DaisyUI | ^5.5.0 | Table and UI styling | Already in use for table, badge, pagination components |
| Tailwind CSS | ^4.2.0 | Utility classes for highlight animation | Already in use |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Full refetch on event | Client-side insert from event summary | More complex; event summary lacks all fields (tokens, cost, model); would need a second API call anyway or accept incomplete rows |
| Debounce in each composable | Debounce in useWebSocket | Would affect ALL consumers including detail page; per-composable debounce is more appropriate since different views have different latency needs |

**No new dependencies needed.** All required functionality available with existing stack.

## Architecture Patterns

### Recommended Changes
```
packages/frontend/src/
├── composables/
│   ├── useConversations.ts       # MODIFY: add WebSocket subscription + debounce
│   ├── useConversationBrowser.ts # MODIFY: add debounced refetch for WS events
│   └── useAnalytics.ts           # MODIFY: add debounced refetch for WS events (optional)
├── components/
│   ├── ConversationTable.vue     # MODIFY: add row highlight animation for new items
│   └── ConversationBrowser.vue   # MODIFY: add row highlight animation for new items
```

### Pattern 1: Debounced WebSocket Refetch for List Composables
**What:** Wrap WebSocket-triggered refetch in a debounce to coalesce rapid events (e.g., multiple subagent conversations created in quick succession). Keep manual actions (sort, page, filter) immediate.
**When to use:** Any list composable that refetches on WebSocket events.
**Example:**
```typescript
// In useConversationBrowser.ts or useConversations.ts
const { on } = useWebSocket();
let wsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedWsRefetch(): void {
  if (wsDebounceTimer) clearTimeout(wsDebounceTimer);
  wsDebounceTimer = setTimeout(() => {
    wsDebounceTimer = null;
    fetchConversations();
  }, 500);
}

on('conversation:changed', debouncedWsRefetch);
on('conversation:created', debouncedWsRefetch);
on('system:full-refresh', debouncedWsRefetch);

onScopeDispose(() => {
  if (wsDebounceTimer) {
    clearTimeout(wsDebounceTimer);
    wsDebounceTimer = null;
  }
});
```

### Pattern 2: Pagination State Preservation on Live Refetch
**What:** When a WebSocket event triggers a refetch, the current page/sort/filter state is preserved because `fetchConversations()` reads from reactive refs (page, sortField, sortOrder, agent, project, searchQuery). The API returns the correct paginated slice respecting these parameters.
**When to use:** Always -- this is the natural behavior of the existing fetch pattern.
**Key insight:** No special code is needed to preserve pagination. The reactive refs already hold the current state, and `fetchConversations()` includes them as query params. A new conversation may shift items between pages (e.g., a new item on page 1 pushes the last item to page 2), but this is correct behavior -- the user sees the current page with current sort order, and the total count updates.

### Pattern 3: New Row Highlight Animation
**What:** Track which conversation IDs were in the previous fetch result. After a WebSocket-triggered refetch, compare with the new result. IDs present in the new result but absent from the previous result are "new" and receive a brief highlight animation.
**When to use:** Both ConversationTable and ConversationBrowser.
**Example:**
```typescript
// In composable:
const previousIds = ref<Set<string>>(new Set());
const newIds = ref<Set<string>>(new Set());

// After fetchConversations() completes:
function trackNewRows(): void {
  if (!data.value) return;
  const currentIds = new Set(data.value.rows.map(r => r.id));
  const fresh = new Set<string>();
  for (const id of currentIds) {
    if (!previousIds.value.has(id) && previousIds.value.size > 0) {
      fresh.add(id);
    }
  }
  newIds.value = fresh;
  previousIds.value = currentIds;
  // Clear highlight after animation
  if (fresh.size > 0) {
    setTimeout(() => { newIds.value = new Set(); }, 2000);
  }
}
```

```vue
<!-- In template: -->
<tr
  v-for="row in data.rows"
  :key="row.id"
  :class="{ 'row-highlight': newIds.has(row.id) }"
>
```

```css
.row-highlight {
  animation: row-enter 2s ease-out;
}

@keyframes row-enter {
  0% { background-color: oklch(0.85 0.1 142 / 0.3); }
  100% { background-color: transparent; }
}
```

### Pattern 4: Separate Loading States (Initial vs. Live Refresh)
**What:** Use separate refs for initial loading (shows spinner) and live refresh (shows subtle indicator or nothing). Prevents full-page spinner on every WebSocket-triggered refetch.
**When to use:** Both list composables.
**Example:**
```typescript
const loading = ref(false);    // Initial load
const refreshing = ref(false); // Live WS-triggered refetch

async function fetchConversations(isLive = false): Promise<void> {
  if (isLive) {
    refreshing.value = true;
  } else {
    loading.value = true;
  }
  // ... fetch ...
  loading.value = false;
  refreshing.value = false;
}
```

### Anti-Patterns to Avoid
- **Resetting page to 1 on WebSocket events:** The user may be on page 3. A live refetch must preserve their current page. Only reset page on explicit user actions (sort change, filter change, search).
- **Client-side row insertion from event summary:** The `ConversationCreatedEvent.summary` has only title/agent/project/createdAt -- it lacks tokens, cost, model, isActive, and other fields the table needs. Always do a full refetch.
- **Blocking the initial load with debounce:** Debounce should only apply to WebSocket-triggered refetches, not to the initial `watch(dateRange, ..., { immediate: true })` load.
- **Debouncing in useAnalytics for charts:** The overview KPI cards and charts already refetch via `useAnalytics` which subscribes to all three event types. Consider whether debouncing here is needed -- chart data aggregates over the date range, so a few extra refetches are less harmful than for paginated lists.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pagination preservation | Custom state save/restore | Reactive refs already passed to fetch params | The existing architecture handles this naturally |
| New row detection | Complex reconciliation | Simple Set comparison of IDs | Rows have stable UUID IDs; set diff is trivial |
| WebSocket event routing | New event system | Existing `on(type, callback)` from useWebSocket | Phase 31 already built this infrastructure |
| Row highlight animation | JavaScript animation library | CSS @keyframes animation | Pure CSS handles the brief highlight effect |

**Key insight:** Phase 33 is primarily wiring and UX polish. The heavy infrastructure (WebSocket events, typed routing, composable architecture) was built in Phase 31. The main work is adding WebSocket subscription to `useConversations`, adding debounce to both list composables, and adding visual feedback for new rows.

## Common Pitfalls

### Pitfall 1: useConversations Has No WebSocket Subscription
**What goes wrong:** The Overview page's ConversationTable never updates when new conversations arrive, even though KPI cards (via useAnalytics) do update.
**Why it happens:** `useConversations.ts` was written before Phase 31's WebSocket event system. It watches `dateRange` and `agentFilter` only, never subscribing to WebSocket events.
**How to avoid:** Add `on('conversation:created')`, `on('conversation:changed')`, and `on('system:full-refresh')` to `useConversations` with debounced refetch.
**Warning signs:** Overview KPI cards update live but the table below them does not.

### Pitfall 2: Page Reset on WebSocket Refetch
**What goes wrong:** User is on page 3 of conversations. A new conversation is created. Refetch resets page to 1, losing the user's position.
**Why it happens:** Copying the pattern from sort/filter handlers that call `page.value = 1` before fetching.
**How to avoid:** WebSocket-triggered refetches must NOT change `page.value`. Only user-initiated filter/sort/search changes reset page to 1.
**Warning signs:** User keeps getting bounced to page 1 during active agent sessions.

### Pitfall 3: API Flood During Rapid Conversation Creation
**What goes wrong:** An agent spawns 5 subagents in quick succession, each creating a new conversation. Without debounce, 5 rapid full-refetch API calls fire.
**Why it happens:** Each `conversation:created` event triggers an immediate `fetchConversations()`.
**How to avoid:** Debounce WebSocket-triggered refetches (500ms). Multiple events within the window coalesce into a single refetch.
**Warning signs:** Network tab shows rapid sequential API calls to `/api/analytics/conversations`.

### Pitfall 4: Full-Page Spinner on Live Refetch
**What goes wrong:** Every WebSocket-triggered refetch shows a full loading spinner, making the table flash/disappear.
**Why it happens:** Reusing the same `loading` ref for both initial load and live updates.
**How to avoid:** Use separate `loading` (initial) and `refreshing` (live) refs. Only show the full spinner during initial load. Live refetches can show a subtle indicator or nothing.
**Warning signs:** Table flickers/disappears every few seconds during active agent sessions.

### Pitfall 5: Highlight Animation on Initial Load
**What goes wrong:** When the page first loads, every row gets the "new" highlight animation because `previousIds` starts empty.
**Why it happens:** Set diff against empty set marks everything as new.
**How to avoid:** Only compute new IDs when `previousIds.size > 0` (i.e., after the first fetch has populated the set). The initial load should set `previousIds` without marking anything as new.
**Warning signs:** All rows briefly flash green on initial page load.

### Pitfall 6: Stale Total Count in Pagination
**What goes wrong:** Pagination shows "Showing 1-20 of 42" but after a new conversation arrives, it should show "of 43". If the refetch uses cached/stale data, the count is wrong.
**Why it happens:** Not actually a code issue -- the full refetch already returns the updated `total` from the API. This is a non-issue as long as refetch happens.
**How to avoid:** Just ensure the refetch fires (debounced). The API always returns the current total.
**Warning signs:** None if refetch works correctly.

## Code Examples

### Current useConversations (NO WebSocket -- gap for PUSH-05)
```typescript
// packages/frontend/src/composables/useConversations.ts
// Lines 78-89: Only watches dateRange and agentFilter
watch(
  [() => dateRange.value, () => agentFilter?.value],
  () => {
    if (!isInitialLoad) {
      page.value = 1;
    }
    isInitialLoad = false;
    fetchConversations();
  },
  { deep: true, immediate: true }
);
// NO on('conversation:created', ...) subscription!
```

### Current useConversationBrowser (HAS WebSocket -- but no debounce)
```typescript
// packages/frontend/src/composables/useConversationBrowser.ts
// Lines 177-180: Already subscribed but naive refetch
const { on } = useWebSocket();
on('conversation:changed', () => fetchConversations());
on('conversation:created', () => fetchConversations());
on('system:full-refresh', () => fetchConversations());
```

### Current useAnalytics (HAS WebSocket -- but no debounce)
```typescript
// packages/frontend/src/composables/useAnalytics.ts
// Lines 62-65: Same pattern
const { on } = useWebSocket();
on('conversation:changed', () => fetchAll());
on('conversation:created', () => fetchAll());
on('system:full-refresh', () => fetchAll());
```

### ConversationCreatedEvent Shape (available summary data)
```typescript
// packages/shared/src/types/websocket-events.ts
export interface ConversationCreatedEvent {
  type: 'conversation:created';
  seq: number;
  conversationId: string;
  summary: {
    title: string | null;
    agent: string;
    project: string | null;
    createdAt: string;
  };
  timestamp: string;
}
// NOTE: Summary lacks tokens, cost, model, isActive, hasCompaction -- full refetch needed
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No WS subscription in useConversations | Must add WS subscription | Phase 33 | Overview table gets live updates |
| Immediate refetch on every WS event | Debounced refetch (500ms) | Phase 33 | Prevents API flood during rapid creation |
| No visual feedback for new rows | Row highlight animation | Phase 33 | User can see which conversations are new |
| Single `loading` ref | Separate `loading` + `refreshing` | Phase 33 | No full-page spinner on live updates |

**Deprecated/outdated:**
- None -- this phase extends existing patterns rather than replacing them.

## Open Questions

1. **Debounce useAnalytics too?**
   - What we know: `useAnalytics` (overview KPIs/charts) also refetches on every WS event with no debounce. Charts re-render on each refetch.
   - What's unclear: Whether the chart re-rendering is noticeable/distracting. Quick Task #11 already fixed chart flash with v-show.
   - Recommendation: Add debounce to useAnalytics as well (same 500ms pattern) to be consistent and reduce unnecessary API calls. The v-show fix handles visual flash but doesn't prevent wasted fetches.

2. **Should new conversations be highlighted in the overview ConversationTable?**
   - What we know: The overview table uses `useConversations` + `ConversationTable.vue`. The conversations page uses `useConversationBrowser` + `ConversationBrowser.vue`. Both could benefit from row highlights.
   - What's unclear: Whether the highlight UX is in scope or optional polish.
   - Recommendation: Add highlight to both tables for consistency. The CSS animation is minimal effort and significantly improves discoverability.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (workspace config) |
| Config file | `packages/frontend/vitest.config.ts` |
| Quick run command | `cd packages/frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/frontend && npx vitest run && cd ../backend && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUSH-04a | useConversationBrowser refetches on conversation:created (debounced) | unit | `cd packages/frontend && npx vitest run tests/composables/useConversationBrowser.test.ts -x` | No - Wave 0 |
| PUSH-04b | Pagination/sort/filter preserved during WS-triggered refetch | unit | `cd packages/frontend && npx vitest run tests/composables/useConversationBrowser.test.ts -x` | No - Wave 0 |
| PUSH-05a | useConversations subscribes to WS events | unit | `cd packages/frontend && npx vitest run tests/composables/useConversations.test.ts -x` | No - Wave 0 |
| PUSH-05b | useConversations refetches on conversation:created (debounced) | unit | `cd packages/frontend && npx vitest run tests/composables/useConversations.test.ts -x` | No - Wave 0 |
| PUSH-05c | Page is NOT reset to 1 on WS-triggered refetch | unit | `cd packages/frontend && npx vitest run tests/composables/useConversations.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd packages/frontend && npx vitest run && cd ../backend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/composables/useConversationBrowser.test.ts` -- covers PUSH-04 (debounced WS refetch, pagination preservation)
- [ ] `tests/composables/useConversations.test.ts` -- covers PUSH-05 (WS subscription, debounce, page preservation)

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** -- Direct analysis of all composables and components listed in Code Examples
- `packages/frontend/src/composables/useConversations.ts` -- confirmed NO WebSocket subscription (103 lines)
- `packages/frontend/src/composables/useConversationBrowser.ts` -- confirmed HAS WebSocket subscription, no debounce (201 lines)
- `packages/frontend/src/composables/useAnalytics.ts` -- confirmed HAS WebSocket subscription, no debounce (75 lines)
- `packages/frontend/src/composables/useWebSocket.ts` -- confirmed `on()` API with auto-cleanup (161 lines)
- `packages/frontend/src/components/ConversationTable.vue` -- overview table using useConversations (228 lines)
- `packages/frontend/src/components/ConversationBrowser.vue` -- conversations page table using useConversationBrowser (315 lines)
- `packages/shared/src/types/websocket-events.ts` -- ConversationCreatedEvent summary fields (66 lines)

### Secondary (MEDIUM confidence)
- Phase 31 RESEARCH.md -- WebSocket event infrastructure design decisions
- Phase 32 RESEARCH.md -- Debounce and scroll patterns (similar debounce concept)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing libraries sufficient
- Architecture: HIGH -- patterns derived directly from existing codebase; the gap in useConversations is clearly identified
- Pitfalls: HIGH -- identified from concrete code analysis (missing subscription, no debounce, page reset risk)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain; no external dependencies changing)
