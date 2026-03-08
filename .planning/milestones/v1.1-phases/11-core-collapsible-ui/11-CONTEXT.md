# Phase 11: Core Collapsible UI - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Progressive disclosure for assistant turn details through a two-level collapsible interface. Each assistant turn gets a summary header (collapsed state) and expandable content. Individual tool calls have their own expand for I/O details. A global toggle expands/collapses all turns. Collapse state is managed via reactive Map.

Token enrichment (Phase 12) and visual polish with icons/color badges (Phase 13) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Summary header content
- Two-line layout when collapsed:
  - Line 1: Model name badge (neutral DaisyUI badge) + tool call count + duration + timestamp
  - Line 2: First ~80 chars of assistant text as preview snippet
- If assistant text is very short or empty, line 2 falls back to tool summary (e.g., "Used Read, Edit, Bash (5 tool calls)")
- Model badge uses neutral color now — Phase 13 adds color coding
- Duration calculated client-side from timestamps (last tool call or next message timestamp minus assistant message timestamp) — no backend changes

### Collapse behavior
- All assistant turns collapsed by default when conversation loads — scan-first approach
- Click anywhere on the summary header to expand/collapse (entire header row is clickable)
- Chevron icon rotates to indicate expanded/collapsed state
- Instant toggle — no animation or transitions
- Collapse state managed via reactive Map (per success criteria), not uncontrolled checkbox state

### Expanded content (layered disclosure)
- Expanding a turn reveals: assistant text body + thinking toggle + tool call summary rows
- Thinking content is a collapsible section inside the expanded block (using details/summary, per Phase 10 pattern)
- Tool call rows show name + status + duration (compact list, as built in Phase 10)
- Individual tool calls need a second click to see I/O details — two-level progressive disclosure

### Tool call detail expansion
- Expanding a tool call row shows input and output in raw JSON pre blocks
- Layout: stacked — input section above output section
- Long outputs truncated at ~20 lines with a "Show full output" button to reveal the rest
- Copy button on the pre blocks for grabbing file contents or command outputs

### Expand/collapse all
- Sticky toolbar at the top of the conversation view, persists when scrolling
- Icon button (chevrons-down/chevrons-up) with tooltip ("Expand All" / "Collapse All")
- Toolbar also shows turn count (e.g., "23 turns" or "5 of 23 expanded")
- Toggle affects top-level turn blocks only — does NOT expand individual tool call details

### Claude's Discretion
- Exact styling of the sticky toolbar (background, border, opacity)
- Chevron icon choice and rotation animation
- How to handle the transition from Phase 10's always-visible layout to collapsed-by-default
- Pre block styling for tool call I/O (font size, max-height, scrolling)
- Copy button implementation details (icon, position, feedback)

</decisions>

<specifics>
## Specific Ideas

- The collapsed view should feel like scanning a git log — you see what happened at a glance, click into details when needed
- Preview snippet on line 2 gives enough context to decide whether to expand without needing to click
- Tool summary fallback ("Used Read, Edit, Bash") ensures no collapsed header is ever empty/useless
- Layered disclosure: turn-level expand is for "what did the assistant do?", tool-level expand is for "what exactly was the I/O?"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TurnCard.vue`: Current assistant turn card with header, thinking details/summary, text body, and tool call list — this is the component to enhance with collapse
- `ToolCallRow.vue`: Compact row (icon + name + status + duration) — needs expand capability added for I/O detail
- `CodeBlock.vue`: Syntax highlighting for code blocks — reuse for tool call output display
- `useGroupedTurns.ts`: Pure `groupTurns` function producing `Turn[]` — no changes needed, collapse is a UI concern
- `content-parser.ts`: `parseContent`, `formatTime` utilities — reuse in summary headers

### Established Patterns
- `details/summary` for collapsible content (thinking section in TurnCard) — extend this pattern for tool call I/O
- DaisyUI 5 night theme: base-200 for card backgrounds, base-300 for borders and subtle backgrounds
- Vue composables for state management — collapse state Map should be a composable
- Lucide icons used throughout (Brain, Wrench) — use ChevronDown/ChevronUp for expand indicators

### Integration Points
- `ConversationDetail.vue`: Renders turns via `TurnCard` — needs to pass collapse state and provide the sticky toolbar
- `ConversationDetailPage.vue`: Parent page — sticky toolbar may need to be positioned relative to this
- Collapse state composable needs to be shared between ConversationDetail (toolbar) and individual TurnCards

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-core-collapsible-ui*
*Context gathered: 2026-03-05*
