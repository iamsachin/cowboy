# Architecture Research: v2.0 Feature Integration

**Domain:** Coding agent analytics dashboard -- integrating new display, search, and data quality features into existing Vue 3 + Fastify + SQLite monorepo
**Researched:** 2026-03-09
**Confidence:** HIGH (based on direct codebase analysis and LEARNINGS.md from claude-devtools)

## System Overview: Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (Vue 3 + Vite)                       │
│  ┌──────────────┐  ┌───────────────────┐  ┌──────────────────────┐  │
│  │ Pages        │  │ Components         │  │ Composables          │  │
│  │ (6 routes)   │  │ (32 .vue files)    │  │ (14 .ts files)       │  │
│  └──────┬───────┘  └────────┬──────────┘  └──────────┬───────────┘  │
│         │                   │                        │              │
│         └───────────────────┼────────────────────────┘              │
│                             │                                       │
│  ┌──────────────────────────┴───────────────────────────────────┐   │
│  │ Utils: content-parser, content-sanitizer, render-markdown,   │   │
│  │        tool-icons, format-tokens, model-labels, chart-theme  │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
├─────────────────────────────┼───────────────────────────────────────┤
│            REST API + WebSocket (Fastify)                            │
├─────────────────────────────┼───────────────────────────────────────┤
│                        Backend (Node.js)                             │
│  ┌──────────────┐  ┌───────┴──────────┐  ┌──────────────────────┐  │
│  │ Routes       │  │ Ingestion        │  │ DB (SQLite+Drizzle)  │  │
│  │ (4 modules)  │  │ (12 .ts files)   │  │ (schema + queries)   │  │
│  └──────────────┘  └──────────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│  Shared Types (packages/shared)                                      │
│  api.ts, database.ts, analytics.ts, pricing.ts                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Current Conversation Display Pipeline

```
JSONL on disk
  -> claude-code-parser.ts (chunkMap by message.id, final-chunk usage)
    -> normalizer.ts (NormalizedData: conversation, messages, toolCalls, tokenUsage)
      -> SQLite (4 tables)
        -> REST API /api/analytics/conversations/:id
          -> useConversationDetail.ts (fetch -> ConversationDetailResponse)
            -> ConversationDetail.vue (groupTurns -> visibleTurns)
              -> AssistantGroupCard.vue (collapsible groups)
                -> ToolCallRow.vue (generic JSON display for all tools)
```

**Key integration point:** ToolCallRow.vue is the single component rendering ALL tool types identically. This is where tool-specific viewers plug in.

## New Components to Create

### Tier 1: Tool-Specific Viewers (plug into ToolCallRow.vue)

| Component | Location | Purpose | Replaces |
|-----------|----------|---------|----------|
| `DiffViewer.vue` | `components/viewers/` | LCS-based red/green diff for Edit tool | Raw JSON of old_string/new_string |
| `CodeViewer.vue` | `components/viewers/` | Syntax-highlighted file content with line numbers | Raw output text |
| `BashInputDisplay.vue` | `components/viewers/` | Shows description + command naturally | Raw JSON dump |
| `FilePathHeader.vue` | `components/viewers/` | File path + language badge + line range | Nothing (missing) |

**Integration pattern:** ToolCallRow.vue dispatches to the appropriate viewer by `toolCall.name`:

```typescript
// In ToolCallRow.vue, replace the generic <pre><code> blocks:
// Edit -> DiffViewer (input.old_string, input.new_string, input.file_path)
// Read -> CodeViewer (output text, infer language from file_path)
// Write -> CodeViewer (input.content or input.file_text, file_path)
// Bash -> BashInputDisplay (input.description, input.command)
// Others -> existing JSON display (unchanged)
```

The dispatch is purely in the template -- no new data flow needed. ToolCallRow already has `toolCall.input` (typed as `unknown`, cast to `Record<string, unknown>`) and `toolCall.output`.

### Tier 2: Conversation Display Enhancements (modify existing components)

| Change | Component | What Changes |
|--------|-----------|-------------|
| Always-visible AI response | `AssistantGroupCard.vue` | Add `lastOutputPreview` below header when collapsed. Extract final text turn content, truncate to ~300 chars, render as markdown. |
| User message truncation | `ChatMessage.vue` | Add 500-char limit with "Show more" toggle via reactive `expanded` ref |
| Semantic message colors | `AssistantGroupCard.vue` | Purple tint on thinking `<details>`, amber tint on tool call rows, green/red on tool results by status |

**No new components needed** -- these are modifications to existing ones. The data is already available in the current props.

### Tier 3: Search and Navigation (new top-level systems)

| Component | Location | Purpose | Integration Point |
|-----------|----------|---------|-------------------|
| `ConversationSearch.vue` | `components/` | Floating Cmd+F bar with "X of Y" match navigation | Mounted inside `ConversationDetail.vue`, uses DOM `mark` elements + scrollIntoView |
| `CommandPalette.vue` | `components/` | Cmd+K modal with conversation search | Mounted in `App.vue` (root level), calls existing `/api/analytics/conversations/search` endpoint |
| `useKeyboardShortcuts.ts` | `composables/` | Global keyboard handler composable | Registered in `App.vue`, dispatches to sidebar toggle, search, palette |

### Tier 4: Data Quality (backend ingestion changes)

| Change | File | What Changes |
|--------|------|-------------|
| Streaming dedup | `claude-code-parser.ts` | Deduplicate JSONL entries sharing same `requestId`, keeping only the final entry per request |
| Compaction detection | `normalizer.ts` + `groupTurns` | Detect `isCompactSummary` flag in JSONL entries, emit a `compaction-boundary` turn type with token delta |
| Subagent resolution | `normalizer.ts` + new `subagent-resolver.ts` | Link Agent/Task tool calls to their subagent JSONL files, embed subagent message summaries |

## Detailed Data Flow Changes

### 1. Tool-Specific Viewers (Frontend Only -- No Data Flow Changes)

No data flow changes. The data is already in `toolCall.input` and `toolCall.output`. The change is purely presentation logic inside ToolCallRow.vue.

```
ToolCallRow.vue
  |-- toolCall.name === 'Edit'
  |    -> parse input as { file_path, old_string, new_string }
  |    -> DiffViewer.vue computes LCS diff client-side
  |    -> renders red/green lines with line numbers
  |
  |-- toolCall.name === 'Read'
  |    -> parse input as { file_path, offset?, limit? }
  |    -> CodeViewer.vue renders output with highlight.js
  |    -> FilePathHeader shows path + inferred language
  |
  |-- toolCall.name === 'Write'
  |    -> parse input as { file_path, content/file_text }
  |    -> CodeViewer.vue renders written content
  |
  |-- toolCall.name === 'Bash'
  |    -> parse input as { command, description? }
  |    -> BashInputDisplay shows description then command in code element
  |
  +-- default -> existing JSON display
```

### 2. In-Conversation Search (Frontend Only -- No API Changes)

```
User presses Cmd+F
  -> ConversationSearch.vue appears (floating bar, top-right)
  -> User types query
  -> Debounced search (200ms) walks DOM of conversation container
  -> Uses TreeWalker API to find text nodes matching query
  -> Wraps matches in <mark> elements (DOMPurify already allows <mark>)
  -> Tracks match count and current index
  -> Enter/Shift+Enter navigates between matches via scrollIntoView
  -> Escape closes search bar and removes <mark> elements
```

**No API calls needed.** Search is purely client-side within the already-loaded conversation DOM. The existing DOMPurify config with `ALLOWED_TAGS: ['mark']` already supports this pattern (shipped in v1.3).

### 3. Command Palette (Frontend + Existing API)

```
User presses Cmd+K
  -> CommandPalette.vue appears (modal with backdrop-blur)
  -> User types query (200ms debounce)
  -> Calls existing /api/analytics/conversations/search?q={query}
  -> Returns SearchConversationListResponse (already defined in shared/types/api.ts)
  -> Results show title, project, agent badge, snippet
  -> Enter/click navigates via router.push({ name: 'conversation-detail', params: { id } })
  -> Also includes static navigation items (Overview, Conversations, Agents, etc.)
```

**No new API endpoints needed.** The `SearchConversationListResponse` type and search endpoint already exist.

### 4. Streaming Deduplication (Backend Parser Change)

```
Current flow:
  JSONL line -> type check (user/assistant) -> processAssistantChunk -> chunkMap[message.id]

Analysis of current parser (claude-code-parser.ts):
  - chunkMap keyed by message.id accumulates all chunks for one API response
  - finalUsage only captured when stop_reason != null (final chunk)
  - This ALREADY handles intra-response streaming dedup correctly

The REMAINING dedup issue is at the JSONL entry level:
  Claude Code sometimes writes the ENTIRE conversation state as new JSONL entries
  with a requestId field. Multiple entries with the same requestId at different
  streaming stages can cause duplicate content blocks to be appended.

Fix approach:
  In parseJsonlFile, before processing each line:
  1. Extract requestId from parsed JSON (if present)
  2. Track seen requestIds with their latest line data
  3. For entries sharing a requestId, only process the one with stop_reason
     (final streaming entry) -- skip intermediate streaming snapshots
  4. Entries without requestId process normally (backward compat)
```

### 5. Compaction Detection (Backend + Frontend)

```
Backend changes:
  claude-code-parser.ts
    -> Check for type: 'summary' or isCompactSummary flag in JSONL entries
    -> Extract token counts before/after if available
    -> Store as special message with a compaction marker in metadata

  normalizer.ts
    -> Emit compaction events as messages with role='system'
       and a distinguishing field (e.g., content prefix or metadata flag)

Frontend changes:
  useGroupedTurns.ts
    -> Add new turn type: 'compaction-boundary'
    -> Detect compaction markers during message classification

  CompactionBoundary.vue (NEW component)
    -> Full-width amber accent bar
    -> Shows token delta: "45k -> 12k (33k freed)"
    -> Expandable to show compacted content summary

  ConversationDetail.vue
    -> Add CompactionBoundary to the turn type v-if chain in template
```

### 6. Subagent Resolution (Backend + Frontend -- Most Complex)

```
Backend:
  NEW: subagent-resolver.ts
    -> When normalizer encounters Agent/Task tool calls:
      1. Extract subagent session ID from tool call output or input metadata
      2. Scan ~/.claude/projects/*/ for matching subagent JSONL files
      3. Parse the subagent JSONL file (reuse parseJsonlFile)
      4. Attach summary to the parent tool call's output field:
         { originalOutput: "...", subagentSummary: { toolCalls: [...], output: "..." } }

  normalizer.ts
    -> After building toolCalls array, run subagent resolution pass
    -> Enriches Agent/Task tool call output with subagent metadata

Frontend:
  SubagentTrace.vue (NEW component)
    -> Rendered inside ToolCallRow when toolCall.name is 'Agent' or 'Task'
    -> Shows nested tool call list from subagent session
    -> Collapsible card with execution summary header

  ToolCallRow.vue
    -> For Agent/Task tool calls, check output for subagentSummary field
    -> If present, render SubagentTrace below the standard output
```

## Component Responsibilities Summary

| Component | Current Responsibility | v2.0 Changes |
|-----------|----------------------|-------------|
| `ConversationDetail.vue` | Groups turns, pagination, expand/collapse | Add ConversationSearch mount point, CompactionBoundary rendering |
| `AssistantGroupCard.vue` | Collapsible response groups with header stats | Add always-visible last output, semantic colors (purple/amber) |
| `ToolCallRow.vue` | Generic JSON display for all tool types | Dispatch to DiffViewer/CodeViewer/BashInputDisplay by tool name |
| `ChatMessage.vue` | User message bubble | Add 500-char truncation with "Show more" |
| `App.vue` | Layout shell (sidebar + router-view) | Mount CommandPalette, register useKeyboardShortcuts |
| `AppSidebar.vue` | Navigation menu + quick stats | Respond to Cmd+B toggle from keyboard shortcuts |

## Recommended Project Structure for New Files

```
packages/frontend/src/
|-- components/
|   |-- viewers/                    # NEW directory: tool-specific viewers
|   |   |-- DiffViewer.vue          # LCS diff display for Edit tool
|   |   |-- CodeViewer.vue          # Syntax-highlighted file viewer for Read/Write
|   |   |-- BashInputDisplay.vue    # Natural bash command display
|   |   +-- FilePathHeader.vue      # Shared file path + language badge
|   |-- CompactionBoundary.vue      # NEW: compaction visualization
|   |-- ConversationSearch.vue      # NEW: Cmd+F in-conversation search
|   |-- CommandPalette.vue          # NEW: Cmd+K global search/nav
|   +-- SubagentTrace.vue           # NEW: nested subagent display
|-- composables/
|   +-- useKeyboardShortcuts.ts     # NEW: global keyboard handler
|-- utils/
|   +-- lcs-diff.ts                 # NEW: LCS diff algorithm (pure function)

packages/backend/src/
|-- ingestion/
|   +-- subagent-resolver.ts        # NEW: resolves subagent JSONL files
```

**Total new files:** 10 (7 frontend components, 1 composable, 1 utility, 1 backend module)
**Modified files:** 6 (ToolCallRow, AssistantGroupCard, ChatMessage, ConversationDetail, App.vue, claude-code-parser.ts)

## Architectural Patterns

### Pattern 1: Tool Viewer Dispatch

**What:** ToolCallRow.vue uses a v-if chain on `toolCall.name` to render tool-specific viewers, falling back to generic JSON for unknown tools.

**When to use:** Any time tool calls need specialized rendering. The pattern is extensible -- adding a viewer for Grep or Glob later requires only adding a case.

**Trade-offs:** Keeps ToolCallRow as the single entry point (no scattered tool rendering logic), but increases its template complexity. Acceptable because the dispatch is a simple v-if chain, not deep logic.

```vue
<!-- In ToolCallRow.vue template, replacing generic input/output sections -->
<DiffViewer
  v-if="toolCall.name === 'Edit'"
  :filePath="parsedInput.file_path"
  :oldText="parsedInput.old_string"
  :newText="parsedInput.new_string"
/>
<CodeViewer
  v-else-if="toolCall.name === 'Read' || toolCall.name === 'Write'"
  :filePath="parsedInput.file_path"
  :content="toolCall.name === 'Read' ? outputText : parsedInput.content"
  :language="inferLanguage(parsedInput.file_path)"
/>
<BashInputDisplay
  v-else-if="toolCall.name === 'Bash'"
  :command="parsedInput.command"
  :description="parsedInput.description"
/>
<!-- Default: existing JSON display unchanged -->
<template v-else>
  <!-- current <pre><code> blocks -->
</template>
```

### Pattern 2: Client-Side DOM Search

**What:** In-conversation search uses TreeWalker to find text matches in the already-rendered DOM, wrapping them in `<mark>` elements. No data-layer re-rendering.

**When to use:** When searching within an already-loaded page of content. Avoids expensive re-renders of markdown and syntax highlighting.

**Trade-offs:** Only searches visible/loaded content (not beyond PAGE_SIZE=50 pagination boundary). Mitigation: show "Showing X matches in loaded content" note, with option to load all turns first.

```typescript
// Conceptual approach for useConversationSearch composable
function searchInDOM(query: string, container: HTMLElement): HTMLElement[] {
  clearPreviousMarks(container);
  if (!query) return [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const marks: HTMLElement[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    // Find all occurrences in this text node
    // Split and wrap matching portions in <mark> elements
  }
  return marks;
}
```

### Pattern 3: LCS Diff as Pure Utility

**What:** The diff algorithm lives in `utils/lcs-diff.ts` as a pure function. DiffViewer.vue calls it and renders the result. Separation enables unit testing without Vue test infrastructure.

**When to use:** Any computation-heavy logic that benefits from independent testing.

**Trade-offs:** Extra import, but enables testing the O(n*m) algorithm in isolation with edge cases.

```typescript
// utils/lcs-diff.ts
export interface DiffLine {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export function computeDiff(oldText: string, newText: string): DiffLine[] {
  // LCS-based line diff algorithm
}

export function diffStats(lines: DiffLine[]): { additions: number; deletions: number } {
  return lines.reduce(
    (acc, line) => {
      if (line.type === 'add') acc.additions++;
      if (line.type === 'remove') acc.deletions++;
      return acc;
    },
    { additions: 0, deletions: 0 }
  );
}
```

### Pattern 4: Centralized Keyboard Shortcut Registration

**What:** A single composable in App.vue registers all global keyboard shortcuts, preventing conflicts and ensuring cleanup on unmount.

**When to use:** When multiple features (sidebar, search, palette) share the global keydown namespace.

**Trade-offs:** Components cannot independently register shortcuts (must go through the central handler), but this prevents duplicate handlers and zombie listeners.

```typescript
// composables/useKeyboardShortcuts.ts
export function useKeyboardShortcuts(options: {
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  onOpenPalette: () => void;
}) {
  function handler(e: KeyboardEvent) {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key === 'b') { e.preventDefault(); options.onToggleSidebar(); }
    if (meta && e.key === 'f') { e.preventDefault(); options.onOpenSearch(); }
    if (meta && e.key === 'k') { e.preventDefault(); options.onOpenPalette(); }
  }
  onMounted(() => window.addEventListener('keydown', handler));
  onUnmounted(() => window.removeEventListener('keydown', handler));
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Tool Viewer Component

**What people do:** Put all tool-specific rendering logic (diff, code, bash) into a single giant component with complex conditional templates.

**Why it's wrong:** Creates a 500+ line component that is hard to test and maintain. Each viewer has different props, state, and styling needs.

**Do this instead:** Separate viewer components in a `viewers/` directory, dispatched by ToolCallRow.vue. Each viewer is independently testable.

### Anti-Pattern 2: Re-rendering for Search Highlights

**What people do:** Store search results in reactive state, re-render the entire conversation with highlight markers in the data layer.

**Why it's wrong:** Causes expensive re-renders of the entire conversation tree (markdown parsing, syntax highlighting) just to add `<mark>` tags. With 50+ groups, this is visibly slow.

**Do this instead:** Use DOM-level TreeWalker to find and wrap text nodes. This is O(text nodes) not O(components), and does not trigger Vue's reactivity system.

### Anti-Pattern 3: Computing LCS Diff on Every Render

**What people do:** Call the diff algorithm inside a computed property that runs on every re-render.

**Why it's wrong:** LCS is O(n*m) where n and m are line counts. For large files, this can take 50-100ms per render.

**Do this instead:** Compute diff once when the tool call details are expanded (lazy), and cache the result in a ref. The diff inputs (old_string, new_string) are immutable props, so the result never needs recomputation.

### Anti-Pattern 4: Intercepting Cmd+F Globally on All Pages

**What people do:** Prevent default Cmd+F behavior everywhere, replacing the browser's native find.

**Why it's wrong:** Users still expect browser find to work on non-conversation pages (Overview, Analytics, etc.).

**Do this instead:** Only intercept Cmd+F when on the conversation detail route. Check `router.currentRoute.value.name === 'conversation-detail'` before preventing default. On other pages, let the browser handle it natively.

### Anti-Pattern 5: Backend API Changes for Display Features

**What people do:** Add new API endpoints or modify existing response shapes to support tool-specific viewers.

**Why it's wrong:** The data for all tool viewers already exists in `toolCall.input` (object with tool-specific fields) and `toolCall.output` (string). No backend changes needed for display-only features.

**Do this instead:** Parse `toolCall.input` on the frontend by casting from `unknown` to the expected shape per tool name. Add a utility like `parseToolInput(name: string, input: unknown)` that returns typed objects.

## Build Order with Dependencies

```
Independent (no deps on each other):
  1. DiffViewer + lcs-diff.ts (pure frontend, highest UX impact)
  2. CodeViewer + FilePathHeader (pure frontend)
  3. BashInputDisplay (pure frontend)
  4. Always-visible AI response (modify AssistantGroupCard)
  5. User message truncation (modify ChatMessage)
  6. Semantic colors (modify AssistantGroupCard)

Depends on conversation display working:
  7. In-conversation search (needs DOM to search in)
  8. Keyboard shortcuts (needs search/palette to dispatch to)

Depends on keyboard shortcuts:
  9. Command palette (needs Cmd+K binding)

Backend changes (independent of frontend display features):
  10. Streaming dedup (parser change -- verify existing dedup first)
  11. Compaction detection (parser + normalizer + new frontend component)
  12. Subagent resolution (new resolver + normalizer enrichment + new frontend component)
```

**Recommended phase grouping:**

| Phase | Features | Rationale |
|-------|----------|-----------|
| Phase 1 | DiffViewer, CodeViewer, BashInputDisplay, FilePathHeader | Highest-impact pure additions, zero regression risk |
| Phase 2 | Always-visible response, user truncation, semantic colors | Existing component modifications, isolated changes |
| Phase 3 | useKeyboardShortcuts, ConversationSearch (Cmd+F) | Navigation foundation |
| Phase 4 | CommandPalette (Cmd+K) | Depends on keyboard infrastructure |
| Phase 5 | Streaming dedup verification/fix | Backend data quality, independent |
| Phase 6 | Compaction detection + CompactionBoundary | Backend + frontend, moderate complexity |
| Phase 7 | Subagent resolution + SubagentTrace | Most complex, highest risk |
| Phase 8 | Code cleanup (getTurnContent bug, unused components, CSS dedup, cost formatter) | Safe cleanup after features land |

## Integration Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| DiffViewer perf on large files | Medium | Cap input at 500 lines, show "File too large for inline diff" with raw view fallback |
| Cmd+F conflicting with browser find | Medium | Only intercept on conversation-detail route |
| Streaming dedup changing historical token counts | Low | Run before/after comparison on sample conversations to quantify accuracy improvement |
| Subagent JSONL file discovery | High | Subagent files may not be in predictable locations; need robust file scanning with graceful fallback to "subagent data not available" |
| Compaction detection false positives | Medium | Only flag entries with explicit `isCompactSummary` or `type: 'summary'` -- never guess from token drops |
| Command palette search latency | Low | Existing search API works; add 200ms debounce and limit to 20 results |
| ToolCallRow template complexity | Low | The v-if chain is shallow; each viewer is a separate SFC keeping ToolCallRow manageable |

## Sources

- Direct codebase analysis of cowboy monorepo (packages/frontend, packages/backend, packages/shared)
- LEARNINGS.md: Detailed analysis of claude-devtools architecture, 1835+ star reference implementation
- PROJECT.md: v2.0 milestone scope and constraints
- Existing component implementations: ConversationDetail.vue, AssistantGroupCard.vue, ToolCallRow.vue, ChatMessage.vue, AppSidebar.vue
- Existing composables: useGroupedTurns.ts, useConversationDetail.ts, useCollapseState.ts
- Shared types: ConversationDetailResponse, SearchConversationListResponse, ToolCallRow in packages/shared/src/types/api.ts
- Backend parser: claude-code-parser.ts (chunkMap dedup pattern), normalizer.ts (NormalizedData pipeline)

---
*Architecture research for: cowboy v2.0 UX Overhaul -- feature integration into existing codebase*
*Researched: 2026-03-09*
