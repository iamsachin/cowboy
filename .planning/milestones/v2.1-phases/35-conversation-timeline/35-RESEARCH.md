# Phase 35: Conversation Timeline - Research

**Researched:** 2026-03-10
**Domain:** Vue 3 sidebar timeline with scroll synchronization and live updates
**Confidence:** HIGH

## Summary

Phase 35 adds a collapsible vertical timeline sidebar to the conversation detail page. The timeline displays user messages, assistant groups, and compaction events derived from the existing `groupTurns()` output. Key challenges are: (1) two-column layout shift when the panel opens/closes, (2) bidirectional scroll sync between the conversation and the timeline, and (3) live update behavior with highlight animations.

The implementation builds entirely on existing infrastructure. The `groupTurns()` pure function already classifies all turn types needed for timeline events. The `useScrollTracker` composable handles bottom-detection. The `useCollapseState` composable manages expand/collapse. Existing CSS patterns (`pulse-dot`, `row-highlight`) provide animation reuse. No new dependencies are needed.

**Primary recommendation:** Build a `useTimeline` singleton composable for panel state (open/closed, active event tracking) and a `ConversationTimeline.vue` component. Integrate at the `ConversationDetailPage.vue` level by wrapping the existing `max-w-5xl` container in a flex layout that conditionally shows the timeline panel.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Show three turn types as timeline events: user messages, assistant groups, compactions
- Exclude system groups, slash commands, and agent prompts
- Labels: user messages show first ~30 chars, assistant groups show model + tool count, compactions show token delta
- Long conversations (100+ turns): show all events with timeline panel own scrollbar
- Right sidebar panel, page shifts from centered max-w-5xl to two-column when open
- Narrow fixed width (~220px) with truncated labels
- Toggle button in conversation metadata header bar (next to title)
- Collapse/expand state persisted in localStorage
- Default to open on first visit
- Auto-highlight currently visible event as user scrolls (useScrollTracker exists)
- Timeline panel auto-scrolls to keep highlighted event in view
- Click timeline event -> smooth scroll to target turn (matches NewMessagesPill behavior)
- Clicking a collapsed assistant group auto-expands it
- Timeline derived from groupTurns() output, recomputed on each refetch
- New events appear at bottom with row-highlight animation (oklch green, 2s fade-out)
- Timeline auto-scrolls to new events only if user was at bottom of timeline
- Active conversation shows blinking green dot on latest timeline event (reuse pulse-dot)
- Timeline shows all events regardless of lazy-load pagination boundary; clicking unloaded event triggers load-more first then scrolls

### Claude's Discretion
- Visual style of timeline dots/lines/connectors
- Exact scroll sync implementation (IntersectionObserver vs scroll listener)
- How to determine "currently visible" event from scroll position
- Transition animation for panel show/hide
- How to trigger load-more when clicking unloaded timeline events

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TIME-01 | User sees a collapsible vertical timeline on the right side of the conversation detail page showing key events | ConversationTimeline.vue component + useTimeline composable + two-column layout in ConversationDetailPage.vue |
| TIME-02 | User can click timeline events to scroll to the corresponding position in the conversation | Click handler using scrollIntoView with smooth behavior + load-more trigger for unloaded events + auto-expand collapsed groups |
| TIME-03 | User can collapse/expand the timeline panel | localStorage-persisted toggle state in useTimeline composable + layout shift via conditional flex classes |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | 3.x | Reactive UI framework | Already in use |
| DaisyUI | 4.x | Component styling (night theme) | Already in use |
| Tailwind CSS | 3.x | Utility-first CSS | Already in use |
| lucide-vue-next | latest | Icons (toggle button) | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| IntersectionObserver API | Browser native | Track which conversation turn is visible | For active event detection in scroll sync |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| IntersectionObserver | scroll event + getBoundingClientRect | IO is more performant, avoids forced layout; scroll listener is simpler but CPU-heavier |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
packages/frontend/src/
  composables/
    useTimeline.ts          # Singleton composable: panel open state, active event, scroll-to logic
  components/
    ConversationTimeline.vue # Timeline sidebar panel component
  pages/
    ConversationDetailPage.vue  # Modified: two-column layout when timeline open
```

### Pattern 1: Singleton Composable for Timeline State
**What:** Module-level `ref` for panel open/closed state (persisted to localStorage) shared across the page.
**When to use:** Panel toggle button is in the metadata header, but the panel itself is a sibling element.
**Example:**
```typescript
// useTimeline.ts - follows existing singleton pattern (useTokenRate, useCommandPalette)
import { ref, computed } from 'vue';

const STORAGE_KEY = 'timeline-panel-open';
const isOpen = ref(localStorage.getItem(STORAGE_KEY) !== 'false'); // default open

export function useTimeline() {
  function toggle() {
    isOpen.value = !isOpen.value;
    localStorage.setItem(STORAGE_KEY, String(isOpen.value));
  }
  return { isOpen, toggle };
}
```

### Pattern 2: IntersectionObserver for Active Event Detection
**What:** Observe all turn elements in the conversation. The topmost visible turn determines the active timeline event.
**When to use:** When the user scrolls the conversation, the timeline highlights the corresponding event.
**Example:**
```typescript
// Inside ConversationTimeline.vue or a composable
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        // Track visible entries, pick topmost
      }
    }
  },
  { root: scrollContainer, rootMargin: '0px', threshold: 0.1 }
);
// Observe each turn element by data attribute: [data-turn-key]
```

### Pattern 3: Click-to-Scroll with Load-More
**What:** When a timeline event is clicked and the target turn is beyond the lazy-load boundary, first expand `visibleCount`, then after `nextTick`, scroll to the element.
**When to use:** Timeline shows ALL events but ConversationDetail.vue only renders `visibleTurns` (paginated at 50).
**Example:**
```typescript
async function scrollToTurn(turnKey: string, turnIndex: number) {
  // If turn is beyond visible count, expand pagination first
  if (turnIndex >= visibleCount.value) {
    visibleCount.value = turnIndex + 1;
    await nextTick();
  }
  // Auto-expand collapsed assistant group
  if (!isExpanded(turnKey)) {
    toggle(turnKey);
    await nextTick();
  }
  // Smooth scroll to element
  const el = document.querySelector(`[data-turn-key="${turnKey}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

### Pattern 4: Two-Column Layout with Transition
**What:** ConversationDetailPage.vue wraps content in a flex container. When timeline is open, the main content gets `flex-1` and the timeline panel gets `w-[220px] shrink-0`.
**When to use:** Always - this is the core layout change.
**Example:**
```html
<!-- ConversationDetailPage.vue template change -->
<div class="flex" :class="{ 'max-w-5xl mx-auto': !timelineOpen }">
  <div class="flex-1 min-w-0 p-4" :class="{ 'max-w-5xl mx-auto': !timelineOpen }">
    <!-- existing content -->
  </div>
  <ConversationTimeline v-if="timelineOpen" class="w-[220px] shrink-0" />
</div>
```

### Anti-Patterns to Avoid
- **Separate data source for timeline:** Timeline MUST derive from the same `groupTurns()` output as ConversationDetail. Never fetch timeline data separately.
- **Incremental timeline merge:** Don't try to diff old and new timeline events. Recompute from `groupTurns()` on each refetch (matches existing pattern per CONTEXT.md decision).
- **Scroll listener without RAF throttling:** The existing `useScrollTracker` already uses `requestAnimationFrame` gating. Any new scroll listeners must do the same.
- **Hard-coding turn element IDs:** Use `data-turn-key` attributes matching the `turnKey()` function output, not generated IDs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll bottom detection | Custom scroll math | `useScrollTracker.isAtBottom` | Already handles edge cases, RAF-throttled |
| Collapse state persistence | Custom localStorage wrapper | `localStorage.getItem/setItem` directly (simple boolean) | Single key, not complex enough for abstraction |
| Turn classification | Custom turn type logic | `groupTurns()` pure function | Already classifies all 7 turn types with proper ordering |
| Smooth scroll to element | Custom scroll animation | `el.scrollIntoView({ behavior: 'smooth' })` | Browser-native, matches existing NewMessagesPill pattern |
| Green pulse animation | Custom keyframes | Existing `.pulse-dot` CSS class | Already defined in multiple components, identical pattern |
| Highlight animation | Custom keyframes | Existing `.row-highlight` CSS pattern | oklch green, 2s ease-out already used in Phase 33 |

**Key insight:** Nearly every visual and behavioral pattern needed for this phase already exists in the codebase. The timeline is a novel composition of existing building blocks.

## Common Pitfalls

### Pitfall 1: Layout Shift Breaking Scroll Position
**What goes wrong:** When the timeline opens/closes, the page layout shifts. This changes scroll positions and can jump the user to an unexpected location.
**Why it happens:** The main content area width changes, reflowing text and elements.
**How to avoid:** Capture scroll position before layout change, restore after `nextTick`. Use `captureScrollPosition()` from `useScrollTracker`.
**Warning signs:** Content jumps when toggling the timeline panel.

### Pitfall 2: IntersectionObserver Stale References
**What goes wrong:** Observer observes elements that are later removed by Vue's reactivity (pagination changes, live updates). Callbacks fire with stale data.
**Why it happens:** `v-for` recycles DOM elements. Old entries stay observed.
**How to avoid:** Re-observe when `turns` computed changes. Use `watch` on turns to disconnect/reconnect observers. Use `onScopeDispose` for cleanup (existing project pattern).
**Warning signs:** Active event highlighting is incorrect or doesn't update.

### Pitfall 3: Timeline Shows Events Beyond Pagination But Click Fails
**What goes wrong:** The timeline lists ALL grouped turns, but `ConversationDetail` only renders the first `visibleCount`. Clicking an event beyond the boundary finds no DOM element.
**Why it happens:** Timeline derives from full `groupTurns()` output, but the turn list is paginated.
**How to avoid:** When clicked event index >= `visibleCount`, set `visibleCount` to at least that index + 1, await `nextTick()`, then scroll.
**Warning signs:** Clicking early events in a long conversation does nothing.

### Pitfall 4: Dual Scroll Containers Competing
**What goes wrong:** Both the main `<main>` element and the timeline panel have their own scrollbars. Auto-scroll behaviors conflict.
**Why it happens:** Timeline auto-scrolls to keep active event visible while main content auto-scrolls for new messages.
**How to avoid:** Track "user was at bottom" independently for each scroll container. Timeline auto-scroll to new events only follows its own bottom state.
**Warning signs:** Timeline scrolls unexpectedly when user is reading an older section.

### Pitfall 5: Turn Key Data Attribute Missing on Some Turn Types
**What goes wrong:** The `data-turn-key` attribute is only added to assistant groups currently (`data-group-id`). Click-to-scroll for user messages and compactions finds no element.
**Why it happens:** Only assistant groups needed data attributes before (for keyboard navigation).
**How to avoid:** Add `data-turn-key` to every turn element wrapper in `ConversationDetail.vue`, not just assistant groups.
**Warning signs:** Clicking user messages or compactions in the timeline does nothing.

## Code Examples

### Timeline Event Extraction from GroupedTurns
```typescript
// Filter groupTurns output to only timeline-visible types
import type { GroupedTurn } from '../composables/useGroupedTurns';

interface TimelineEvent {
  key: string;         // turnKey for the grouped turn
  type: 'user' | 'assistant-group' | 'compaction';
  label: string;       // Truncated display text
  turnIndex: number;   // Index in full turns array (for pagination check)
}

function extractTimelineEvents(turns: GroupedTurn[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.type === 'user') {
      const text = turn.message.content || '';
      events.push({
        key: turn.message.id,
        type: 'user',
        label: text.slice(0, 30) + (text.length > 30 ? '...' : ''),
        turnIndex: i,
      });
    } else if (turn.type === 'assistant-group') {
      const model = turn.model || 'Assistant';
      const tools = turn.toolCallCount;
      events.push({
        key: turn.turns[0].message.id,
        type: 'assistant-group',
        label: `${model}${tools > 0 ? ` · ${tools} tool${tools === 1 ? '' : 's'}` : ''}`,
        turnIndex: i,
      });
    } else if (turn.type === 'compaction') {
      const before = turn.tokensBefore ?? 0;
      const after = turn.tokensAfter ?? 0;
      const delta = before - after;
      events.push({
        key: turn.id,
        type: 'compaction',
        label: delta > 0 ? `-${Math.round(delta / 1000)}k tokens` : 'Compaction',
        turnIndex: i,
      });
    }
    // Skip: system-group, slash-command, clear-divider, agent-prompt
  }
  return events;
}
```

### Data Attribute on All Turn Elements
```html
<!-- ConversationDetail.vue: Add data-turn-key to every turn wrapper -->
<template v-for="turn in visibleTurns" :key="turnKey(turn)">
  <div :data-turn-key="turnKey(turn)" :class="{ ... }">
    <!-- existing turn rendering -->
  </div>
</template>
```

### IntersectionObserver for Active Event
```typescript
// Simplified: track which turn elements are visible, pick topmost
function useActiveEventTracker(
  scrollContainer: Ref<HTMLElement | null>,
  turnKeys: Ref<string[]>
) {
  const activeKey = ref<string | null>(null);
  const visibleKeys = reactive(new Set<string>());
  let observer: IntersectionObserver | null = null;

  function setup() {
    cleanup();
    const root = scrollContainer.value;
    if (!root) return;

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset.turnKey;
          if (!key) continue;
          if (entry.isIntersecting) visibleKeys.add(key);
          else visibleKeys.delete(key);
        }
        // Active = first visible key in document order
        for (const k of turnKeys.value) {
          if (visibleKeys.has(k)) { activeKey.value = k; return; }
        }
      },
      { root, threshold: 0.1 }
    );

    // Observe all turn elements
    for (const el of root.querySelectorAll('[data-turn-key]')) {
      observer.observe(el);
    }
  }

  function cleanup() {
    observer?.disconnect();
    observer = null;
    visibleKeys.clear();
  }

  return { activeKey, setup, cleanup };
}
```

### Timeline Panel Auto-Scroll
```typescript
// When activeKey changes, scroll the timeline to keep it visible
watch(activeKey, (key) => {
  if (!key || !timelinePanelRef.value) return;
  const el = timelinePanelRef.value.querySelector(`[data-timeline-key="${key}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual scroll position tracking | IntersectionObserver API | Stable across all modern browsers | More performant, no forced layout |
| Fixed sidebar layouts | CSS flex with shrink-0 | CSS standard | Clean two-column without absolute positioning |
| Custom scroll-to implementations | `Element.scrollIntoView()` | Widely supported | Native smooth scrolling, no JS animation library needed |

**Deprecated/outdated:**
- None relevant. All browser APIs used are stable and well-supported.

## Open Questions

1. **ConversationDetail.vue `visibleCount` Exposure**
   - What we know: `visibleCount` is a local ref inside ConversationDetail.vue. The timeline needs to expand it when clicking unloaded events.
   - What's unclear: Best way to expose this without breaking encapsulation.
   - Recommendation: Either (a) lift `visibleCount` to the page level via props/emits, or (b) expose a `loadUpTo(index)` method via `defineExpose`. Option (b) is cleaner.

2. **CollapseState Exposure for Auto-Expand**
   - What we know: The `toggle` and `isExpanded` functions live inside ConversationDetail.vue's local `useCollapseState`.
   - What's unclear: Timeline click needs to auto-expand a collapsed assistant group.
   - Recommendation: Expose `expandGroup(key)` via `defineExpose` alongside `loadUpTo`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `vitest.config.ts` (workspace root) + `packages/frontend/vitest.config.ts` |
| Quick run command | `npx vitest run --project frontend` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIME-01 | Timeline events extracted from groupTurns output (3 types, correct labels) | unit | `npx vitest run --project frontend tests/composables/useTimeline.test.ts -t "extractTimelineEvents"` | No - Wave 0 |
| TIME-01 | Timeline panel renders events list with correct structure | unit | `npx vitest run --project frontend tests/components/ConversationTimeline.test.ts` | No - Wave 0 |
| TIME-02 | Click-to-scroll triggers scrollIntoView on correct element | unit | `npx vitest run --project frontend tests/composables/useTimeline.test.ts -t "scrollToTurn"` | No - Wave 0 |
| TIME-03 | Panel open/closed state persists to localStorage | unit | `npx vitest run --project frontend tests/composables/useTimeline.test.ts -t "localStorage"` | No - Wave 0 |
| TIME-03 | Default open on first visit (no localStorage key) | unit | `npx vitest run --project frontend tests/composables/useTimeline.test.ts -t "default open"` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --project frontend`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/frontend/tests/composables/useTimeline.test.ts` -- covers TIME-01, TIME-02, TIME-03 (composable logic)
- [ ] `packages/frontend/tests/components/ConversationTimeline.test.ts` -- covers TIME-01 (component rendering)

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `useGroupedTurns.ts` -- GroupedTurn types, turnKey() function, groupTurns() pure function
- Codebase analysis: `useScrollTracker.ts` -- isAtBottom, scrollToBottom, captureScrollPosition patterns
- Codebase analysis: `useCollapseState.ts` -- reactive Map-based expand/collapse
- Codebase analysis: `ConversationDetail.vue` -- turn rendering, pagination (PAGE_SIZE=50), keyboard navigation
- Codebase analysis: `ConversationDetailPage.vue` -- page layout (max-w-5xl mx-auto), metadata header bar, scroll container detection
- Codebase analysis: `DashboardLayout.vue` -- flex h-screen layout with main overflow-y-auto
- Codebase analysis: `NewMessagesPill.vue` -- smooth scroll pattern, fixed positioning
- Codebase analysis: `ConversationBrowser.vue` -- row-highlight and pulse-dot CSS patterns
- Codebase analysis: `useConversationDetail.ts` -- debounced WS refetch, newGroupKeys tracking

### Secondary (MEDIUM confidence)
- MDN IntersectionObserver API -- well-documented, stable browser API

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing
- Architecture: HIGH -- patterns directly mirror existing codebase conventions (singleton composable, localStorage persistence, DaisyUI styling)
- Pitfalls: HIGH -- identified from direct codebase analysis of scroll behavior, pagination, and layout

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- all browser APIs and Vue patterns are established)
