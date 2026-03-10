# Phase 35: Conversation Timeline - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Collapsible vertical timeline on the right side of the conversation detail page showing key events (user messages, assistant groups, compactions) with click-to-scroll navigation and live updates. Users can navigate conversation history visually and the timeline syncs with scroll position.

</domain>

<decisions>
## Implementation Decisions

### Event Visibility
- Show three turn types as timeline events: user messages, assistant groups, compactions
- Exclude system groups, slash commands, and agent prompts — keep timeline focused on conversation flow
- Labels show truncated content: user messages show first ~30 chars of prompt, assistant groups show model + tool count (e.g., "Opus 4 · 3 tools"), compactions show token delta
- Long conversations (100+ turns): show all events with timeline panel having its own scrollbar — no collapsing or filtering

### Timeline Layout & Interaction
- Right sidebar panel alongside conversation — page layout shifts from centered max-w-5xl to two-column when open
- Narrow fixed width (~220px) with truncated labels
- Toggle button in the conversation metadata header bar (next to title)
- Collapse/expand state persisted in localStorage
- Default to **open** on first visit — users see the feature immediately
- When collapsed, conversation returns to original centered layout

### Active Event Tracking
- Auto-highlight the currently visible event as user scrolls the conversation (useScrollTracker exists)
- Timeline panel auto-scrolls to keep the highlighted event in view — both panels stay in sync
- Click a timeline event → smooth scroll to the target turn (matches NewMessagesPill behavior from Phase 32)
- Clicking a collapsed assistant group auto-expands it so user sees the content they navigated to

### Live Update Behavior
- Timeline derived from groupTurns() output — recomputed on each refetch, no incremental merge
- New events appear at bottom with brief highlight animation (reuse row-highlight pattern from Phase 33: oklch green with fade-out)
- Timeline auto-scrolls to new events only if user was already at the bottom of the timeline
- Active conversation shows blinking green dot on the latest timeline event (reuse existing pulse-dot pattern)
- Timeline shows all events regardless of lazy-load pagination boundary — clicking an event beyond loaded range triggers load-more first, then scrolls

### Claude's Discretion
- Visual style of timeline dots/lines/connectors
- Exact scroll sync implementation (IntersectionObserver vs scroll listener)
- How to determine "currently visible" event from scroll position
- Transition animation for panel show/hide
- How to trigger load-more when clicking unloaded timeline events

</decisions>

<specifics>
## Specific Ideas

- Timeline should feel like a document outline / table of contents — scannable at a glance
- Reuse existing DaisyUI night theme conventions — subtle, not distracting
- Green dot on latest event matches the existing pulse-dot from Quick Task #10
- Highlight animation for new events should match Phase 33's row-highlight (oklch green, 2s ease-out fade)
- Smooth scroll on click matches Phase 32's NewMessagesPill behavior

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useGroupedTurns.ts`: Pure `groupTurns()` function classifying all turn types — timeline events derived from this output
- `useScrollTracker.ts`: Existing scroll tracking composable — extend for active event detection
- `useConversationDetail.ts`: Debounced WS refetch with in-flight queue — timeline rebuilds on same data
- `ConversationDetail.vue`: Turn list with keyed v-for, lazy-load pagination — add timeline event IDs matching turn keys
- `useCollapseState.ts`: Collapse state management — reuse for timeline panel toggle with localStorage
- Existing `pulse-dot` CSS class for blinking green dot indicator
- Phase 33's `row-highlight` animation pattern (oklch green, 2s ease-out)

### Established Patterns
- Singleton composable pattern (module-level state) — use for timeline state
- localStorage for UI state persistence (sidebar collapse, token pill dismiss already use this)
- `onScopeDispose` for cleanup — use for scroll/intersection observers
- Vue keyed `v-for` with stable IDs — timeline events keyed by same turn keys
- DaisyUI night theme — timeline uses theme colors

### Integration Points
- `ConversationDetailPage.vue`: Add timeline toggle button in metadata header, mount timeline panel
- `ConversationDetail.vue`: Expose turn element refs/IDs for scroll-to-element targeting
- Page layout: Shift from `max-w-5xl mx-auto` to flex two-column when timeline is open
- `useConversationDetail.ts`: Timeline reads same grouped turns data — no separate data source needed

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-conversation-timeline*
*Context gathered: 2026-03-10*
