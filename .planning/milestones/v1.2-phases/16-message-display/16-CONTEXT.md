# Phase 16: Message Display - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Visually distinguish system-injected content (caveats, skill instructions, objective blocks stored as role=user) and slash commands (/clear, /gsd:*, etc.) from actual user messages in the conversation detail view. Detection logic already exists in `content-sanitizer.ts` — this phase changes the rendering from "hide" to "show differently."

</domain>

<decisions>
## Implementation Decisions

### System message visibility
- Change from current behavior (hidden entirely) to **collapsed indicator** in the message flow
- Group consecutive system-injected messages into a single indicator (e.g., "3 system messages")
- Indicator is a thin bar/chip — minimal visual noise by default
- Clicking the indicator expands to reveal the content
- When expanded, show a **categorized label** (e.g., "Skill instruction", "System caveat", "Objective") plus the stripped content — helps understand WHY it was injected

### Slash command presentation
- Render as **compact chip/badge** — small pill-shaped element with the command name
- `/clear` gets **special treatment** as a full-width divider line (context reset boundary) while other commands use the standard chip style
- This aligns with the existing context-boundary logic in ConversationDetail.vue that already treats `/clear` specially

### Claude's Discretion
- Whether to group consecutive system messages or show individually (recommended: group)
- Collapsed indicator preview text: count only vs count + type hints
- Slash command chip alignment (right-aligned like user vs centered like events)
- Whether to show command arguments alongside command name
- Expanded system content depth: full content vs truncated preview
- Expanded text style: monospace/code vs muted regular font
- Color coding per system message type (single neutral vs subtle per-type tints)
- Whether expanded system messages show timestamps
- Exact DaisyUI classes and color choices for all new elements

</decisions>

<specifics>
## Specific Ideas

- The collapsed indicator should feel like a timeline event, not a message bubble — it's metadata about the conversation, not part of it
- `/clear` as a divider reinforces its meaning as "everything above is old context" — visual separation matches semantic meaning
- System message categories come from what `isSystemInjected()` already detects: XML-tagged system content (system-reminder, local-command, antml:), skill/command prompts with structured XML sections

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `content-sanitizer.ts:isSystemInjected()` (lines 63-85): Already detects system messages — returns true for XML-tagged system content, skill prompts, empty-after-strip messages
- `content-sanitizer.ts:isSlashCommand()` (lines 33-36): Already detects slash commands via `<command-name>` tags
- `content-sanitizer.ts:extractCommandText()` (lines 44-52): Already extracts `/command-name args` from XML
- `content-sanitizer.ts:isClearCommand()` (lines 90-94): Already detects `/clear` specifically
- `content-sanitizer.ts:stripXmlTags()` (lines 16-26): Already strips XML for clean display
- `ChatMessage.vue`: Current user message component — needs conditional rendering based on message type

### Established Patterns
- `ConversationDetail.vue` (lines 52-77): Currently filters out system messages and uses `/clear` as context boundary — change to render instead of filter
- `useGroupedTurns.ts`: Grouping logic for assistant turns — system message grouping could follow similar pattern
- DaisyUI collapse/details pattern used in AssistantGroupCard.vue — reusable for system message expand/collapse
- oklch soft-tint colors for model badges (Phase 13) — same approach for system message type colors if used

### Integration Points
- `ConversationDetail.vue`: Main change point — stop filtering system messages, render them differently
- `ChatMessage.vue`: Needs to detect message type and render chip/indicator instead of green bubble
- `useGroupedTurns.ts`: May need new turn type for system messages and slash commands (currently only 'user', 'assistant', 'assistant-group')
- No backend changes needed — all detection and rendering is frontend-only

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-message-display*
*Context gathered: 2026-03-05*
