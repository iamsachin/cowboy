# Feature Research

**Domain:** AI coding agent analytics dashboard -- v2.0 conversation display overhaul
**Researched:** 2026-03-09
**Confidence:** HIGH (primary reference: claude-devtools codebase analysis in LEARNINGS.md, verified with ecosystem research)

## Context

This research covers the v2.0 milestone features: conversation display improvements, tool-specific viewers, data quality fixes, and navigation. Everything listed in v1.0 through v1.3 is already shipped and working.

**Already built (not in scope):**
- Collapsible assistant groups with summary headers (model, tools, duration, tokens, cost)
- Per-turn token counts and cost, tool call icons, model badges
- System message indicators, slash command chips, clear dividers
- Conversation table with sort/filter/search, pagination
- WebSocket live updates, charts, analytics pages
- Expand/collapse all toggle, load-more pagination
- Content sanitization, DOMPurify with `<mark>` support
- highlight.js syntax highlighting, marked markdown rendering

## Feature Landscape

### Table Stakes (Users Expect These)

Features that users of a Claude Code analytics dashboard notice immediately if missing. These close the primary UX gap with claude-devtools (1,835+ stars).

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Always-visible AI response on collapsed groups** | claude-devtools shows the final text output below collapsed headers. Without it, users must expand every group to scan a conversation -- defeats the purpose of collapsing. Currently only a truncated snippet shows in the header. | LOW | Add a `lastOutput` section below the existing `previewSnippet` in `AssistantGroupCard.vue`. Find the last turn with text content, render as truncated markdown (3-4 lines max with CSS `line-clamp`). Reuse existing `renderMarkdown()` utility. No new dependencies. |
| **LCS diff viewer for Edit tool calls** | The #1 UX gap identified in LEARNINGS.md. Edit tool calls currently dump raw JSON of `old_string`/`new_string`. Every code review tool shows red/green diffs. Users expect visual diffs -- GitHub, VS Code, and claude-devtools all do this. | MEDIUM | Use `diff` npm package (jsdiff) -- 49M weekly downloads, mature, framework-agnostic. Call `diffLines(oldStr, newStr)` which returns change objects with `added`/`removed`/`value` properties. Build a `DiffViewer.vue` component rendering line-by-line with +/- prefixes, line numbers, green/red background tints (`bg-success/10`, `bg-error/10`). Show stats header: "+N lines / -M lines". |
| **Syntax-highlighted code viewer for Read results** | Read tool output is file content. Currently shown as raw monospace text. `highlight.js` is already in the project but only used for markdown code blocks. Users expect line numbers and language detection when viewing file contents. | LOW-MEDIUM | Build `CodeBlockViewer.vue` wrapping existing `highlight.js` setup. Add line numbers via CSS counter (`counter-reset: line` / `counter-increment: line`). Detect language from file extension in tool input path. Display file path header with language badge. Reusable for Write tool output too. |
| **Tool-specific input rendering** | All tool inputs currently dump as syntax-highlighted JSON. Bash commands should look like shell prompts. File paths should be prominent headers. Edit should show the diff, not JSON keys. claude-devtools dispatches by tool name with 5 specialized viewers. | MEDIUM | Dispatch on `toolCall.name` in `ToolCallRow.vue`. **Bash:** show `description` as muted label, `command` in monospace code block with terminal prompt styling. **Read:** show file path as header + offset/limit as subtle metadata. **Edit:** route to DiffViewer. **Write:** route to CodeBlockViewer. **Grep/Glob:** show pattern prominently. **Others:** keep JSON fallback. |
| **User message truncation** | Long user messages (pasted files, large prompts) dominate the viewport. claude-devtools truncates at 500 chars with "Show more". Currently our `ChatMessage.vue` renders full content always. | LOW | Add a reactive `expanded` ref. When `content.length > 500`, show first 500 chars with CSS `line-clamp` or manual slice, plus a "Show more" button. Toggle to full content on click. |
| **Semantic message colors** | Thinking, tool calls, tool results, and text output all share the same visual treatment. claude-devtools uses purple for thinking, amber for tool calls, green/red for results. Users scan by color to find what they need. | LOW | Apply background tint classes to existing turn sections in `AssistantGroupCard.vue`. Use oklch with low alpha for theme safety: `bg-purple-500/10` for thinking blocks, `bg-amber-500/10` for tool call rows, `bg-success/10` for successful tool results, `bg-error/10` for error results. Minimal CSS-only change. |

### Differentiators (Competitive Advantage)

Features that go beyond table stakes. Not all users need them, but they signal a polished developer tool.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **In-conversation search (Cmd+F override)** | Browser Cmd+F searches the whole page including sidebar, headers, and collapsed content. Custom search targets only the conversation content area with match highlighting and prev/next navigation. Shows "X of Y matches" like VS Code. | MEDIUM | Intercept Cmd+F via `addEventListener('keydown', e => { if (e.metaKey && e.key === 'f') ... })`. Build floating search bar component anchored to conversation area top-right. Use DOM `TreeWalker` API to find text nodes in conversation container. Wrap matches in `<mark>` elements (DOMPurify already allows `<mark>` tags). Track match index with counter, scroll active match into view with `scrollIntoView()`. Enter = next match, Shift+Enter = previous. |
| **Command palette (Cmd+K)** | Power-user navigation: jump to conversation by title, switch pages, trigger actions like "refresh data" or "expand all". Linear, Vercel, GitHub all have this. Signals a serious developer tool. | MEDIUM-HIGH | Build custom rather than using `vue-command-palette` (last published 2+ years ago, v0.2.3, low maintenance). Implementation: modal overlay with `backdrop-blur-sm`, text input with 200ms debounce, filtered action list. Data sources: conversations from existing API search endpoint, pages from Vue Router routes, hardcoded actions. Substring matching is sufficient for the item count (<1000). No need for `fuse.js`. |
| **Keyboard shortcuts** | Navigate without mouse. Cmd+B toggle sidebar, Cmd+K open palette, J/K next/prev conversation in list, E expand/collapse all, Escape close modals, `?` show shortcut cheat sheet. | LOW-MEDIUM | Use VueUse `useMagicKeys()` composable -- reactive keyboard state, supports combos like `Cmd+K`, auto-handles key up/down. Register shortcuts in a central `useKeyboardShortcuts.ts` composable. Show shortcut hints in button tooltips and sidebar items. VueUse also provides `onKeyStroke` for single-key events and `useActiveElement` for focus-aware shortcuts. |
| **Compaction boundary visualization** | When Claude silently compresses a conversation, token counts suddenly drop. Showing "45k -> 12k (33k freed)" as an amber boundary marker helps users understand why context was lost and where conversation phases begin. | MEDIUM | **Backend:** detect compaction during ingestion. Look for `isCompactSummary` flag in JSONL entries, or detect sudden token count drops between sequential messages with same `requestId`. Store as a special message type or metadata flag. **Frontend:** create `CompactionBoundary.vue` component similar to existing `ClearDivider.vue`. Amber accent line, token delta displayed in green, expandable to show compacted summary text if available. |
| **Subagent execution traces** | Claude Code spawns sub-agents via the Task tool. Their work happens in separate JSONL files. Showing what the sub-agent did gives visibility into delegated work -- users currently see "Task" with opaque JSON. | HIGH | **Backend:** scan for Task tool calls in parsed conversations. Resolve corresponding JSONL files using three-phase matching per claude-devtools: (1) result-based matching by agentId in tool result, (2) description-based matching from teammate summary in tool input, (3) positional fallback. Parse sub-agent JSONL and link to parent conversation in database. Filter warmup sub-agents. **Frontend:** render as a nested card within the Task tool call row, showing sub-agent's tool call summary list (tool names, statuses, file paths touched). NOT full recursive nesting -- flat summary to avoid deep UI nesting. |
| **Streaming deduplication** | Claude Code writes multiple JSONL entries per streaming API response (same `requestId`, incrementally increasing tokens). Without dedup, token counts are inflated across the entire UI. This is a silent data quality issue. | MEDIUM | **Backend only.** During ingestion in the Claude normalizer, group entries by `requestId` and keep only the last entry (highest token count) per request. This corrects token/cost numbers across all displays with zero frontend changes. Must handle edge case where `requestId` is missing on older entries. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Multi-pane split view** | Compare two conversations side-by-side | Very high complexity. claude-devtools spent 4 Zustand slices (tabSlice, tabUISlice, paneSlice, sessionDetailSlice) plus @dnd-kit for drag-and-drop. Requires per-tab state isolation, proportional pane resizing, split zone drop targets. Overkill for an analytics dashboard. | Open two browser tabs and use OS window tiling. Browser handles this natively with zero code. |
| **Virtual scrolling** | Smooth infinite scroll through huge conversations | Grouped/collapsed view already reduces DOM nodes drastically. Virtual scrolling with variable-height items (markdown, diffs, code blocks, nested tool calls) is notoriously buggy. @tanstack/vue-virtual requires either fixed row heights or expensive dynamic measurement. Breaks browser Cmd+F. | Keep pagination with current page size. The collapse pattern already solves the performance problem. Collapsed groups are ~3 DOM nodes each. |
| **Context window reconstruction (7 categories)** | See exactly how the context window fills | Extremely complex to reverse-engineer from JSONL. Need to separately count CLAUDE.md tokens, @-mention file tokens, tool I/O tokens, thinking tokens, coordination overhead. claude-devtools's most innovative but highest-maintenance feature. Changes whenever Claude Code changes internal formats. | Show total tokens per turn (already built) plus compaction boundaries (new). Covers 80% of the insight at 10% of the effort. |
| **Real-time streaming display** | See Claude's response as it generates | Requires watching files mid-write, parsing partial JSONL, reconciling partial with final state. File watcher already detects completed turns within seconds. Marginal analytics value. | Keep file-watcher approach. "Last updated" timestamps convey freshness. |
| **Light mode** | User preference for bright themes | DaisyUI makes this easy (just add a theme), but it is low priority for a developer tool. Most dev tools default dark. Would need to audit all custom oklch colors and ensure chart themes work in both modes. | Defer to a future polish pass. When ready: add DaisyUI `light` theme, extend `getChartThemeColors()` utility, toggle via `data-theme` attribute. |
| **Session pinning/hiding** | Organize favorites | New database table, API endpoints, sidebar state management. Low value when conversations are already searchable, sortable, and filterable. Command palette provides fast access. | Command palette (Cmd+K) solves the "find that conversation quickly" use case without persistent state. |

## Feature Dependencies

```
[Streaming deduplication (backend)]
    (independent -- improves accuracy of ALL token/cost displays)

[DiffViewer component]
    (standalone new component)

[CodeBlockViewer component]
    (standalone new component)

[Tool-specific input rendering]
    |-- requires --> [DiffViewer] (Edit tool dispatches here)
    |-- requires --> [CodeBlockViewer] (Read/Write tools dispatch here)

[Always-visible AI response]
    (standalone change to AssistantGroupCard.vue)

[User message truncation]
    (standalone change to ChatMessage.vue)

[Semantic message colors]
    (standalone CSS changes to AssistantGroupCard.vue / ToolCallRow.vue)

[Keyboard shortcuts infrastructure]
    (standalone composable, needs @vueuse/core dependency)

[In-conversation search (Cmd+F)]
    |-- benefits from --> [Keyboard shortcuts infrastructure]
    (can work standalone with raw addEventListener)

[Command palette (Cmd+K)]
    |-- requires --> [Keyboard shortcuts infrastructure] (Cmd+K binding)
    |-- enhances --> [In-conversation search] (discoverable from palette)

[Compaction boundaries]
    |-- requires --> [Backend: compaction detection during ingestion]

[Subagent traces]
    |-- requires --> [Backend: subagent JSONL resolution and linking]
    |-- enhances --> [Tool-specific input rendering] (Task tool gets its own viewer)
```

### Dependency Notes

- **Tool-specific input rendering depends on DiffViewer and CodeBlockViewer:** The dispatch logic in `ToolCallRow.vue` needs these components to exist before it can route Edit/Read/Write tools to them. Build the viewer components first.
- **Command palette depends on keyboard shortcuts:** The Cmd+K binding needs a way to register and not conflict with other shortcuts. Build the shortcuts composable first.
- **Streaming deduplication is fully independent:** Backend-only change that immediately improves accuracy of all existing token/cost displays. No frontend changes needed. Do this early.
- **Subagent traces are highest-risk:** Requires scanning additional JSONL files on disk, three-phase matching algorithm, new database relationships, and a new frontend component. Most likely to need mid-implementation research.
- **Display quick wins are all independent:** Always-visible response, truncation, and semantic colors can all be done in parallel with no dependencies on each other.

## MVP Definition

### Phase 1: Display Quick Wins

Highest impact, lowest effort. No new npm dependencies needed.

- [ ] **Always-visible AI response on collapsed groups** -- the single most impactful UX change for conversation scanning
- [ ] **User message truncation at 500 chars** -- prevents viewport domination by pasted content
- [ ] **Semantic message colors** -- purple/amber/green/red tints for instant visual scanning
- [ ] **Code cleanup** -- getTurnContent bug fix, remove unused ToolCallCard.vue, extract duplicated markdown CSS, consolidate cost formatters

### Phase 2: Tool Viewers

Core differentiating features. Requires adding `diff` npm package.

- [ ] **DiffViewer component** -- LCS diff rendering for Edit tool calls
- [ ] **CodeBlockViewer component** -- syntax highlighting + line numbers for Read/Write results
- [ ] **Tool-specific input rendering dispatch** -- Bash commands, file paths, diffs, code viewers by tool name

### Phase 3: Navigation and Shortcuts

Power-user features. Requires adding `@vueuse/core`.

- [ ] **Keyboard shortcuts composable** -- central registry with VueUse `useMagicKeys`
- [ ] **In-conversation search (Cmd+F)** -- floating search bar, match highlighting, prev/next navigation
- [ ] **Command palette (Cmd+K)** -- conversation search, page navigation, action dispatch

### Phase 4: Data Quality and Advanced Display

Backend-focused improvements. Most complex phase.

- [ ] **Streaming deduplication by requestId** -- fixes token overcounting in Claude normalizer
- [ ] **Compaction boundary detection and visualization** -- amber markers with token deltas
- [ ] **Subagent execution traces** -- resolve sub-agent JSONL files, render nested summaries

### Defer to Future Milestones

- **Multi-pane layout** -- use browser tabs instead
- **Virtual scrolling** -- collapse pattern handles performance
- **Context window reconstruction** -- token counts + compaction boundaries cover 80% of the value
- **Light mode** -- low priority, easy when ready (DaisyUI theme toggle)
- **Session pinning** -- command palette covers the quick-access use case

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Always-visible AI response | HIGH | LOW | P1 |
| LCS diff viewer (Edit tool) | HIGH | MEDIUM | P1 |
| Code viewer (Read/Write tools) | HIGH | LOW-MEDIUM | P1 |
| Tool-specific input rendering | HIGH | MEDIUM | P1 |
| Streaming deduplication | HIGH | MEDIUM | P1 |
| User message truncation | MEDIUM | LOW | P1 |
| Semantic message colors | MEDIUM | LOW | P1 |
| Code cleanup / bug fixes | LOW | LOW | P1 |
| In-conversation search (Cmd+F) | HIGH | MEDIUM | P2 |
| Command palette (Cmd+K) | MEDIUM | MEDIUM-HIGH | P2 |
| Keyboard shortcuts | MEDIUM | LOW-MEDIUM | P2 |
| Compaction boundaries | MEDIUM | MEDIUM | P2 |
| Subagent execution traces | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have -- closes the primary UX gaps, fixes data accuracy
- P2: Should have -- power-user features that signal a polished developer tool
- P3: Nice to have -- high complexity, defer if time-constrained

## Competitor Feature Analysis

| Feature | claude-devtools | cowboy (current v1.3) | cowboy (v2.0 target) |
|---------|----------------|----------------------|---------------------|
| Collapsed group preview | Always shows last AI output text | Header snippet only (truncated first line) | Full last-output display below header (markdown rendered, 3-4 line clamp) |
| Edit tool rendering | LCS diff with line numbers, +N/-N stats, red/green | Raw JSON of `old_string`/`new_string` | LCS diff via `diff` npm package with line numbers and colored backgrounds |
| Read tool rendering | Syntax highlighted, line numbers, language badge, file header | Raw highlighted JSON output | `CodeBlockViewer` with highlight.js, line numbers, language detection from path |
| Tool input format | Tool-specific (Bash: command block, Read: file path, Edit: diff) | JSON dump for all tools | Dispatch by `toolCall.name` with specialized renderers |
| In-conversation search | Cmd+F floating bar, "X of Y" counter, Enter/Shift+Enter nav | None (relies on browser Cmd+F which searches whole page) | Custom Cmd+F override, floating bar, `<mark>` highlighting, match navigation |
| Command palette | Cmd+K modal, full-text search, global toggle Cmd+G | None | Custom modal with conversation search, page navigation, action dispatch |
| Keyboard shortcuts | Cmd+B sidebar, Cmd+1-9 tabs, Ctrl+Tab, arrow keys | None | VueUse `useMagicKeys`, Cmd+B/K/F, J/K navigation, `?` cheat sheet |
| Compaction display | Amber boundary, "45k -> 12k (33k freed)" token delta | None | `CompactionBoundary.vue` with amber accent and token delta |
| Subagent traces | Nested card with recursive tool display | None (Task tool shows raw JSON) | Flat summary card within parent Task tool call row |
| Message colors | Purple thinking, amber tools, green/red results | Uniform styling (no semantic color) | oklch-based semantic tints matching claude-devtools palette |
| Streaming dedup | requestId-based, keeps last entry only | Not implemented (potential token overcounting) | Backend ingestion fix: group by requestId, keep last |
| User msg truncation | 500 chars with "Show more" toggle | Full content always rendered | 500-char limit with expandable toggle |

## Implementation Notes

### New Dependencies Required

| Library | Purpose | Weekly Downloads | Size | Notes |
|---------|---------|-----------------|------|-------|
| `diff` | LCS text diffing for Edit tool viewer | ~49M/week | 42KB min | `diffLines(old, new)` returns `{added, removed, value}[]`. Framework-agnostic. 10+ years mature. Used by Jest, Mocha, and most test frameworks internally. |
| `@vueuse/core` | Keyboard shortcuts (`useMagicKeys`, `onKeyStroke`), `onClickOutside` for palette | ~3.5M/week | Tree-shakeable | Standard Vue 3 utility library. Also provides `useEventListener`, `useFocus`, `useActiveElement`. Only import what is used -- Vite tree-shakes the rest. |

### Libraries Already Available (no new installs)

| Library | Already In Project | Relevant For |
|---------|-------------------|-------------|
| `highlight.js` v11.11.1 | Yes | CodeBlockViewer syntax highlighting, already configured |
| `@highlightjs/vue-plugin` v2.1.0 | Yes | Vue integration for highlight.js |
| `marked` v17.0.4 | Yes | Always-visible AI response markdown rendering |
| `dompurify` v3.3.2 | Yes | Search match highlighting (`<mark>` tags already in ALLOWED_TAGS) |
| `lucide-vue-next` | Yes | Icons for search bar, command palette, tool viewers |
| `vue-router` v4.5.0 | Yes | Command palette page navigation |

### Libraries Evaluated and Rejected

| Library | Why Considered | Why Rejected |
|---------|---------------|-------------|
| `vue-command-palette` | Vue 3 port of cmdk pattern | Last published 2+ years ago (v0.2.3). Low maintenance. Command palettes are simple enough to build custom: modal + input + filtered list. |
| `diff2html` | Generates complete diff HTML from unified diff format | Too opinionated -- generates its own HTML structure. We want raw diff data to render with Vue templates and DaisyUI styling. |
| `react-diff-viewer` | Popular diff component | React-specific, not usable in Vue. |
| `fuse.js` | Fuzzy search for command palette | Overkill for <1000 items. Simple `toLowerCase().includes()` is sufficient and adds zero bundle size. |
| `@tanstack/vue-virtual` | Virtual scrolling | Collapse pattern already solves DOM performance. Variable-height virtual scrolling with nested components is fragile. |

## Sources

- `LEARNINGS.md` -- Detailed claude-devtools codebase analysis (HIGH confidence, primary reference)
- [jsdiff / diff npm package](https://github.com/kpdecker/jsdiff) -- LCS diff library, 49M weekly downloads
- [VueUse useMagicKeys](https://vueuse.org/core/usemagickeys/) -- Reactive keyboard shortcut composable
- [VueUse onKeyStroke](https://vueuse.org/core/onkeystroke/) -- Key event listener composable
- [vue-command-palette](https://github.com/xiaoluoboding/vue-command-palette) -- Evaluated, not recommended (stale)
- [awesome-command-palette](https://github.com/stefanjudis/awesome-command-palette) -- Survey of command palette implementations
- [diff2html](https://diff2html.xyz/) -- Evaluated, not recommended (too opinionated for Vue integration)
- [Window.find() MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/find) -- Browser find-in-page API reference

---
*Feature research for: cowboy v2.0 UX overhaul*
*Researched: 2026-03-09*
