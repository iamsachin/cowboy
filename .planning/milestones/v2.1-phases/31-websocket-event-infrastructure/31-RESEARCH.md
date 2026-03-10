# Phase 31: WebSocket Event Infrastructure - Research

**Researched:** 2026-03-10
**Domain:** WebSocket typed event system (Fastify backend + Vue 3 frontend)
**Confidence:** HIGH

## Summary

This phase replaces the untyped `data-changed` WebSocket broadcast with a typed, conversation-scoped event system. The current architecture is simple: backend calls `app.broadcast({ type: 'data-changed' })` after ingestion, and all 7 frontend composables blindly refetch everything. The new system introduces three event types (`conversation:changed`, `conversation:created`, `system:full-refresh`) with shared TypeScript definitions in the `@cowboy/shared` package, a sequence-number-based gap detection mechanism, and a type-routed `on(type, callback)` API replacing the flat `onDataChanged()` pattern.

The backend challenge is **determining what changed** during ingestion. The current ingestion loop uses `onConflictDoNothing` for messages/toolCalls/tokenUsage and `onConflictDoUpdate` for conversations, but never tracks which conversations were modified or created. The ingestion callback fires once at the end of the entire ingestion run -- not per-conversation. The diff strategy must be added to the ingestion loop itself.

The frontend challenge is migrating all 7 composables (useAnalytics, useConversationBrowser, usePlans, useConversationDetail, useAgentAnalytics, useAdvancedAnalytics, useAgentComparison) from the flat listener pattern to typed event handlers, and implementing sequence-number gap detection internally in useWebSocket.

**Primary recommendation:** Build bottom-up: shared types first, then backend event emission, then frontend composable refactor. The ingestion diff strategy should use a pre-ingestion snapshot of conversation `updatedAt` values compared against post-transaction values.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fine-grained event types: message-added, tool-call-added, tokens-updated, plan-updated, status-changed, metadata-changed, plus conversation:created
- All event types implemented in Phase 31 (not deferred to later phases)
- Events batched per conversation per ingestion cycle -- one `conversation:changed` event with a `changes` array listing what changed
- Settings operations (clear-db, refresh-db) emit `system:full-refresh` instead of conversation events
- Big-bang replacement -- remove `data-changed` entirely for ingestion events
- All 7 composables migrate to typed event handlers in this phase
- Smart refetch -- each composable checks if the event is relevant before refetching
- Replace composable API entirely -- remove `onDataChanged()`, add `on(type, callback)` pattern
- Minimal payloads for `conversation:changed` -- just conversationId + changes array + timestamp + sequence number
- `conversation:created` includes summary data (title, agent, project, createdAt) so list can insert without full refetch
- `system:full-refresh` for settings operations
- Monotonic sequence numbers on all events -- frontend detects gaps and triggers automatic full refetch
- Type-specific callback registration: `on('conversation:changed', callback)`
- `on()` returns unsubscribe function AND auto-cleanup via onScopeDispose (both available)
- Sequence number tracking and gap detection handled internally by composable
- On gap detection, composable automatically emits system:full-refresh to all listeners
- Event interfaces and discriminated union exported from shared package
- Type guard functions exported alongside interfaces
- ConnectionStatus component: keep as-is

### Claude's Discretion
- Internal event bus implementation details
- Sequence number reset strategy on reconnect
- Exact change type taxonomy naming conventions
- How ingestion determines which changes occurred (diff strategy)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PUSH-02 | Backend broadcasts conversation IDs in WebSocket payload so detail page only refetches when its conversation is updated | Typed `conversation:changed` event with `conversationId` field; smart refetch pattern in composables; shared type definitions ensure type safety |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @fastify/websocket | ^11.2.0 | WebSocket server | Already in use; provides broadcast via `websocketServer.clients` |
| ws | ^8.19.0 | WebSocket implementation | Already in use; peer dep of @fastify/websocket |
| vue | ^3.5.0 | Frontend framework | Already in use; reactive refs, onScopeDispose |
| @cowboy/shared | workspace:* | Shared type definitions | Monorepo shared package; already exists |
| vitest | (dev) | Test framework | Already used for both backend and frontend tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fastify-plugin (fp) | ^5.1.0 | Break encapsulation for broadcast decorator | Already in use in websocket plugin |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom event bus | mitt / tiny-emitter | Unnecessary dependency for < 50 lines of routing logic |
| JSON sequence numbers | WebSocket message ID headers | Non-standard; JSON payload is simpler and already the pattern |

**Installation:**
No new dependencies needed. All required libraries are already installed.

## Architecture Patterns

### Recommended Project Structure
```
packages/shared/src/types/
├── index.ts              # Re-export websocket-events
├── websocket-events.ts   # Event interfaces, union type, type guards
packages/backend/src/
├── plugins/websocket.ts  # Refactored: typed broadcast, sequence counter
├── ingestion/index.ts    # Modified: track changes per conversation, emit typed events
├── routes/settings.ts    # Modified: emit system:full-refresh
├── app.ts                # Modified: pass typed event emitter to ingestion
packages/frontend/src/
├── composables/useWebSocket.ts  # Refactored: on(type, cb), sequence tracking
```

### Pattern 1: Shared Event Type Definitions (Discriminated Union)
**What:** All WebSocket event types defined as a discriminated union in shared package
**When to use:** Every event emitted by backend or consumed by frontend
**Example:**
```typescript
// packages/shared/src/types/websocket-events.ts

export type ChangeType =
  | 'messages-added'
  | 'tool-calls-added'
  | 'tokens-updated'
  | 'plan-updated'
  | 'status-changed'
  | 'metadata-changed';

export interface ConversationChangedEvent {
  type: 'conversation:changed';
  seq: number;
  conversationId: string;
  changes: ChangeType[];
  timestamp: string;
}

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

export interface SystemFullRefreshEvent {
  type: 'system:full-refresh';
  seq: number;
  timestamp: string;
}

export type WebSocketEvent =
  | ConversationChangedEvent
  | ConversationCreatedEvent
  | SystemFullRefreshEvent;

export type WebSocketEventType = WebSocketEvent['type'];

// Type guards
export function isConversationChanged(e: WebSocketEvent): e is ConversationChangedEvent {
  return e.type === 'conversation:changed';
}
export function isConversationCreated(e: WebSocketEvent): e is ConversationCreatedEvent {
  return e.type === 'conversation:created';
}
export function isSystemFullRefresh(e: WebSocketEvent): e is SystemFullRefreshEvent {
  return e.type === 'system:full-refresh';
}
```

### Pattern 2: Ingestion Diff Strategy (Pre/Post Snapshot)
**What:** Before processing each conversation file, snapshot existing DB state; after transaction, compare to determine what changed
**When to use:** Inside the ingestion loop for each conversation
**Example:**
```typescript
// Inside runIngestion() per-conversation loop:

// 1. Before transaction: snapshot existing state
const existingConv = db.select({ id: conversations.id, updatedAt: conversations.updatedAt })
  .from(conversations)
  .where(eq(conversations.id, normalizedData.conversation.id))
  .get();

const existingMsgCount = existingConv ? db.select({ count: sql<number>`count(*)` })
  .from(messages)
  .where(eq(messages.conversationId, normalizedData.conversation.id))
  .all()[0].count : 0;

// ... (similar for toolCalls, tokenUsage, plans)

// 2. Run transaction (existing code)
db.transaction((tx) => { /* ... existing insert/upsert logic ... */ });

// 3. After transaction: compare
const isNew = !existingConv;
const changes: ChangeType[] = [];

if (!isNew) {
  const newMsgCount = db.select({ count: sql<number>`count(*)` })
    .from(messages).where(eq(messages.conversationId, normalizedData.conversation.id))
    .all()[0].count;
  if (newMsgCount > existingMsgCount) changes.push('messages-added');
  // ... similar diffs for tool-calls, tokens, plans, status, metadata
}

// 4. Collect into per-run results
if (isNew) {
  createdConversations.push({ id: normalizedData.conversation.id, summary: { ... } });
} else if (changes.length > 0) {
  changedConversations.push({ id: normalizedData.conversation.id, changes });
}
```

### Pattern 3: Backend Sequence Counter (Module-Level Monotonic)
**What:** Module-level counter incremented per event broadcast; resets on server restart
**When to use:** Every event emission
**Example:**
```typescript
// In websocket.ts plugin
let seq = 0;

app.decorate('broadcastEvent', (event: Omit<WebSocketEvent, 'seq'>) => {
  const payload = JSON.stringify({ ...event, seq: ++seq });
  for (const client of app.websocketServer.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
});
```

### Pattern 4: Frontend Typed Event Router
**What:** Map of event type -> Set of callbacks, replacing flat listener set
**When to use:** useWebSocket composable
**Example:**
```typescript
// Module-level state
type EventCallback<T extends WebSocketEventType> = (
  event: Extract<WebSocketEvent, { type: T }>
) => void;

const listeners = new Map<string, Set<(event: any) => void>>();
let lastSeq = 0;

function on<T extends WebSocketEventType>(
  type: T,
  callback: EventCallback<T>,
): () => void {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type)!.add(callback);

  const unsubscribe = () => { listeners.get(type)?.delete(callback); };

  // Auto-cleanup if in Vue effect scope
  if (getCurrentScope()) {
    onScopeDispose(unsubscribe);
  }

  return unsubscribe;
}

// In onmessage handler:
function handleMessage(event: MessageEvent) {
  const msg = JSON.parse(event.data) as WebSocketEvent;

  // Gap detection
  if (msg.seq > lastSeq + 1 && lastSeq > 0) {
    // Gap detected -- fire full-refresh to all listeners
    const refreshEvent: SystemFullRefreshEvent = {
      type: 'system:full-refresh',
      seq: msg.seq,
      timestamp: new Date().toISOString(),
    };
    listeners.get('system:full-refresh')?.forEach(cb => cb(refreshEvent));
  }
  lastSeq = msg.seq;

  // Route to type-specific listeners
  listeners.get(msg.type)?.forEach(cb => cb(msg));
}
```

### Pattern 5: Composable Smart Refetch Migration
**What:** Each composable subscribes to specific event types and checks relevance
**When to use:** All 7 migrated composables
**Example:**
```typescript
// useConversationDetail.ts (conversation-scoped)
const { on } = useWebSocket();
on('conversation:changed', (evt) => {
  if (evt.conversationId === conversationId.value) refetch();
});
on('system:full-refresh', () => refetch());

// useAnalytics.ts (global -- refetch on any change)
const { on } = useWebSocket();
on('conversation:changed', () => fetchAll());
on('conversation:created', () => fetchAll());
on('system:full-refresh', () => fetchAll());
```

### Anti-Patterns to Avoid
- **Sending full data over WebSocket:** Maintain notify-then-fetch pattern. Events contain IDs and metadata, not conversation content.
- **Per-message events during ingestion:** The ingestion loop processes entire files at once. Batching changes per conversation per ingestion cycle is correct.
- **Sequence numbers in frontend state:** Sequence tracking is internal to useWebSocket. Consumers never see sequence numbers.
- **Forgetting visibility-change catch-up:** When tab becomes visible, the current code fires all listeners. New code must fire `system:full-refresh` to all registered listeners instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket reconnection | Custom reconnect logic | Existing exponential backoff in useWebSocket | Already battle-tested with jitter and visibility awareness |
| Event serialization | Custom binary protocol | JSON.stringify/parse | Already the pattern; events are small; localhost only |
| Type narrowing | Manual type checks | Discriminated union + type guards from shared | TypeScript does this automatically with discriminated unions |

**Key insight:** The existing WebSocket infrastructure (reconnection, visibility handling, broadcast) is solid. This phase extends it with typed routing, not replaces it.

## Common Pitfalls

### Pitfall 1: Ingestion Fires Once, Not Per-Conversation
**What goes wrong:** Attempting to emit events inside the per-file loop while `onIngestionComplete` fires once at the end.
**Why it happens:** Current callback architecture is post-ingestion, not per-conversation.
**How to avoid:** Collect all changes during the ingestion loop into an array, then emit all events in the `onIngestionComplete` callback (or replace callback with a richer interface that receives the change set).
**Warning signs:** Events emitted before ingestion finishes; events emitted inside transaction.

### Pitfall 2: Sequence Gap on Server Restart
**What goes wrong:** Server restarts, seq resets to 0. Frontend sees seq go backwards, triggers endless full-refresh.
**Why it happens:** Module-level counter resets on restart.
**How to avoid:** On reconnect, frontend resets `lastSeq` to 0. The `connected` message (already sent on connection) serves as the signal. After reconnect, first event's seq becomes the new baseline.
**Warning signs:** Full-refresh storm after server restart.

### Pitfall 3: Visibility Change Must Use New Event System
**What goes wrong:** Tab returns to visibility, old code fires flat listeners, new code expects typed events.
**Why it happens:** Half-migrated visibility handler still calls `listeners.forEach(cb => cb())`.
**How to avoid:** Replace visibility catch-up with emitting a synthetic `system:full-refresh` to all registered type listeners.
**Warning signs:** Composables not refreshing when tab becomes visible.

### Pitfall 4: onConflictDoNothing Hides Insertions
**What goes wrong:** Count-based diff shows no change because `onConflictDoNothing` means duplicate inserts don't increase count, but new messages for an existing conversation do.
**Why it happens:** The diff compares pre/post counts, but `onConflictDoNothing` means only truly new rows increase the count.
**How to avoid:** This is actually correct behavior -- if count didn't change, nothing new was added. The diff strategy works because `onConflictDoNothing` naturally filters duplicates.
**Warning signs:** None; this is a false concern.

### Pitfall 5: Breaking Existing Tests
**What goes wrong:** Backend websocket.test.ts and frontend useWebSocket.test.ts assert on `data-changed` type and `onDataChanged` API.
**Why it happens:** Big-bang migration changes both the event shape and the composable API.
**How to avoid:** Update all test files in the same commit as the implementation. Backend test must assert typed events. Frontend test must use `on(type, callback)` API.
**Warning signs:** Tests fail with "onDataChanged is not a function."

### Pitfall 6: Race Between Ingestion and Event Emission
**What goes wrong:** Events emitted via `app.broadcast` before the DB transaction is committed.
**Why it happens:** If events are emitted inside the transaction or before it completes.
**How to avoid:** Collect changes during the loop, emit events only in `onIngestionComplete` (which fires after `finally` block).
**Warning signs:** Frontend fetches data that hasn't been committed yet; stale responses.

## Code Examples

### Current Backend Emission (to be replaced)
```typescript
// packages/backend/src/app.ts line 39-41
onIngestionComplete: () => {
  app.broadcast({ type: 'data-changed', timestamp: new Date().toISOString() });
},
```

### Current Frontend Consumption (to be replaced)
```typescript
// packages/frontend/src/composables/useAnalytics.ts lines 62-66
const { onDataChanged } = useWebSocket();
const unsubscribe = onDataChanged(() => {
  fetchAll();
});
onScopeDispose(unsubscribe);
```

### Composables to Migrate (all 7)
| Composable | Current Pattern | New Pattern | Event Types |
|------------|----------------|-------------|-------------|
| useAnalytics | `onDataChanged(() => fetchAll())` | `on('conversation:changed', fetchAll); on('conversation:created', fetchAll); on('system:full-refresh', fetchAll)` | All three |
| useConversationBrowser | `onDataChanged(() => fetchConversations())` | Same as analytics -- list needs all events | All three |
| usePlans | `onDataChanged(() => fetchAll())` | Same as analytics | All three |
| useConversationDetail | Not currently subscribed | `on('conversation:changed', (e) => { if (e.conversationId === id) refetch() })` | changed + full-refresh |
| useAgentAnalytics | `onDataChanged(() => fetchAll())` | Same as analytics | All three |
| useAdvancedAnalytics | `onDataChanged(() => fetchAll())` | Same as analytics | All three |
| useAgentComparison | `onDataChanged(() => fetchAll())` | Same as analytics | All three |

### Settings Routes Emission Points
```typescript
// packages/backend/src/routes/settings.ts
// clear-db (line 194): replace { type: 'data-changed' } with system:full-refresh
// refresh-db (line 210): replace { type: 'data-changed' } with system:full-refresh
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Untyped `data-changed` broadcast | Typed conversation-scoped events | This phase | Enables smart refetch; foundation for PUSH-01/03/04/05 |
| Flat `onDataChanged()` listeners | `on(type, callback)` routing | This phase | Type-safe, composable-specific event handling |
| No sequence tracking | Monotonic seq + gap detection | This phase | Automatic recovery from missed events |

**Deprecated/outdated:**
- `data-changed` event type: removed entirely after this phase
- `onDataChanged()` API: replaced by `on(type, callback)`

## Open Questions

1. **onIngestionComplete callback signature change**
   - What we know: Current signature is `() => void`. It needs to receive the change set.
   - What's unclear: Should we pass the changes as a parameter to the callback, or refactor to have ingestion call `app.broadcastEvent()` directly?
   - Recommendation: Change `onIngestionComplete` to accept a changes array parameter: `onIngestionComplete: (changes: WebSocketEvent[]) => void`. The callback in app.ts then iterates and broadcasts each event. This keeps event emission in app.ts (not buried in ingestion plugin).

2. **Cursor ingestion diff tracking**
   - What we know: Cursor conversations are processed in a separate loop within the same `runIngestion()`.
   - What's unclear: Same diff strategy applies but the code path is duplicated.
   - Recommendation: Extract a `trackChanges()` helper used by both Claude Code and Cursor ingestion loops to avoid duplication.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (latest, workspace config) |
| Config file | `packages/backend/vitest.config.ts`, `packages/frontend/vitest.config.ts` |
| Quick run command | `cd packages/backend && npx vitest run tests/websocket.test.ts` |
| Full suite command | `cd packages/backend && npx vitest run && cd ../frontend && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUSH-02a | Backend emits typed conversation:changed with conversationId | integration | `cd packages/backend && npx vitest run tests/websocket.test.ts -x` | Exists (needs update) |
| PUSH-02b | Backend emits conversation:created for new conversations | integration | `cd packages/backend && npx vitest run tests/websocket.test.ts -x` | Exists (needs update) |
| PUSH-02c | Backend emits system:full-refresh for settings operations | integration | `cd packages/backend && npx vitest run tests/settings/settings-api.test.ts -x` | Exists (needs update) |
| PUSH-02d | Frontend on() routes typed events to callbacks | unit | `cd packages/frontend && npx vitest run tests/composables/useWebSocket.test.ts -x` | Exists (needs update) |
| PUSH-02e | Frontend gap detection triggers full-refresh | unit | `cd packages/frontend && npx vitest run tests/composables/useWebSocket.test.ts -x` | Exists (needs update) |
| PUSH-02f | Shared type definitions compile correctly | unit | `cd packages/shared && npx tsc --noEmit` | Wave 0 |
| PUSH-02g | Events have monotonic sequence numbers | integration | `cd packages/backend && npx vitest run tests/websocket.test.ts -x` | Exists (needs update) |

### Sampling Rate
- **Per task commit:** `cd packages/backend && npx vitest run tests/websocket.test.ts && cd ../frontend && npx vitest run tests/composables/useWebSocket.test.ts`
- **Per wave merge:** `cd packages/backend && npx vitest run && cd ../frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/shared/src/types/websocket-events.ts` -- shared type definitions (new file)
- [ ] Update `packages/backend/tests/websocket.test.ts` -- assert typed events instead of `data-changed`
- [ ] Update `packages/frontend/tests/composables/useWebSocket.test.ts` -- test `on(type, cb)` API, gap detection, reconnect seq reset

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files listed in Code Examples section
- `packages/backend/src/plugins/websocket.ts` -- current broadcast implementation (44 lines)
- `packages/backend/src/ingestion/index.ts` -- current ingestion loop and onIngestionComplete callback (486 lines)
- `packages/frontend/src/composables/useWebSocket.ts` -- current composable (133 lines)
- `packages/shared/src/types/index.ts` -- current shared type exports
- All 7 composable files showing `onDataChanged` usage pattern
- `packages/backend/src/routes/settings.ts` -- settings broadcast points (lines 194, 210)
- `packages/backend/src/app.ts` -- onIngestionComplete wiring (line 39)

### Secondary (MEDIUM confidence)
- @fastify/websocket docs -- broadcast pattern via `websocketServer.clients`
- Vue 3 Composition API -- `onScopeDispose`, `getCurrentScope` for auto-cleanup

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- patterns derived directly from existing codebase analysis
- Pitfalls: HIGH -- identified from concrete code paths (ingestion loop, visibility handler, test files)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain; no external dependencies changing)
