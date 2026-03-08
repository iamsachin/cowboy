# Phase 10: Data Grouping Foundation - Research

**Researched:** 2026-03-05
**Domain:** Vue 3 data transformation + DaisyUI card layout for conversation grouping
**Confidence:** HIGH

## Summary

Phase 10 transforms the flat timeline in `ConversationDetail.vue` into grouped Turn objects. The current code interleaves `MessageRow[]` and `ToolCallRow[]` sorted by timestamp. The new code must group assistant messages with their linked tool calls (via `messageId` FK), handle orphaned tool calls, and render each group as a subtle card container.

This is a pure frontend transformation -- no backend changes needed. The `ConversationDetailResponse` API already returns separate `messages[]` and `toolCalls[]` arrays with the `messageId` FK on each tool call. The grouping logic is a computed property or composable that produces `Turn[]` from these two arrays.

**Primary recommendation:** Create a `useGroupedTurns` composable that takes `messages[]` and `toolCalls[]` and returns `Turn[]`. Replace the flat timeline rendering in `ConversationDetail.vue` with a `TurnCard.vue` component for assistant turns while keeping user messages as existing chat bubbles.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Assistant turns wrapped in subtle card containers: base-200 background tint + thin border
- User messages keep existing chat-end bubbles -- no card treatment
- Visual hierarchy: user asks (bubble) -> assistant responds (card block)
- Assistant output text renders directly inside the card as plain text -- no nested chat bubble inside the card
- Tool calls shown as compact list of rows inside the turn card: icon + name + status + duration
- Tool call list is always visible below the assistant text (not collapsed)
- No expand/collapse on individual tool calls yet -- Phase 11 adds progressive disclosure
- Thinking content moves inside the turn card (above assistant text, collapsed) -- keeps everything about one turn together
- Conversation-first layout -- still feels like reading a chat, not a structured log
- User bubbles on the right, assistant card blocks on the left, linear flow
- Like Slack threads with richer assistant blocks
- Tool calls with messageId mismatch attach to the nearest preceding assistant turn (per success criteria)
- Consecutive assistant messages without an intervening user message produce separate turn groups (per success criteria)

### Claude's Discretion
- Card width (full-width vs 85% max-width -- pick what looks best with tool call lists and code blocks)
- Whether text-only assistant turns (no tool calls) get cards or stay as plain chat bubbles -- pick what looks more consistent with Phase 11's collapsible headers coming next
- Whether to include a minimal header (role + timestamp) on each card or defer all header elements to Phase 11
- Long tool call list handling (show all vs cap with "show more")

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GROUP-01 | User sees all items in an assistant turn (output, thinking, tool calls) grouped into a single collapsible response block | Grouping composable (`useGroupedTurns`) produces Turn objects linking message + thinking + tool calls; TurnCard.vue renders them as a card |
| GROUP-02 | User sees the main agent output text without expanding the response block | Assistant text renders directly in the card body as plain text (not inside a collapsible); `parseContent` logic reused from ChatMessage.vue |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | ^3.5.0 | Reactive UI framework | Already in use, `computed` for derived data |
| DaisyUI | ^5.5.0 | Card + badge + layout components | Already in use, `card`, `badge` classes |
| Tailwind CSS | ^4.2.0 | Utility-first styling | Already in use |
| lucide-vue-next | latest | Icons for tool call rows | Already in use (Brain, Wrench icons) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @cowboy/shared | workspace:* | MessageRow, ToolCallRow types | Type imports for grouping logic |
| vitest | (dev) | Unit tests for grouping logic | Testing the composable |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Composable for grouping | Inline computed in component | Composable is testable in isolation, reusable |
| DaisyUI card classes | Custom div styling | Cards provide consistent theming with base-200/border |

## Architecture Patterns

### Recommended Project Structure
```
packages/frontend/src/
  composables/
    useGroupedTurns.ts       # NEW: messages[] + toolCalls[] -> Turn[]
  components/
    ConversationDetail.vue   # MODIFIED: renders Turn[] instead of flat timeline
    TurnCard.vue             # NEW: assistant turn card (text + thinking + tool calls)
    ToolCallRow.vue          # NEW: compact tool call row (icon + name + status + duration)
    ChatMessage.vue          # MODIFIED: user messages only (remove thinking rendering)
  types/
    turns.ts                 # NEW: Turn, UserTurn, AssistantTurn interfaces (or inline in composable)
```

### Pattern 1: Turn Grouping Algorithm
**What:** Transform flat messages[] + toolCalls[] into ordered Turn[] array
**When to use:** Every time ConversationDetail receives data

The algorithm:
1. Build a Map<messageId, ToolCallRow[]> from toolCalls
2. Sort messages by createdAt
3. Walk messages in order:
   - User message -> UserTurn { role: 'user', message }
   - Assistant message -> AssistantTurn { role: 'assistant', message, toolCalls: map.get(msg.id) || [] }
4. After all messages processed, find orphan tool calls (messageId not in any message)
5. Attach orphans to the nearest preceding assistant turn by timestamp
6. Key rule: consecutive assistant messages produce SEPARATE turns (never merge)

```typescript
// useGroupedTurns.ts
export interface UserTurn {
  type: 'user';
  message: MessageRow;
}

export interface AssistantTurn {
  type: 'assistant';
  message: MessageRow;
  toolCalls: ToolCallRow[];
}

export type Turn = UserTurn | AssistantTurn;

export function groupTurns(messages: MessageRow[], toolCalls: ToolCallRow[]): Turn[] {
  // 1. Index tool calls by messageId
  const tcByMsg = new Map<string, ToolCallRow[]>();
  const messageIds = new Set(messages.map(m => m.id));
  const orphans: ToolCallRow[] = [];

  for (const tc of toolCalls) {
    if (messageIds.has(tc.messageId)) {
      const list = tcByMsg.get(tc.messageId) || [];
      list.push(tc);
      tcByMsg.set(tc.messageId, list);
    } else {
      orphans.push(tc);
    }
  }

  // 2. Build turns from sorted messages
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const turns: Turn[] = [];
  for (const msg of sorted) {
    if (msg.role === 'user') {
      turns.push({ type: 'user', message: msg });
    } else {
      const tcs = tcByMsg.get(msg.id) || [];
      tcs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      turns.push({ type: 'assistant', message: msg, toolCalls: tcs });
    }
  }

  // 3. Attach orphans to nearest preceding assistant turn
  for (const orphan of orphans) {
    const orphanTime = new Date(orphan.createdAt).getTime();
    let bestTurn: AssistantTurn | null = null;
    for (const turn of turns) {
      if (turn.type === 'assistant') {
        const turnTime = new Date(turn.message.createdAt).getTime();
        if (turnTime <= orphanTime) {
          bestTurn = turn;
        }
      }
    }
    if (bestTurn) {
      bestTurn.toolCalls.push(orphan);
      bestTurn.toolCalls.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }
    // If no preceding assistant turn, orphan is dropped (edge case)
  }

  return turns;
}
```

### Pattern 2: TurnCard Component Structure
**What:** Card component for assistant turns with thinking + text + tool call rows
**When to use:** Rendering each AssistantTurn in the grouped view

```vue
<!-- TurnCard.vue structure -->
<div class="bg-base-200 border border-base-300 rounded-lg p-4 max-w-[85%]">
  <!-- Thinking (collapsed, above text) -->
  <details v-if="turn.message.thinking" class="mb-2">
    <summary class="text-sm cursor-pointer flex items-center gap-2">
      <Brain class="w-4 h-4 text-info" /> Thinking
    </summary>
    <pre class="text-xs whitespace-pre-wrap mt-2">{{ turn.message.thinking }}</pre>
  </details>

  <!-- Assistant text (always visible) -->
  <div class="text-sm">
    <!-- reuse parseContent logic from ChatMessage.vue -->
  </div>

  <!-- Tool call compact rows (always visible) -->
  <div v-if="turn.toolCalls.length" class="mt-3 space-y-1">
    <ToolCallRow v-for="tc in turn.toolCalls" :key="tc.id" :toolCall="tc" />
  </div>
</div>
```

### Pattern 3: Compact Tool Call Row
**What:** Replaces the existing collapsible ToolCallCard with a single-line row
**When to use:** Inside TurnCard for each tool call

```vue
<!-- ToolCallRow.vue -->
<div class="flex items-center gap-2 text-xs py-1 px-2 rounded bg-base-300/50">
  <Wrench class="w-3.5 h-3.5 text-info shrink-0" />
  <span class="truncate font-medium">{{ toolCall.name }}</span>
  <span class="badge badge-xs" :class="statusClass">{{ toolCall.status || 'unknown' }}</span>
  <span v-if="toolCall.duration != null" class="ml-auto text-base-content/50">
    {{ toolCall.duration }}ms
  </span>
</div>
```

### Anti-Patterns to Avoid
- **Merging consecutive assistant messages:** Success criteria explicitly requires separate turn groups for consecutive assistant messages without an intervening user message.
- **Dropping orphan tool calls:** Must attach to nearest preceding assistant turn, not silently discard.
- **Nested chat bubbles inside cards:** User decided assistant text renders directly in the card, not wrapped in DaisyUI `chat-bubble` class.
- **Using DaisyUI checkbox collapse for thinking:** STATE.md notes `details/summary` is preferred (DaisyUI checkbox collapse has nesting bugs).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card styling | Custom CSS card | DaisyUI `bg-base-200 border border-base-300 rounded-lg` | Theme-consistent, auto dark mode |
| Status badges | Custom span styling | DaisyUI `badge badge-sm badge-success/badge-warning` | Already used in ToolCallCard.vue |
| Collapsible thinking | Custom toggle state | Native `<details>/<summary>` HTML elements | STATE.md decision: avoids DaisyUI checkbox collapse nesting bugs |
| Icons | Custom SVGs | `lucide-vue-next` (Wrench, Brain, etc.) | Already imported throughout the project |
| Content parsing | New parser | Reuse `parseContent` + `stripXmlTags` from ChatMessage.vue | Battle-tested, handles code blocks + XML |

**Key insight:** This phase is almost entirely data transformation + template refactoring. There are no new libraries to add. The complexity is in the grouping algorithm (especially orphan handling) and getting the card layout right.

## Common Pitfalls

### Pitfall 1: Empty Assistant Messages Creating Blank Cards
**What goes wrong:** Assistant messages with null/empty content after `stripXmlTags` render as empty cards
**Why it happens:** Some assistant messages are metadata-only (system prompts, etc.)
**How to avoid:** Filter empty assistant messages in the grouping logic, same as current `isEmptyMessage` check. If the message has tool calls but empty content, still show the card but with just tool call rows.
**Warning signs:** Blank cards with no text appearing in the conversation view

### Pitfall 2: Tool Call Sort Order Within a Turn
**What goes wrong:** Tool calls appear in wrong order within a turn card
**Why it happens:** The Map grouping doesn't preserve insertion order relative to timestamps
**How to avoid:** Sort tool calls within each turn by `createdAt` after grouping
**Warning signs:** Tool calls showing in random order, not matching execution sequence

### Pitfall 3: Thinking Content Losing Collapse State on Rerender
**What goes wrong:** Native `<details>` elements reset open/close state when Vue re-renders
**Why it happens:** Vue's virtual DOM reconciliation may recreate the element
**How to avoid:** Use `:key` on the turn to prevent unnecessary re-renders. For Phase 10, this is acceptable since the data doesn't change after load. Phase 11 will add controlled state.
**Warning signs:** Thinking sections snapping closed when other parts of the UI update

### Pitfall 4: parseContent Function Coupling
**What goes wrong:** Duplicating `parseContent` logic from ChatMessage.vue into TurnCard.vue
**Why it happens:** Temptation to copy-paste rather than extract
**How to avoid:** Extract `parseContent` into a shared utility (e.g., `utils/content-parser.ts`) or keep it in ChatMessage and import, or recreate it in TurnCard. Since ChatMessage.vue is being simplified (user messages only), consider moving the function to a utility.
**Warning signs:** Same parsing logic in two components

### Pitfall 5: Breaking User Message Rendering
**What goes wrong:** Refactoring ConversationDetail breaks user message chat bubbles
**Why it happens:** User messages should stay as-is with `chat chat-end` DaisyUI classes
**How to avoid:** Keep ChatMessage.vue for user messages (or create a minimal UserBubble). Only change how assistant messages render.
**Warning signs:** User messages losing their right-aligned bubble styling

## Code Examples

### Existing Data Flow (verified from source)
```typescript
// ConversationDetailPage.vue passes data to ConversationDetail.vue
// data.messages: MessageRow[] and data.toolCalls: ToolCallRow[]
// MessageRow: { id, role, content, thinking, createdAt, model }
// ToolCallRow: { id, messageId, name, input, output, status, duration, createdAt }
```

### Refactored ConversationDetail.vue
```vue
<template>
  <div class="space-y-3">
    <template v-for="turn in turns" :key="turn.message.id">
      <ChatMessage
        v-if="turn.type === 'user'"
        :message="turn.message"
      />
      <TurnCard
        v-else
        :turn="turn"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MessageRow, ToolCallRow } from '@cowboy/shared';
import ChatMessage from './ChatMessage.vue';
import TurnCard from './TurnCard.vue';
import { groupTurns } from '../composables/useGroupedTurns';

const props = defineProps<{
  messages: MessageRow[];
  toolCalls: ToolCallRow[];
}>();

const turns = computed(() => groupTurns(props.messages, props.toolCalls));
</script>
```

### Discretion Recommendations

**Card width:** Use `max-w-[85%]` to match existing ChatMessage constraint. Code blocks and tool call lists render well at this width, and it maintains visual consistency.

**Text-only assistant turns:** Give them cards too (not plain bubbles). Phase 11 adds collapsible headers to all cards. Switching between bubble and card for text-only vs tool-call turns would create inconsistency and require rework.

**Minimal header:** Include a minimal header with role label + timestamp. This is lightweight (one line of text), provides context for each turn, and aligns with the existing `chat-header` pattern. Phase 11 will enrich it with model name, tool count, etc.

**Long tool call lists:** Show all tool calls (no cap). Most assistant turns have <10 tool calls. Capping adds complexity for little value. If performance becomes an issue, Phase 11's collapse behavior will hide them anyway.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DaisyUI checkbox collapse | Native `<details>/<summary>` | v1.1 decision (STATE.md) | Avoid nesting bugs with DaisyUI collapse |
| Flat timeline of items | Grouped Turn[] rendering | Phase 10 (this phase) | Core architectural shift for conversation view |

**Deprecated/outdated:**
- ToolCallCard.vue (collapsible card with input/output JSON): Replaced by compact ToolCallRow.vue in Phase 10. The expand-to-see-details behavior moves to Phase 11 (GROUP-06).

## Open Questions

1. **Should `parseContent` be extracted to a utility or stay in components?**
   - What we know: Currently defined inline in ChatMessage.vue. TurnCard.vue needs the same logic.
   - What's unclear: Whether to extract to `utils/content-parser.ts` or duplicate.
   - Recommendation: Extract to utility. Both ChatMessage (for user messages with code blocks) and TurnCard (for assistant content) need it.

2. **Edge case: assistant message with no content but has tool calls**
   - What we know: Current `isEmptyMessage` filter removes these from the timeline
   - What's unclear: Should a turn card show if the assistant message text is empty but it has associated tool calls?
   - Recommendation: Yes, show the card with just the tool call rows. The tool calls are valuable context. Only skip truly empty turns (no content AND no tool calls).

3. **Edge case: orphan tool calls with no preceding assistant turn**
   - What we know: Orphan algorithm attaches to "nearest preceding" assistant turn
   - What's unclear: What if the orphan appears before any assistant message in the conversation?
   - Recommendation: Drop silently. This is an extreme edge case (would mean tool calls before any assistant response). Could also attach to the first assistant turn if one exists.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (via frontend package) |
| Config file | `packages/frontend/vitest.config.ts` |
| Quick run command | `cd packages/frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/frontend && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GROUP-01 | Assistant messages grouped with tool calls into Turn objects | unit | `cd packages/frontend && npx vitest run tests/composables/useGroupedTurns.test.ts -x` | No - Wave 0 |
| GROUP-01 | Orphan tool calls attached to nearest preceding assistant turn | unit | `cd packages/frontend && npx vitest run tests/composables/useGroupedTurns.test.ts -x` | No - Wave 0 |
| GROUP-01 | Consecutive assistant messages produce separate turn groups | unit | `cd packages/frontend && npx vitest run tests/composables/useGroupedTurns.test.ts -x` | No - Wave 0 |
| GROUP-02 | Assistant text visible without expanding (rendering) | manual-only | Visual inspection: open conversation detail, verify text visible | N/A |

### Sampling Rate
- **Per task commit:** `cd packages/frontend && npx vitest run tests/composables/useGroupedTurns.test.ts`
- **Per wave merge:** `cd packages/frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/frontend/tests/composables/useGroupedTurns.test.ts` -- covers GROUP-01 grouping logic, orphan handling, consecutive assistant separation
- [ ] Extract `groupTurns` as a pure function (not just a composable) so it's testable without Vue reactivity

## Sources

### Primary (HIGH confidence)
- Project source code: `ConversationDetail.vue`, `ChatMessage.vue`, `ToolCallCard.vue`, `useConversationDetail.ts` -- read directly
- Shared types: `MessageRow`, `ToolCallRow`, `ConversationDetailResponse` -- read from `@cowboy/shared`
- Project decisions: `STATE.md`, `CONTEXT.md`, `REQUIREMENTS.md` -- read directly
- DaisyUI skill: `.claude/skills/daisyui/SKILL.md` -- card, badge, theme patterns

### Secondary (MEDIUM confidence)
- DaisyUI 5 card component classes (bg-base-200, border-base-300) -- consistent with existing usage in project

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all existing dependencies
- Architecture: HIGH - straightforward data transformation, clear types and FK relationships
- Pitfalls: HIGH - derived from reading actual source code and understanding the data model

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain, no external dependencies changing)
