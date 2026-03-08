# Phase 10: Data Grouping Foundation - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Group assistant messages and their associated tool calls into typed Turn objects, replacing the flat timeline with a grouped view. Users see assistant turns grouped with their tool calls instead of individual items. The main assistant output text is visible without expanding. Collapsible UI, summary headers, and token enrichment are Phase 11-12 territory.

</domain>

<decisions>
## Implementation Decisions

### Grouped turn visual container
- Assistant turns wrapped in subtle card containers: base-200 background tint + thin border
- User messages keep existing chat-end bubbles — no card treatment
- Visual hierarchy: user asks (bubble) → assistant responds (card block)
- Assistant output text renders directly inside the card as plain text — no nested chat bubble inside the card

### Tool call display within groups
- Tool calls shown as a compact list of rows inside the turn card: icon + name + status + duration
- Tool call list is always visible below the assistant text (not collapsed)
- No expand/collapse on individual tool calls yet — Phase 11 adds progressive disclosure
- Thinking content moves inside the turn card (above assistant text, collapsed) — keeps everything about one turn together

### Conversation feel
- Conversation-first layout — still feels like reading a chat, not a structured log
- User bubbles on the right, assistant card blocks on the left, linear flow
- Like Slack threads with richer assistant blocks

### Orphan handling
- Tool calls with messageId mismatch attach to the nearest preceding assistant turn (per success criteria)
- Consecutive assistant messages without an intervening user message produce separate turn groups (per success criteria)

### Claude's Discretion
- Card width (full-width vs 85% max-width — pick what looks best with tool call lists and code blocks)
- Whether text-only assistant turns (no tool calls) get cards or stay as plain chat bubbles — pick what looks more consistent with Phase 11's collapsible headers coming next
- Whether to include a minimal header (role + timestamp) on each card or defer all header elements to Phase 11
- Long tool call list handling (show all vs cap with "show more")

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConversationDetail.vue`: Currently renders flat timeline of messages + tool calls sorted by timestamp. This is the component to refactor — replace flat timeline with grouped Turn rendering
- `ChatMessage.vue`: Renders individual messages with thinking collapsible and code block parsing. Content parsing logic (`parseContent`, `stripXmlTags`) can be reused in the new turn card
- `ToolCallCard.vue`: Existing tool call display — may be replaced with compact row component or simplified
- `useConversationDetail.ts`: Fetches `ConversationDetailResponse` with separate `messages[]` and `toolCalls[]` arrays — grouping logic consumes this data
- `CodeBlock.vue`: Syntax highlighting component — reuse inside turn cards

### Established Patterns
- `MessageRow` has `id`, `role`, `content`, `thinking`, `createdAt`, `model` fields
- `ToolCallRow` has `messageId` FK linking to parent message — this is the grouping key
- DaisyUI 5 night theme with base-200/base-300 for subtle backgrounds
- Vue composables for data transformation and state management
- `stripXmlTags` utility for cleaning content display

### Integration Points
- `ConversationDetail.vue` receives `messages` and `toolCalls` props from `ConversationDetailPage.vue`
- Grouping logic should produce Turn[] that ConversationDetail renders instead of the flat timeline
- Vue router `/conversations/:id` route and `ConversationDetailPage.vue` stay as-is — only the detail rendering changes

</code_context>

<specifics>
## Specific Ideas

- The feel should be "Slack threads with richer assistant blocks" — conversational, not log-like
- Cards should be subtle (base-200 tint) to avoid visual heaviness — Grafana/Datadog data-dense aesthetic from earlier phases
- Tool call compact rows give enough info to see what happened without overwhelming the conversation flow

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-data-grouping-foundation*
*Context gathered: 2026-03-05*
