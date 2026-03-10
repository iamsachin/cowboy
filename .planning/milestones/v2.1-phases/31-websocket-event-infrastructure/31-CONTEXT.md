# Phase 31: WebSocket Event Infrastructure - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend broadcasts typed, conversation-scoped WebSocket events replacing the untyped `data-changed` broadcast. Frontend composable routes typed events to registered callbacks. Shared type definitions ensure backend and frontend use identical event shapes. This is infrastructure only — consuming phases (32-35) build features on top of it.

</domain>

<decisions>
## Implementation Decisions

### Event Granularity
- Fine-grained event types: message-added, tool-call-added, tokens-updated, plan-updated, status-changed, metadata-changed, plus conversation:created
- All event types implemented in Phase 31 (not deferred to later phases)
- Events batched per conversation per ingestion cycle — one `conversation:changed` event with a `changes` array listing what changed
- Settings operations (clear-db, refresh-db) emit `system:full-refresh` instead of conversation events

### Migration Strategy
- Big-bang replacement — remove `data-changed` entirely for ingestion events
- All 6 composables (useAnalytics, useConversationBrowser, usePlans, useConversationDetail, useAgentAnalytics, useAdvancedAnalytics) migrate to typed event handlers in this phase
- Smart refetch — each composable checks if the event is relevant before refetching (e.g., conversation detail only refetches if conversation ID matches)
- Replace composable API entirely — remove `onDataChanged()`, add `on(type, callback)` pattern

### Event Payload Shape
- Minimal payloads for `conversation:changed` — just conversationId + changes array + timestamp + sequence number
- `conversation:created` includes summary data (title, agent, project, createdAt) so list can insert without full refetch
- `system:full-refresh` for settings operations — tells all composables to refetch everything
- Monotonic sequence numbers on all events — frontend detects gaps and triggers automatic full refetch

### Routing Pattern
- Type-specific callback registration: `on('conversation:changed', callback)`
- `on()` returns unsubscribe function AND auto-cleanup via onScopeDispose (both available)
- Sequence number tracking and gap detection handled internally by composable — consumers don't see it
- On gap detection, composable automatically emits system:full-refresh to all listeners

### Shared Types
- Event interfaces and discriminated union exported from shared package
- Type guard functions exported alongside interfaces (isConversationChanged(), isConversationCreated(), etc.)

### ConnectionStatus Component
- Keep as-is — green/orange/red dot for connection state only
- No additional info (last event, events/min) in this phase

### Claude's Discretion
- Internal event bus implementation details
- Sequence number reset strategy on reconnect
- Exact change type taxonomy naming conventions
- How ingestion determines which changes occurred (diff strategy)

</decisions>

<specifics>
## Specific Ideas

- Batched event shape: `{ type: 'conversation:changed', seq: 42, conversationId: 'abc', changes: ['messages-added', 'tokens-updated'], timestamp: '...' }`
- Created event shape: `{ type: 'conversation:created', seq: 43, conversationId: 'abc', summary: { title, agent, project, createdAt } }`
- System event shape: `{ type: 'system:full-refresh', seq: 44 }`
- Consumer pattern: `const { on } = useWebSocket(); on('conversation:changed', (evt) => { if (evt.conversationId === currentId) refetch() })`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/plugins/websocket.ts`: @fastify/websocket plugin with broadcast() decorator — extend with typed event emission
- `packages/frontend/src/composables/useWebSocket.ts`: Singleton composable with exponential backoff reconnection, tab visibility awareness — refactor to typed event routing
- `packages/frontend/src/components/ConnectionStatus.vue`: Connection state indicator — no changes needed

### Established Patterns
- Singleton composable pattern (module-level state, shared across components) — maintain for useWebSocket
- Notify-then-fetch pattern (WebSocket notifies, HTTP endpoints serve data) — maintain, events just become more specific
- onScopeDispose for cleanup — extend to auto-cleanup event subscriptions
- Server→client only (no client-to-server messages) — maintain

### Integration Points
- `packages/backend/src/app.ts`: onIngestionComplete callback currently broadcasts data-changed — replace with typed event emission
- `packages/backend/src/routes/settings.ts`: clear-db and refresh-db routes broadcast data-changed — replace with system:full-refresh
- 6 frontend composables subscribe to onDataChanged() — all migrate to on(type, callback)
- `packages/shared/src/types/index.ts`: Add WebSocket event type definitions here

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-websocket-event-infrastructure*
*Context gathered: 2026-03-10*
