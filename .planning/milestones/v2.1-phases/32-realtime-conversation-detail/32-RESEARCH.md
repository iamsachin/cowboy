# Phase 32: Realtime Conversation Detail - Research

**Researched:** 2026-03-10
**Domain:** Vue 3 scroll management, WebSocket-driven refetch, DOM transition UX
**Confidence:** HIGH

## Summary

Phase 32 adds the UX layer on top of Phase 31's typed WebSocket event infrastructure. The core challenge is managing scroll behavior and visual transitions when new messages arrive via full refetch triggered by `conversation:changed` events. The existing `useConversationDetail` composable already refetches on WebSocket events -- Phase 32 adds debouncing, in-flight queuing, scroll tracking, auto-scroll, a floating "new messages" pill, fade-in animations, and a live activity indicator.

The codebase is well-structured for this work. `ConversationDetail.vue` renders keyed groups via `v-for`, `useCollapseState` tracks expand/collapse via a reactive Map (keyed by group ID), and `groupTurns()` is a pure function that re-runs on each refetch. The main technical challenge is correctly preserving scroll position when DOM content changes above the viewport -- this requires measuring scroll height before and after Vue's DOM update, then adjusting `scrollTop` accordingly.

**Primary recommendation:** Implement scroll tracking and debounced refetch in the composable layer, then add the floating pill and fade-in transitions as pure presentation components. Keep the full-refetch approach -- it is simpler and the CONTEXT.md explicitly chose it over incremental merge.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Scroll behavior:** ~100px at-bottom threshold, instant snap for auto-scroll, smooth scroll for pill click, scroll position holds when scrolled up
- **Incremental rendering strategy:** Full refetch + smart re-render, NO incremental merge. Rely on Vue's keyed list diffing
- **New messages indicator:** Floating pill "N new messages" anchored to viewport bottom, Slack/Discord pattern, count reflects message groups not raw messages
- **Deduplication:** Trust full-refetch atomic replacement, no runtime dedup filter. Dev-mode assertion only
- **Refetch debounce:** 500ms debounce on `conversation:changed` for same conversation
- **In-flight handling:** At most 1 fetch in-flight + 1 queued
- **Live indicator:** Reuse blinking green dot (pulse-dot class from Quick Task #10), no typing/streaming indicator
- **Completion transition:** Green dot disappears when status changes to completed, no toast/banner
- **New message animation:** Subtle fade-in (~200ms) on newly appearing message groups only
- **Vue list keys:** Key all message/group elements by first message ID for stable DOM identity
- **Collapse state preservation:** Collapsed groups stay collapsed through re-renders

### Claude's Discretion
- Exact fade-in animation implementation (CSS transitions vs Vue Transition component)
- Floating pill component styling and positioning details
- How to track "new message count" for the pill (compare previous vs current message arrays)
- Scroll position restoration algorithm details
- Whether to use IntersectionObserver or scroll event listener for at-bottom detection

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PUSH-01 | User sees new messages appear on an open conversation page without manual refresh | Debounced refetch on `conversation:changed` with in-flight queue in `useConversationDetail`, Vue keyed list diffing handles DOM updates |
| PUSH-03 | Scroll position is preserved when new messages arrive -- auto-scroll if at bottom, hold position if scrolled up | Scroll tracking composable with at-bottom detection, pre/post DOM measurement for scroll restoration, floating pill for catch-up |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | ^3.5.0 | Component framework | Already in use, provides `nextTick`, `Transition`, `TransitionGroup`, reactive refs |
| vue-router | ^4.5.0 | Navigation | Already in use, route params for conversation ID |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DaisyUI | ^5.5.0 | UI components/theme | Already in use, floating pill styling |
| Tailwind CSS | ^4.2.0 | Utility classes | Already in use, positioning and animation utilities |
| lucide-vue-next | latest | Icons | Already in use, ChevronDown icon for pill |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Scroll event listener | IntersectionObserver | IO is more performant for at-bottom detection but adds complexity; scroll listener with passive flag and RAF throttle is simpler for this use case |
| Vue `<Transition>` | CSS-only animation | CSS-only is simpler for one-shot fade-in; Vue Transition adds enter/leave lifecycle but is overkill for append-only animation |

**No new dependencies needed.** All required functionality is available with the existing stack.

## Architecture Patterns

### Recommended Composable Structure
```
src/
├── composables/
│   ├── useConversationDetail.ts  # MODIFY: add debounce + in-flight queue
│   └── useScrollTracker.ts       # NEW: scroll position tracking + auto-scroll
├── components/
│   ├── ConversationDetail.vue    # MODIFY: integrate scroll tracking, fade-in
│   ├── NewMessagesPill.vue       # NEW: floating "N new messages" pill
│   └── PulseDot.vue              # NEW: extracted reusable pulse-dot component
└── pages/
    └── ConversationDetailPage.vue # MODIFY: add green dot in metadata header
```

### Pattern 1: Debounced Refetch with In-Flight Queue
**What:** Wrap the existing `fetchDetail()` in `useConversationDetail` with a 500ms debounce on `conversation:changed` events. Track whether a fetch is in-flight. If an event arrives during a fetch, set a `pendingRefetch` flag. When the current fetch completes, fire one more if needed.
**When to use:** Whenever WebSocket events drive HTTP refetch and events may arrive in bursts.
**Example:**
```typescript
// In useConversationDetail.ts
let fetchInFlight = false;
let pendingRefetch = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedRefetch(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (fetchInFlight) {
      pendingRefetch = true;
    } else {
      doFetch();
    }
  }, 500);
}

async function doFetch(): Promise<void> {
  fetchInFlight = true;
  try {
    await fetchDetail();
  } finally {
    fetchInFlight = false;
    if (pendingRefetch) {
      pendingRefetch = false;
      doFetch(); // Fire one more
    }
  }
}
```

### Pattern 2: Scroll Position Preservation
**What:** Before a refetch resolves and Vue re-renders, capture `scrollHeight` and `scrollTop` of the scroll container. After `nextTick`, compute the delta in `scrollHeight` and adjust `scrollTop` by that delta -- but only when the user is NOT at the bottom (at-bottom users get auto-scrolled down instead).
**When to use:** Any infinite-scroll or live-append list where content changes above the viewport.
**Example:**
```typescript
// In useScrollTracker.ts
function preserveScrollPosition(container: HTMLElement, callback: () => void): void {
  const prevScrollHeight = container.scrollHeight;
  const prevScrollTop = container.scrollTop;

  callback(); // trigger data update

  nextTick(() => {
    const newScrollHeight = container.scrollHeight;
    const delta = newScrollHeight - prevScrollHeight;
    if (delta > 0) {
      container.scrollTop = prevScrollTop + delta;
    }
  });
}
```

### Pattern 3: At-Bottom Detection
**What:** Check if the user is within ~100px of the scroll bottom. Use a passive scroll event listener on the scroll container, throttled via `requestAnimationFrame`.
**When to use:** To decide between auto-scroll and scroll preservation.
**Example:**
```typescript
function isAtBottom(container: HTMLElement, threshold = 100): boolean {
  const { scrollTop, scrollHeight, clientHeight } = container;
  return scrollHeight - scrollTop - clientHeight <= threshold;
}
```

### Pattern 4: New Message Group Tracking
**What:** Compare previous group keys to current group keys after refetch. Groups whose key (first message ID) was not in the previous set are "new". Count these for the pill display and mark them for fade-in animation.
**When to use:** After each refetch when data.value updates.
**Example:**
```typescript
const previousGroupKeys = ref<Set<string>>(new Set());
const newGroupKeys = ref<Set<string>>(new Set());

watch(() => data.value?.messages, () => {
  const currentKeys = new Set(
    turns.value
      .filter(t => t.type === 'assistant-group')
      .map(t => turnKey(t))
  );
  const fresh = new Set<string>();
  for (const key of currentKeys) {
    if (!previousGroupKeys.value.has(key)) fresh.add(key);
  }
  newGroupKeys.value = fresh;
  previousGroupKeys.value = currentKeys;
}, { flush: 'pre' });
```

### Anti-Patterns to Avoid
- **Incremental message merge:** CONTEXT.md explicitly chose full-refetch over merge. Do NOT build a message merging pipeline against `groupTurns()`.
- **Runtime dedup filter:** The full-refetch atomic replacement makes dedup unnecessary. Only add a dev-mode assertion for safety.
- **Scroll tracking on `window`:** The scroll container is NOT `window` -- it is the page content area. Track the correct element.
- **Synchronous scroll measurement after data change:** Always use `nextTick()` to measure after Vue's DOM update, never synchronously.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounce | Custom debounce with edge cases | Simple `setTimeout` pattern (shown above) | The pattern is 5 lines; lodash/debounce adds dependency for no benefit |
| Scroll container reference | Query DOM manually | Vue `ref` on container element | Vue refs are reactive and survive re-renders |
| Pulse-dot animation | New animation system | Existing `pulse-dot` CSS class | Already implemented in ConversationTable.vue and ConversationBrowser.vue -- extract to reusable component or shared CSS |
| Group key stability | Custom reconciliation | Vue `:key` with `turnKey()` | The `turnKey()` function already returns first message ID for groups |

**Key insight:** The existing codebase already has the primitives (keyed lists, turnKey, collapseState, pulse-dot). Phase 32 is primarily composition -- wiring these together with scroll tracking and a small amount of new UI.

## Common Pitfalls

### Pitfall 1: Scroll Container Identity
**What goes wrong:** Tracking scroll on the wrong element (window vs. a scrollable div) causes at-bottom detection to always be false or always true.
**Why it happens:** The page layout may use `overflow-y: auto` on a nested container rather than body scroll.
**How to avoid:** Identify the actual scrollable ancestor of `ConversationDetail.vue`. Use a template ref on that element. Test by manually checking `scrollHeight > clientHeight`.
**Warning signs:** Auto-scroll never triggers, or triggers when user is reading history.

### Pitfall 2: Scroll Position Drift on Refetch
**What goes wrong:** After refetch, Vue re-renders the list and scroll position jumps because `scrollHeight` changed but `scrollTop` was not adjusted.
**Why it happens:** New groups are appended at the bottom, changing total height. If not at bottom, the viewport shifts.
**How to avoid:** Capture `scrollHeight` BEFORE the data update, then after `nextTick`, compute delta and adjust. Only do this when NOT at-bottom.
**Warning signs:** User reading old messages suddenly sees content jump when agent writes new messages.

### Pitfall 3: Collapse State Lost on Re-render
**What goes wrong:** User collapses a group, refetch happens, group re-renders as expanded.
**Why it happens:** If `visibleCount` resets or group keys change, collapse state Map keys no longer match.
**How to avoid:** Do NOT reset `visibleCount` on every refetch -- only reset when the conversation ID changes. The existing `watch(() => props.messages.length)` that resets `visibleCount` to PAGE_SIZE must be changed to only trigger on conversation change, not on live updates.
**Warning signs:** All groups snap back to collapsed/expanded default after any live update.

### Pitfall 4: Pagination Reset Breaks Auto-Expand
**What goes wrong:** User has expanded beyond the initial 50 groups. Refetch resets `visibleCount` to 50, hiding groups the user was viewing.
**Why it happens:** The current `watch(() => props.messages.length)` resets pagination on ANY message count change.
**How to avoid:** When at-bottom, auto-expand `visibleCount` to include new groups (e.g., `visibleCount = turns.value.length`). When scrolled up, do NOT change `visibleCount`.
**Warning signs:** "Load more" button reappears after every live update even when user was viewing all messages.

### Pitfall 5: Fade-In on Existing Groups
**What goes wrong:** Every group fades in on every refetch, creating a distracting flash effect.
**Why it happens:** Not tracking which groups are genuinely new vs. already rendered.
**How to avoid:** Track previous group keys, only apply fade-in CSS class to groups whose key was NOT in the previous set. Clear the "new" set after the animation completes (~200ms timeout).
**Warning signs:** Entire conversation flashes/fades on every live update.

### Pitfall 6: Pill Count Includes All Groups
**What goes wrong:** Pill shows wrong count -- either too many (counts all groups) or too few (counts only assistant groups).
**Why it happens:** Not filtering to only genuinely new groups, or counting raw messages instead of groups.
**How to avoid:** Count only groups that appear in `newGroupKeys` set. CONTEXT.md specifies counting "message groups" not individual messages.
**Warning signs:** Pill shows "47 new messages" when only 2 new assistant responses arrived.

## Code Examples

### Existing pulse-dot CSS (from ConversationTable.vue)
```css
/* Already exists -- extract to shared styles or a PulseDot component */
.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: oklch(0.72 0.19 142);
  animation: pulse-fade 1.5s ease-in-out infinite;
}

@keyframes pulse-fade {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

### Floating Pill Component (recommended approach)
```vue
<template>
  <Transition name="pill-fade">
    <button
      v-if="count > 0"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
             btn btn-sm btn-primary gap-1 shadow-lg"
      @click="$emit('scrollToBottom')"
    >
      {{ count }} new message{{ count === 1 ? '' : 's' }}
      <ChevronDown class="w-4 h-4" />
    </button>
  </Transition>
</template>
```

### CSS Fade-In for New Groups
```css
/* Recommendation: CSS-only approach (simpler than Vue Transition for append-only) */
.group-fade-in {
  animation: group-enter 200ms ease-out;
}

@keyframes group-enter {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### useScrollTracker Composable Skeleton
```typescript
import { ref, onMounted, onUnmounted } from 'vue';

export function useScrollTracker(containerRef: Ref<HTMLElement | null>) {
  const isAtBottom = ref(true);
  const THRESHOLD = 100;

  let rafId: number | null = null;

  function checkBottom(): void {
    const el = containerRef.value;
    if (!el) return;
    isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight <= THRESHOLD;
  }

  function onScroll(): void {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      checkBottom();
    });
  }

  function scrollToBottom(smooth = false): void {
    const el = containerRef.value;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  }

  onMounted(() => {
    containerRef.value?.addEventListener('scroll', onScroll, { passive: true });
  });

  onUnmounted(() => {
    containerRef.value?.removeEventListener('scroll', onScroll);
    if (rafId) cancelAnimationFrame(rafId);
  });

  return { isAtBottom, scrollToBottom, checkBottom };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `watch(() => props.messages.length)` resets pagination | Must NOT reset on live updates | Phase 32 | Pagination stability during live mode |
| Direct `fetchDetail()` on every WS event | Debounced (500ms) + in-flight queue | Phase 32 | Prevents API flood during rapid agent activity |
| No scroll management | Scroll tracking + auto-scroll + position preservation | Phase 32 | Core UX requirement for live viewing |
| Pulse-dot duplicated in 2 components | Extract to shared PulseDot.vue or global CSS | Phase 32 | DRY, reusable in detail page header |

**Deprecated/outdated:**
- The `watch(() => props.messages.length)` that resets `visibleCount` to PAGE_SIZE must be modified to only fire on conversation change, not on live message arrival.

## Open Questions

1. **Scroll container element**
   - What we know: `ConversationDetailPage.vue` is rendered inside the app's main content area. The actual scrollable container might be `window`, a parent layout div, or the page element itself.
   - What's unclear: Which element has `overflow-y: auto/scroll` -- need to inspect the app layout.
   - Recommendation: During implementation, inspect the DOM to identify the scrollable ancestor. If it's the viewport/body, use `window.scrollY` and `document.documentElement.scrollHeight`. If it's a div, use a template ref.

2. **Conversation status field in API response**
   - What we know: The metadata header shows conversation info. The green dot should appear when conversation is "active".
   - What's unclear: Whether `ConversationDetailResponse.conversation` includes a `status` or `isActive` field. The conversation list uses `isActive`.
   - Recommendation: Check the API response during implementation. If `isActive` is not in the detail response, add it to the backend query or derive from `lastMessageAt` recency.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.ts) |
| Config file | `packages/frontend/vitest.config.ts` |
| Quick run command | `cd packages/frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/frontend && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUSH-01 | Refetch on conversation:changed with debounce + in-flight queue | unit | `cd packages/frontend && npx vitest run tests/composables/useConversationDetail.test.ts -x` | No - Wave 0 |
| PUSH-01 | New groups detected after refetch (newGroupKeys tracking) | unit | `cd packages/frontend && npx vitest run tests/composables/useScrollTracker.test.ts -x` | No - Wave 0 |
| PUSH-03 | At-bottom detection with threshold | unit | `cd packages/frontend && npx vitest run tests/composables/useScrollTracker.test.ts -x` | No - Wave 0 |
| PUSH-03 | Scroll position preserved when scrolled up | unit | `cd packages/frontend && npx vitest run tests/composables/useScrollTracker.test.ts -x` | No - Wave 0 |
| PUSH-03 | Auto-scroll when at bottom | unit | `cd packages/frontend && npx vitest run tests/composables/useScrollTracker.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd packages/frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/composables/useConversationDetail.test.ts` -- covers PUSH-01 (debounce, in-flight queue, refetch on WS events). Note: file does not exist yet; existing `useWebSocket.test.ts` covers WS layer.
- [ ] `tests/composables/useScrollTracker.test.ts` -- covers PUSH-03 (at-bottom detection, scroll preservation). Note: happy-dom has limited scroll API; tests may need to mock `scrollHeight`/`scrollTop`/`clientHeight`.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** - `useConversationDetail.ts`, `useWebSocket.ts`, `ConversationDetail.vue`, `ConversationDetailPage.vue`, `useGroupedTurns.ts`, `useCollapseState.ts`, `ConversationTable.vue` (pulse-dot CSS)
- **Vue 3 docs** - `nextTick`, `Transition`, `TransitionGroup`, `watch` with `flush: 'pre'` semantics

### Secondary (MEDIUM confidence)
- **Scroll management patterns** - Standard DOM APIs (`scrollHeight`, `scrollTop`, `clientHeight`, `scrollTo`) -- well-documented MDN APIs
- **requestAnimationFrame throttling** - Standard browser API for scroll event optimization

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all existing libraries sufficient
- Architecture: HIGH - Patterns are well-understood (scroll tracking, debounce, keyed lists), codebase structure is clear
- Pitfalls: HIGH - Identified from direct codebase inspection (pagination reset bug, collapse state preservation, scroll container identity)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no external dependencies changing)
