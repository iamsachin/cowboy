# Phase 11: Core Collapsible UI - Research

**Researched:** 2026-03-05
**Domain:** Vue 3 collapsible UI with reactive state management, DaisyUI 5 styling
**Confidence:** HIGH

## Summary

Phase 11 transforms the Phase 10 always-visible assistant turn cards into a two-level collapsible interface. The existing `TurnCard.vue` gets a clickable summary header (collapsed by default) showing model, tool count, duration, and timestamp. Expanding reveals assistant text, thinking, and tool call rows. Individual tool call rows get a second expansion level for I/O details. A sticky toolbar with expand/collapse-all button sits above the conversation.

The core technical challenge is managing collapse state via a reactive `Map<string, boolean>` composable shared between the toolbar (in `ConversationDetail.vue`) and individual `TurnCard` instances. The existing `details/summary` pattern for thinking content provides the template for tool call I/O expansion. No new libraries are needed -- this is pure Vue 3 reactivity + existing DaisyUI utilities + Lucide icons.

**Primary recommendation:** Create a `useCollapseState` composable that exposes a reactive Map keyed by turn message ID, with `toggle`, `expandAll`, `collapseAll`, and `isExpanded` methods. TurnCard receives `isExpanded` + `onToggle` as props from ConversationDetail, which owns the composable instance.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two-line summary header: Line 1 = model badge + tool count + duration + timestamp; Line 2 = first ~80 chars preview or tool summary fallback
- All assistant turns collapsed by default on load
- Click anywhere on summary header to expand/collapse (full row clickable)
- Chevron icon rotates to indicate state, instant toggle (no animation)
- Collapse state managed via reactive Map, not uncontrolled checkbox state
- Expanded content shows: assistant text body + thinking toggle + tool call summary rows
- Thinking uses details/summary (existing pattern)
- Tool call detail expansion: stacked input/output in raw JSON pre blocks
- Long outputs truncated at ~20 lines with "Show full output" button
- Copy button on pre blocks
- Sticky toolbar at top of conversation view with icon button (chevrons-down/chevrons-up) + tooltip
- Toolbar shows turn count ("23 turns" or "5 of 23 expanded")
- Toggle affects top-level turn blocks only, NOT individual tool call details
- Model badge uses neutral DaisyUI badge (color coding deferred to Phase 13)
- Duration calculated client-side from timestamps (no backend changes)

### Claude's Discretion
- Exact styling of the sticky toolbar (background, border, opacity)
- Chevron icon choice and rotation animation
- How to handle transition from Phase 10's always-visible layout to collapsed-by-default
- Pre block styling for tool call I/O (font size, max-height, scrolling)
- Copy button implementation details (icon, position, feedback)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GROUP-03 | User sees a summary header on each collapsed block showing model name, tool call count, duration, and timestamp | Summary header component with computed properties for tool count, duration calculation from timestamps, model from MessageRow.model |
| GROUP-04 | User can expand a response block to see thinking content as a collapsible section inside the group | Existing details/summary pattern in TurnCard already implements this; just needs to be inside the expanded content area |
| GROUP-05 | User can expand a response block to see a list of tool call rows (name, status, duration) | Existing ToolCallRow component already renders this; moves inside expandable content area |
| GROUP-06 | User can expand an individual tool call row to see its input/output details | New expansion behavior on ToolCallRow showing input/output JSON in pre blocks with copy + truncation |
| UX-01 | User can expand or collapse all response blocks with a single toggle button | Sticky toolbar with expand/collapse-all button driven by useCollapseState composable |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | ^3.5.0 | Reactive framework | Already in project |
| DaisyUI | ^5.5.0 | Component styling (badge, tooltip) | Already in project |
| Tailwind CSS | ^4.2.0 | Utility classes | Already in project |
| Lucide Vue Next | latest | Icons (ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Copy, Check) | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | (devDep) | Unit testing composables | Test useCollapseState, duration calculation |
| happy-dom | ^20.8.3 | DOM environment for tests | Already configured |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reactive Map composable | Pinia store | Overkill -- state is local to one conversation view, no cross-route persistence needed |
| details/summary for turn collapse | DaisyUI collapse component | DaisyUI collapse uses checkbox state (uncontrolled) -- contradicts requirement for reactive Map |
| Native details/summary for tool I/O | Custom div toggle | details/summary is semantic and accessible; already proven in thinking section |

## Architecture Patterns

### Recommended Project Structure
```
src/
  composables/
    useCollapseState.ts     # NEW: Reactive Map for collapse state
  components/
    TurnCard.vue            # MODIFIED: Add collapsed/expanded states, summary header
    ToolCallRow.vue         # MODIFIED: Add expandable I/O detail
    ConversationDetail.vue  # MODIFIED: Add sticky toolbar, pass collapse state
    ToolCallDetail.vue      # NEW (optional): Pre blocks for tool I/O with copy/truncation
  utils/
    content-parser.ts       # MODIFIED: Add formatDuration, getPreviewSnippet helpers
```

### Pattern 1: Controlled Collapse via Reactive Map
**What:** A composable that manages a `reactive(new Map<string, boolean>())` where keys are turn message IDs and values are expanded state. All turns start collapsed (not in map = collapsed).
**When to use:** When multiple components need synchronized collapse state and a parent needs bulk operations (expand all/collapse all).
**Example:**
```typescript
// src/composables/useCollapseState.ts
import { reactive, computed } from 'vue';

export function useCollapseState() {
  const expandedMap = reactive(new Map<string, boolean>());

  function isExpanded(id: string): boolean {
    return expandedMap.get(id) === true;
  }

  function toggle(id: string): void {
    expandedMap.set(id, !isExpanded(id));
  }

  function expandAll(ids: string[]): void {
    for (const id of ids) {
      expandedMap.set(id, true);
    }
  }

  function collapseAll(): void {
    expandedMap.clear(); // clearing = all collapsed (default state)
  }

  const expandedCount = computed(() => {
    let count = 0;
    for (const val of expandedMap.values()) {
      if (val) count++;
    }
    return count;
  });

  return { isExpanded, toggle, expandAll, collapseAll, expandedCount };
}
```

### Pattern 2: Two-Level Progressive Disclosure
**What:** Turn-level collapse (controlled via reactive Map, rendered with v-if/v-show) and tool-call-level collapse (local component state or details/summary).
**When to use:** When there are distinct levels of information density.
**Example:**
```vue
<!-- TurnCard: Level 1 collapse (controlled by parent) -->
<div @click="$emit('toggle')" class="cursor-pointer">
  <!-- Summary header always visible -->
</div>
<div v-if="expanded">
  <!-- Full content: text, thinking, tool calls -->
  <!-- Level 2: individual tool call details/summary -->
</div>
```

### Pattern 3: Sticky Toolbar with Position Sticky
**What:** A toolbar that sticks to the top of the viewport when scrolling past it.
**When to use:** When users need persistent access to controls while scrolling long content.
**Example:**
```vue
<div class="sticky top-0 z-10 bg-base-200/95 backdrop-blur-sm border-b border-base-300 px-4 py-2">
  <!-- toolbar content -->
</div>
```

### Anti-Patterns to Avoid
- **DaisyUI collapse component for turn-level collapse:** Uses uncontrolled checkbox state. Cannot synchronize with reactive Map or support expand-all/collapse-all.
- **v-model on details/summary open attribute:** The `open` attribute on `<details>` is not reactive in Vue. Use v-if/v-show with controlled state instead for turn-level collapse.
- **Storing collapse state per-component with local ref:** Each TurnCard would have its own state, making expand-all/collapse-all impossible without a shared composable.
- **Using transition/animation on collapse:** Decision explicitly says "instant toggle -- no animation or transitions" for turn-level collapse.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Copy to clipboard | Custom clipboard logic | Reuse pattern from CodeBlock.vue (`navigator.clipboard.writeText`) | Already proven, handles non-HTTPS fallback |
| JSON display | Custom JSON formatter | `JSON.stringify(data, null, 2)` in a `<pre>` block | Requirement explicitly says raw JSON pre blocks, no syntax highlighting |
| Duration formatting | New duration formatter | Extend `formatDuration` already in ConversationDetailPage.vue | Same logic needed, just extract to utils |
| Icon components | SVG markup | Lucide Vue Next (`ChevronDown`, `ChevronsDown`, etc.) | Already in project, consistent with existing icons |

## Common Pitfalls

### Pitfall 1: Reactive Map Gotchas in Vue 3
**What goes wrong:** Using `ref(new Map())` instead of `reactive(new Map())` or forgetting that `reactive()` wraps the Map -- direct `.get()` on the reactive Map works for triggering reactivity, but computed properties need to access values to track dependencies.
**Why it happens:** Vue 3's reactivity system tracks property access. Map operations (.get, .has, .set) are intercepted by the Proxy when using `reactive()`.
**How to avoid:** Use `reactive(new Map())`. Access values in computed properties to ensure dependency tracking. The `expandedCount` computed must iterate values, not just check `.size`.
**Warning signs:** Expand all/collapse all doesn't update TurnCard rendering.

### Pitfall 2: Click Event Propagation on Summary Header
**What goes wrong:** Clicking a badge or icon inside the summary header triggers both the header click (toggle) and any nested interactive elements.
**Why it happens:** Event bubbling. The entire header is clickable, but it may contain badges or other elements.
**How to avoid:** Since the summary header has no interactive children (badges are display-only), this is low risk. But if adding interactive elements later, use `@click.stop` on them.
**Warning signs:** Double-toggle or unexpected behavior when clicking specific parts of the header.

### Pitfall 3: Stale Collapse State When Conversation Changes
**What goes wrong:** Navigating to a different conversation keeps the old collapse state Map populated with IDs from the previous conversation.
**Why it happens:** The composable instance persists if the parent component is kept alive.
**How to avoid:** Create the composable inside `ConversationDetail.vue` (which re-renders per conversation) OR watch for conversation ID changes and call `collapseAll()`. Since ConversationDetail receives new `messages` props on navigation, the component re-renders and the composable re-initializes.
**Warning signs:** Turns appear expanded in a new conversation without user interaction.

### Pitfall 4: Large Tool Call I/O Causing Rendering Jank
**What goes wrong:** Tool calls with very large input/output (e.g., full file contents from Read tool) cause the page to lag when expanded.
**Why it happens:** Rendering thousands of lines in a `<pre>` block is expensive.
**How to avoid:** Truncate at ~20 lines by default. "Show full output" reveals the rest. This is explicitly required.
**Warning signs:** Page becomes unresponsive when expanding a tool call with large output.

### Pitfall 5: Duration Calculation Edge Cases
**What goes wrong:** Duration shows NaN or negative values for turns without subsequent messages or with missing timestamps.
**Why it happens:** Calculating duration from "assistant message timestamp to last tool call timestamp" requires tool calls to exist. Turns with no tool calls and no next message have no meaningful duration.
**How to avoid:** Fallback chain: (1) last tool call timestamp - assistant timestamp, (2) next message timestamp - assistant timestamp, (3) show "--" or omit duration.
**Warning signs:** "NaN ms" or "-123ms" displayed in summary headers.

## Code Examples

### Summary Header Layout
```vue
<!-- Two-line collapsed header -->
<div
  @click="$emit('toggle')"
  class="flex flex-col gap-1 cursor-pointer select-none py-2 px-4"
>
  <!-- Line 1: metadata -->
  <div class="flex items-center gap-2 text-xs">
    <ChevronDown
      class="w-4 h-4 shrink-0 transition-transform"
      :class="{ 'rotate-180': expanded }"
    />
    <span v-if="turn.message.model" class="badge badge-sm badge-ghost">
      {{ turn.message.model }}
    </span>
    <span v-if="turn.toolCalls.length > 0" class="text-base-content/50">
      {{ turn.toolCalls.length }} tool call{{ turn.toolCalls.length !== 1 ? 's' : '' }}
    </span>
    <span v-if="duration" class="text-base-content/50">{{ duration }}</span>
    <time class="text-base-content/40 ml-auto">{{ formatTime(turn.message.createdAt) }}</time>
  </div>
  <!-- Line 2: preview snippet -->
  <p class="text-xs text-base-content/50 truncate pl-6">
    {{ previewSnippet }}
  </p>
</div>
```

### Tool Call I/O Expansion with Truncation
```vue
<details class="mt-1">
  <summary class="cursor-pointer text-xs text-info">Show details</summary>
  <div class="mt-2 space-y-2">
    <!-- Input -->
    <div>
      <div class="text-xs text-base-content/50 mb-1">Input</div>
      <div class="relative group">
        <pre class="bg-base-300 rounded p-2 text-xs overflow-x-auto max-h-80 overflow-y-auto">{{ formatJson(toolCall.input) }}</pre>
        <button
          class="btn btn-xs btn-ghost absolute top-1 right-1 opacity-0 group-hover:opacity-100"
          @click.stop="copyText(formatJson(toolCall.input))"
        >
          <Copy class="w-3 h-3" />
        </button>
      </div>
    </div>
    <!-- Output (truncated) -->
    <div>
      <div class="text-xs text-base-content/50 mb-1">Output</div>
      <div class="relative group">
        <pre class="bg-base-300 rounded p-2 text-xs overflow-x-auto max-h-80 overflow-y-auto">{{ truncatedOutput }}</pre>
        <button v-if="isOutputTruncated && !showFullOutput"
          class="btn btn-xs btn-ghost mt-1"
          @click.stop="showFullOutput = true"
        >
          Show full output
        </button>
        <button
          class="btn btn-xs btn-ghost absolute top-1 right-1 opacity-0 group-hover:opacity-100"
          @click.stop="copyText(formatJson(toolCall.output))"
        >
          <Copy class="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>
</details>
```

### Preview Snippet Computation
```typescript
function getPreviewSnippet(turn: AssistantTurn): string {
  // Try assistant text first
  if (turn.message.content) {
    const cleaned = stripXmlTags(turn.message.content);
    if (cleaned && cleaned.trim().length > 0) {
      const firstLine = cleaned.trim().split('\n')[0];
      return firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine;
    }
  }
  // Fallback to tool summary
  if (turn.toolCalls.length > 0) {
    const uniqueNames = [...new Set(turn.toolCalls.map(tc => tc.name))];
    return `Used ${uniqueNames.join(', ')} (${turn.toolCalls.length} tool call${turn.toolCalls.length !== 1 ? 's' : ''})`;
  }
  return 'Empty response';
}
```

### Duration Calculation Between Turns
```typescript
function calculateDuration(turn: AssistantTurn, nextTurn?: Turn): string | null {
  const startTime = new Date(turn.message.createdAt).getTime();

  // Option 1: Use last tool call timestamp
  if (turn.toolCalls.length > 0) {
    const lastTc = turn.toolCalls[turn.toolCalls.length - 1]; // already sorted by createdAt
    const endTime = new Date(lastTc.createdAt).getTime();
    // Add tool call duration if available
    const totalEnd = lastTc.duration ? endTime + lastTc.duration : endTime;
    return formatMs(totalEnd - startTime);
  }

  // Option 2: Use next message timestamp
  if (nextTurn) {
    const endTime = new Date(nextTurn.message.createdAt).getTime();
    return formatMs(endTime - startTime);
  }

  return null;
}

function formatMs(ms: number): string {
  if (ms < 0) return '--';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DaisyUI checkbox collapse | Controlled state + v-if/v-show | DaisyUI 5 still uses checkbox | Checkbox approach cannot support programmatic expand-all; reactive Map is superior |
| details/summary for everything | details/summary for leaf-level only | Project decision | Turn-level collapse needs programmatic control (expand all); details/summary is uncontrolled |
| Always-visible turn content (Phase 10) | Collapsed by default (Phase 11) | This phase | Major UX shift -- users scan headers, click to expand |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via devDep in frontend package) |
| Config file | `packages/frontend/vitest.config.ts` |
| Quick run command | `cd packages/frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/frontend && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GROUP-03 | Summary header shows model, tool count, duration, timestamp | unit | `cd packages/frontend && npx vitest run tests/composables/useCollapseState.test.ts -x` | No -- Wave 0 |
| GROUP-03 | Preview snippet computation (text vs tool summary fallback) | unit | `cd packages/frontend && npx vitest run tests/utils/turn-helpers.test.ts -x` | No -- Wave 0 |
| GROUP-03 | Duration calculation from timestamps | unit | `cd packages/frontend && npx vitest run tests/utils/turn-helpers.test.ts -x` | No -- Wave 0 |
| GROUP-04 | Thinking section is collapsible inside expanded turn | manual-only | Visual verification in browser | N/A |
| GROUP-05 | Tool call rows visible when turn expanded | manual-only | Visual verification in browser | N/A |
| GROUP-06 | Tool call I/O details with truncation | unit | `cd packages/frontend && npx vitest run tests/utils/turn-helpers.test.ts -x` | No -- Wave 0 |
| UX-01 | Expand all / collapse all via composable | unit | `cd packages/frontend && npx vitest run tests/composables/useCollapseState.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd packages/frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/frontend/tests/composables/useCollapseState.test.ts` -- covers UX-01, GROUP-03 (state management)
- [ ] `packages/frontend/tests/utils/turn-helpers.test.ts` -- covers GROUP-03 (preview snippet, duration calc), GROUP-06 (truncation logic)

## Open Questions

1. **Chevron rotation: CSS transform or icon swap?**
   - What we know: User wants chevron to indicate state. Lucide has both ChevronDown and ChevronRight.
   - What's unclear: Whether to use CSS `rotate-180` on ChevronDown or swap between ChevronDown/ChevronRight.
   - Recommendation: Use `ChevronDown` with `rotate-180` CSS class when collapsed -> expanded. Simpler, one icon import. Decision says "no animation" for toggle, but chevron rotation is visual indicator, not animation of content.

2. **Sticky toolbar z-index relative to sidebar**
   - What we know: The app has an AppSidebar component. Sticky toolbar needs z-index above content but below any modals.
   - What's unclear: Exact z-index layering in the app.
   - Recommendation: Use `z-10` for the sticky toolbar. If sidebar has higher z-index, adjust. Test visually.

3. **Tool call I/O JSON formatting**
   - What we know: `ToolCallRow` type has `input: unknown` and `output: unknown`. Need to display as JSON.
   - What's unclear: Whether input/output are already strings or need `JSON.stringify`.
   - Recommendation: Use `JSON.stringify(value, null, 2)` with a fallback to `String(value)`. Handle null/undefined gracefully.

## Sources

### Primary (HIGH confidence)
- Project codebase: `TurnCard.vue`, `ToolCallRow.vue`, `ConversationDetail.vue`, `useGroupedTurns.ts` -- direct code inspection
- Project types: `@cowboy/shared` `MessageRow` and `ToolCallRow` interfaces -- verified field availability (model, input, output, duration, status)
- DaisyUI skill: badge, tooltip component patterns confirmed
- CONTEXT.md: All decisions locked by user

### Secondary (MEDIUM confidence)
- Vue 3 reactive Map behavior -- based on Vue 3 reactivity documentation. `reactive(new Map())` intercepts Map methods for dependency tracking.

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and in use
- Architecture: HIGH - extending existing patterns (details/summary, composables, DaisyUI classes)
- Pitfalls: HIGH - derived from direct code inspection and known Vue 3 reactivity behavior

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- no external dependencies changing)
