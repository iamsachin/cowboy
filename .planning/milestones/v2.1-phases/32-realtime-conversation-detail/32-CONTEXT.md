# Phase 32: Realtime Conversation Detail - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users viewing a conversation detail page see new messages appear automatically within seconds of the agent writing them to disk. Auto-scroll, scroll position preservation, and deduplication are handled correctly. This phase builds on the typed WebSocket event infrastructure from Phase 31 — the `conversation:changed` event routing and `useConversationDetail` composable already exist. Phase 32 adds the UX layer: scroll management, visual rendering updates, live indicators, and robust refetch handling.

</domain>

<decisions>
## Implementation Decisions

### Scroll Behavior
- **At-bottom detection:** ~100px threshold from absolute bottom counts as "at bottom"
- **Auto-scroll on new messages:** Instant snap to bottom (no animation) when user is in the auto-scroll zone
- **Reading history:** Scroll position holds steady when user is scrolled up — no disruption
- **New messages indicator:** Floating pill anchored to bottom of viewport — "N new messages ↓" — click to jump, disappears when user scrolls to bottom (Slack/Discord pattern)
- **Pill click behavior:** Smooth scroll animation to bottom (deliberate user action gets polish, auto-scroll gets instant snap)

### Incremental Rendering
- **Strategy:** Full refetch + smart re-render — keep existing full refetch on `conversation:changed`, rely on Vue's keyed list diffing for DOM reuse
- **No incremental merge** — simpler, leverages existing infrastructure, avoids complex merge logic against groupTurns pipeline
- **New message animation:** Subtle fade-in (~200ms) on newly appearing message groups
- **Lazy-load pagination:** Auto-expand visible group count when user is at bottom; if scrolled up in history, lazy-load boundary stays put
- **Collapse state preservation:** If user collapsed an assistant group, it stays collapsed through re-renders. Key groups by first message ID for stable Vue identity

### Active Conversation Awareness
- **Live indicator:** Reuse blinking green dot (already exists from Quick Task #10) in the metadata header next to conversation status
- **No typing/streaming indicator** — ingestion-based updates arrive in bursts, not token-by-token. Green dot already signals liveness
- **Completion transition:** Green dot disappears when status changes to completed. No toast, no banner. Status field in metadata header updates silently
- **Live metadata updates:** Token count, duration, and cost update on each refetch — comes free with full refetch approach

### Deduplication & Refetch Robustness
- **Dedup approach:** Trust the full-refetch atomic replacement — no runtime dedup filter needed
- **Dev-mode assertion:** Flag duplicate message IDs if they somehow appear in API response (safety net, not production overhead)
- **Vue list keys:** Key all message/group elements by message ID for correct DOM reuse
- **Refetch debounce:** 500ms debounce on `conversation:changed` events for the same conversation — reduces unnecessary API calls during rapid agent activity
- **In-flight handling:** At most 1 fetch in-flight + 1 queued. If a fetch is active when a new event arrives, mark that another is needed. When current completes, fire one more

### Claude's Discretion
- Exact fade-in animation implementation (CSS transitions vs Vue Transition component)
- Floating pill component styling and positioning details
- How to track "new message count" for the pill (compare previous vs current message arrays)
- Scroll position restoration algorithm details
- Whether to use IntersectionObserver or scroll event listener for at-bottom detection

</decisions>

<specifics>
## Specific Ideas

- Floating pill should match the app's DaisyUI night theme — subtle, not distracting
- The "N new messages" count should reflect actual new message groups, not raw message count (user sees groups, not individual messages)
- Fade-in should only apply to genuinely new groups, not to groups that existed before the refetch — compare previous group keys to current

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useConversationDetail.ts`: Already listens for `conversation:changed` and `system:full-refresh` — add debounce and in-flight queue logic here
- `useWebSocket.ts`: Typed `on()` pattern with auto-cleanup — no changes needed, just consume
- `ConversationDetail.vue`: Message rendering with lazy-load pagination (first 50 groups) — add scroll tracking and auto-expand logic
- `ConversationDetailPage.vue`: Metadata header with status, tokens, cost — add green dot indicator
- `useGroupedTurns.ts`: Pure function `groupTurns()` — no changes needed, re-runs on refetch naturally
- Blinking green dot: Already implemented in conversation list (Quick Task #10) — reuse pattern/component

### Established Patterns
- Singleton composable pattern (module-level state) — useWebSocket follows this
- Notify-then-fetch (WebSocket notifies, HTTP serves data) — maintain
- `onScopeDispose` for cleanup — use for scroll event listeners
- Vue keyed `v-for` lists — ensure message groups have stable keys by first message ID
- DaisyUI 5 night theme — floating pill should use theme colors

### Integration Points
- `useConversationDetail.ts`: Add debounced refetch with in-flight queue
- `ConversationDetail.vue`: Add scroll tracking, auto-scroll, floating pill, fade-in transitions
- `ConversationDetailPage.vue`: Add green dot next to status in metadata header
- Vue list rendering: Ensure `:key` bindings use message/group IDs for stable DOM identity

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-realtime-conversation-detail*
*Context gathered: 2026-03-10*
