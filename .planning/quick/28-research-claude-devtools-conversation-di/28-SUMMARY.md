# Quick Task 28: Conversation Display Comparison — claude-devtools vs Cowboy

**Date:** 2026-03-28
**Source:** [matt1398/claude-devtools](https://github.com/matt1398/claude-devtools)

---

## Side-by-Side Feature Comparison

| Feature | claude-devtools | Cowboy (ours) | Gap |
|---------|----------------|---------------|-----|
| **Message types** | 4 (user/system/ai/compact) | 7 (user/assistant-group/system-group/slash-command/clear-divider/agent-prompt/compaction) | We're richer ✓ |
| **Turn grouping** | Flat list, consecutive AI merged | Consecutive assistant merged + system classification | We're richer ✓ |
| **Collapse/expand** | Two-level: always-visible last output + expandable process | Single-level: collapsed preview → expanded full | **Gap: "Last Output" pattern** |
| **Model badges** | Color-coded by family (Opus/Sonnet/Haiku distinct colors) | Single color model badge | **Gap: Family color-coding** |
| **Markdown rendering** | react-markdown + remark-gfm, consistent for all content | marked + DOMPurify for assistant; plain text for user | Partial gap |
| **Syntax highlighting** | Custom regex tokenizer (lightweight, 10+ langs) | highlight.js via @highlightjs/vue-plugin (12 langs) | We're better ✓ |
| **Code in markdown** | Styled but no full highlighting | Unstyled `<pre><code>` in markdown output | **Gap: Markdown code highlighting** |
| **Thinking blocks** | Collapsible with Brain icon, markdown rendered | `<details>` with purple accent, markdown rendered | Minor gap (animation) |
| **Tool call display** | Specialized viewers (Read/Edit/Write/Bash/Default) | Specialized viewers (Read/Edit/Write/Bash/JSON) | Comparable ✓ |
| **Diff viewer** | LCS-based, color-coded lines | LCS-based, color-coded lines | Comparable ✓ |
| **Read tool .md files** | Code/Preview toggle | Code view only | **Gap: Markdown preview** |
| **Copy functionality** | On user bubbles, AI output, code blocks, diffs | On code blocks and JSON viewer only | **Gap: Copy on messages** |
| **Export** | Markdown/JSON/Plain text download | None | **Gap: Export** |
| **Search** | Cmd+F, mark-based, auto-expand, per-item scoping | Cmd+F, DOM TreeWalker, auto-expand | Comparable (theirs slightly richer) |
| **Virtualization** | @tanstack/react-virtual at 120+ items | Pagination (PAGE_SIZE=50) | **Gap: Virtualization** |
| **@path mentions** | Validated inline badges with IPC filesystem check | Not implemented | **Gap: Path badges** |
| **Token display** | Detailed tooltip: input/output/cache-read/cache-create/thinking | Context tokens + output tokens | **Gap: Token breakdown** |
| **Timeline/Navigation** | Context panel (accumulated injections + tokens) | Timeline panel (IntersectionObserver-synced) | Different focus, both good |
| **Live updates** | File watcher (Electron) | WebSocket + debounced refetch | We're better (real-time) ✓ |
| **Sub-conversations** | Not supported | Parent-child sub-rows | We're unique ✓ |
| **System message classification** | Basic system type | 7 categories (reminder/skill/objective/caveat/task/interrupt) | We're richer ✓ |
| **Compaction display** | Token delta markers ("45k → 12k") | Color-coded severity dividers | Both good, different angles |
| **Subagent display** | Rich card: metrics, team colors, execution trace, nested tools | Summary card with lazy-loaded tools | **Gap: Richer subagent cards** |
| **Reply-link spotlight** | Hover dims unrelated items (20% opacity) | Not implemented | **Gap: Visual linking** |
| **Notification colors** | Custom color propagation through conversation | Not implemented | Nice-to-have |
| **Scroll management** | Double-RAF, intersection observer, auto-scroll | RAF-throttled, scroll position preservation | Comparable ✓ |
| **Theme system** | 70+ CSS variables, dark/light toggle | DaisyUI themes + oklch | Both good approaches |

---

## Top 10 Prioritized Improvements

Ranked by **impact × feasibility** (High/Medium/Low for each).

### 1. Copy Button on Assistant Text Responses
**Impact: HIGH | Effort: LOW | Priority: P0**

claude-devtools has hover-reveal copy buttons on every message type. We only have copy on `CodeBlock.vue` and `JsonFallbackViewer`. Users frequently need to copy assistant responses.

**Implementation:**
- Add a `CopyButton` component (we likely already have one in CodeBlock) to `AssistantGroupCard.vue`
- Position absolute top-right of the expanded text content area
- Show on hover with opacity transition
- Copy the raw markdown text content of the assistant message
- 2-second "Copied!" checkmark feedback

**Files:** `AssistantGroupCard.vue`, possibly extract reusable `CopyButton.vue`

---

### 2. "Last Output" Always-Visible Pattern
**Impact: HIGH | Effort: MEDIUM | Priority: P0**

Their most impactful UX innovation. AI groups always show the **final text output** at the bottom without expanding. All intermediate work (thinking, tool calls, subagent traces) is in a collapsible section above. Users see the answer immediately and drill into process on demand.

**Our current pattern:** Collapsed shows a 3-line markdown preview. User must expand to see the full answer, then scroll past all thinking/tools to find it.

**Implementation:**
- In `AssistantGroupCard.vue`, when collapsed, render the **last text content block** from the group's messages in full (not a preview)
- Move the tool call list and thinking blocks into an expandable "Process" section above the final output
- Keep the summary header (model, tokens, duration) as-is
- When expanded, show: [Summary Header] → [Expandable: Thinking + Tools] → [Final Output]

**Files:** `AssistantGroupCard.vue`, `useGroupedTurns.ts` (may need to extract "last output" logic)

---

### 3. Syntax Highlighting in Markdown Code Blocks
**Impact: HIGH | Effort: LOW | Priority: P0**

Our `renderMarkdown()` produces `<pre><code class="language-X">` but these don't get highlight.js treatment. Only `CodeBlock.vue` (used for user message code blocks) has highlighting. Assistant markdown with code blocks looks plain.

**Implementation:**
- After `renderMarkdown()` call, run `hljs.highlightAll()` on the container, OR
- Use a `marked` extension/renderer that applies highlight.js during parsing (marked supports `highlight` option)
- Add the `highlight` option to our `marked` configuration:
  ```js
  marked.setOptions({
    highlight: function(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    }
  });
  ```

**Files:** `render-markdown.ts`, `markdown-content.css` (add highlight.js token styles)

---

### 4. Model Family Color-Coding
**Impact: MEDIUM | Effort: LOW | Priority: P1**

claude-devtools color-codes model badges by family: Opus gets one color, Sonnet another, Haiku another. Our model badges are uniform. This adds instant visual recognition of which model handled each turn.

**Implementation:**
- Create a `modelFamilyColor(modelId: string)` utility:
  - Contains "opus" → `badge-secondary` (purple/deep)
  - Contains "sonnet" → `badge-primary` (blue)
  - Contains "haiku" → `badge-accent` (green/teal)
  - Default → `badge-ghost`
- Apply in `AssistantGroupCard.vue` model badge

**Files:** New utility function, `AssistantGroupCard.vue`

---

### 5. Richer Token Usage Breakdown
**Impact: MEDIUM | Effort: LOW | Priority: P1**

They show a tooltip with: input tokens, output tokens, cache-read tokens, cache-creation tokens, thinking tokens. We show context + output as simple numbers.

**Implementation:**
- Add a tooltip/popover on the token display in `AssistantGroupCard.vue`
- Show breakdown: Input | Output | Cache Read | Cache Write (if available from API)
- Include cost calculation if we have pricing data
- Show per-turn breakdown when multiple turns in a group

**Files:** `AssistantGroupCard.vue`, possibly new `TokenBreakdown.vue` component

---

### 6. Markdown Preview Toggle for Read Tool
**Impact: MEDIUM | Effort: LOW | Priority: P1**

When Read tool opens a `.md` file, claude-devtools offers a Code/Preview toggle. We always show raw code. This is a small but delightful UX touch for documentation files.

**Implementation:**
- In the Read tool viewer section of `ToolCallRow.vue`, detect `.md`/`.mdx` file extensions
- Add a toggle button (Code | Preview)
- Code mode: existing `CodeViewer` component
- Preview mode: render content through `renderMarkdown()` and display in a styled container

**Files:** `ToolCallRow.vue` or the Read tool viewer component

---

### 7. Export Conversation
**Impact: MEDIUM | Effort: MEDIUM | Priority: P2**

They offer Markdown/JSON/Plain text export. We have nothing. Useful for sharing, documentation, debugging.

**Implementation:**
- Add an export button to `ConversationDetailPage.vue` header area
- Dropdown: Markdown | JSON | Plain Text
- Markdown format: Property table + `### User/Assistant (Turn N)` headings + thinking as blockquotes + tools as code blocks
- JSON: Pretty-printed conversation object
- Plain text: `USER:` / `ASSISTANT:` / `TOOL:` labels
- Download via Blob + URL.createObjectURL + synthetic anchor click

**Files:** New `ExportDropdown.vue`, new `conversation-exporter.ts` utility, `ConversationDetailPage.vue`

---

### 8. Animated Expand/Collapse for Thinking Blocks
**Impact: LOW | Effort: LOW | Priority: P2**

We use native `<details>` for thinking blocks, which has no animation. They use React-managed state with smooth transitions. Small polish item.

**Implementation:**
- Replace `<details>` with Vue `<Transition>` + v-show/v-if controlled by component state
- Add `max-height` transition or use `<TransitionGroup>` for smooth reveal
- Keep Brain icon and purple accent

**Files:** `AssistantGroupCard.vue` (thinking section)

---

### 9. @path Mention Highlighting in User Messages
**Impact: LOW | Effort: MEDIUM | Priority: P3**

They validate `@path` references against the filesystem and render as styled inline badges. Nice but requires backend support for path validation.

**Implementation:**
- Parse user message text for `@` followed by file-path-like strings
- Render as monospace inline badges with distinct background
- Optional: validate against known project files (could use files already seen in tool calls)
- Simpler version: just style the `@path` patterns without validation

**Files:** `ChatMessage.vue`, possibly new `PathMention.vue` component

---

### 10. Virtualization for Long Conversations
**Impact: HIGH | Effort: HIGH | Priority: P3 (due to effort)**

They use `@tanstack/react-virtual` for 120+ items. We paginate at 50. For very long conversations, virtualization would be smoother than pagination.

**Implementation:**
- Install `@tanstack/vue-virtual` (Vue port exists)
- Replace the paginated v-for in `ConversationDetail.vue` with a virtual list
- Estimated row height: ~260px (variable, needs measurement)
- Keep overscan at ~5 items
- Complex: need to handle variable heights, expand/collapse affecting heights, search scroll-to
- **Recommendation:** Defer to a dedicated phase. Our pagination works well enough and is simpler to maintain.

**Files:** `ConversationDetail.vue`, new composable `useVirtualScroll.ts`

---

## What We Already Do Better (Preserve)

1. **System message classification** — 7 categories with smart detection. Don't simplify this.
2. **Sub-conversation parent-child rows** — Unique feature. They don't have this at all.
3. **Timeline panel with IntersectionObserver** — Better navigation UX than their context panel for scrolling.
4. **Live WebSocket updates** — Real-time vs their file-watcher polling approach.
5. **Compaction severity color-coding** — More informative than their plain token delta markers.
6. **Keyboard navigation (J/K/E)** — They have search nav but not turn-level keyboard nav.
7. **Slash command and agent prompt chips** — Clearer visual separation of command types.
8. **DaisyUI theme system** — More complete theme support with minimal custom CSS.

---

## Implementation Roadmap Suggestion

**Sprint 1 (Quick wins — 1 session):**
- [ ] Copy button on assistant responses (#1)
- [ ] Syntax highlighting in markdown code blocks (#3)
- [ ] Model family color-coding (#4)

**Sprint 2 (Medium effort — 1-2 sessions):**
- [ ] "Last Output" always-visible pattern (#2)
- [ ] Token usage breakdown tooltip (#5)
- [ ] Markdown preview toggle for Read tool (#6)

**Sprint 3 (Larger features):**
- [ ] Export conversation (#7)
- [ ] Animated thinking blocks (#8)

**Backlog:**
- [ ] @path mention highlighting (#9)
- [ ] Virtualization (#10)

---

## Commits
- Research and analysis only, no code changes
