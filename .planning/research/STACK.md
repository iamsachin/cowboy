# Stack Research

**Domain:** Coding agent analytics dashboard -- v2.0 UX overhaul additions
**Researched:** 2026-03-09
**Confidence:** HIGH

## Context

This research covers ONLY the new libraries needed for v2.0 features. The existing stack (Vue 3, Vite, DaisyUI, Fastify, SQLite, Drizzle, marked, DOMPurify, highlight.js, Lucide Vue, chart.js) is validated and not re-evaluated.

## Recommended Stack Additions

### New Frontend Dependencies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `diff` (jsdiff) | ^8.0.3 | LCS diff computation for Edit tool viewer | De facto standard JS text diff library. 8000+ dependents on npm. Ships with TypeScript types since v8. Provides `diffLines()` which is exactly what we need for old_string vs new_string comparison in Edit tool calls. Zero dependencies. |
| `fuse.js` | ^7.1.0 | Fuzzy search for command palette (Cmd+K) | Lightweight (< 5KB gzipped), zero dependencies, client-side fuzzy matching. Used by Nuxt UI command palette internally. Perfect for searching conversation titles, tool names, project names without a backend round-trip. |
| `@vueuse/core` | ^14.2.1 | Keyboard shortcuts, event handling utilities | The standard Vue 3 composable utility library. `useMagicKeys` provides reactive key combination detection (Cmd+K, Cmd+F, Cmd+B) with zero boilerplate. Also gives `onClickOutside` for closing command palette, `useEventListener` for safe DOM event binding, `onKeyStroke` for individual key handling. One dependency covers multiple shortcut and UI interaction needs. Tree-shakeable -- only import what you use. |

### No New Backend Dependencies

The v2.0 features are predominantly frontend. Backend changes use existing capabilities:

| Backend Feature | Implementation | Why No Library |
|-----------------|---------------|----------------|
| Streaming dedup by `requestId` | Pure logic in claude-normalizer: group JSONL entries by requestId, keep last per group | Simple Map-based dedup, ~20 lines |
| Compaction detection | Pattern match on `isCompactSummary` flag in parsed messages | Boolean field check in existing parser |
| Subagent JSONL resolution | `fs/promises` + existing JSONL line parser to read `~/.claude/projects/**/subagent-*.jsonl` | Same file reading logic already used for main conversation JSONL |

### Explicitly NOT Adding Virtual Scrolling

PROJECT.md puts "Virtualized/windowed rendering" out of scope. This is correct: conversations use load-more pagination (PAGE_SIZE=50) and most DOM reduction comes from collapsed AssistantGroupCards. Adding `@tanstack/vue-virtual` (v3.13.19) would require rearchitecting the conversation display for marginal benefit. **Do not add it.**

## Feature-to-Library Mapping

| v2.0 Feature | New Library | Integration Point |
|--------------|-------------|-------------------|
| LCS diff viewer (Edit tool) | `diff` | New `DiffViewer.vue`, dispatched from `ToolCallRow.vue` when tool name is "Edit" |
| Code viewer (Read tool) | None (existing `highlight.js`) | New `CodeBlockViewer.vue` with line numbers via CSS counters, dispatched from `ToolCallRow.vue` when tool is "Read" |
| Always-visible AI response | None | Modify `AssistantGroupCard.vue` to render last text output below collapsed header |
| User message truncation | None | CSS `line-clamp` + "Show more" toggle in `ChatMessage.vue` |
| Semantic message colors | None | CSS classes using existing oklch color system in DaisyUI |
| In-conversation search (Cmd+F) | `@vueuse/core` | New `ConversationSearch.vue` floating bar, `useMagicKeys` for shortcut binding |
| Command palette (Cmd+K) | `fuse.js` + `@vueuse/core` | New `CommandPalette.vue` modal with DaisyUI styling, Fuse index over conversations/routes |
| Keyboard shortcuts | `@vueuse/core` | `useMagicKeys` composable in App.vue or a dedicated `useShortcuts` composable |
| Streaming deduplication | None | Backend normalizer logic change |
| Compaction detection | None | Backend normalizer + new `CompactionBoundary.vue` display component |
| Subagent execution traces | None | Backend JSONL resolution + new `SubagentTrace.vue` display component |
| Tool-specific input rendering | None | Conditional rendering in `ToolCallRow.vue` by tool name |

## Installation

```bash
# From packages/frontend/
pnpm add diff fuse.js @vueuse/core
pnpm add -D @types/diff
```

Note: `fuse.js` and `@vueuse/core` ship with built-in TypeScript types. Only `diff` needs `@types/diff` (verify on install -- diff v8 may include its own types, in which case `@types/diff` is unnecessary).

## Implementation Patterns

### LCS Diff Viewer with `diff`

```typescript
import { diffLines } from 'diff'

// In DiffViewer.vue - receives old_string and new_string from Edit tool input
const changes = diffLines(oldString, newString)
// Returns: Array<{ value: string, added?: boolean, removed?: boolean, count: number }>
// added=true: green background, "+" prefix
// removed=true: red background, "-" prefix
// neither: unchanged context lines (optionally collapse if many)
```

Render each change as line(s) with appropriate background color. Show stats header: "+N / -N lines". This matches claude-devtools' visual approach but uses a proven library instead of hand-rolled LCS.

### Code Block Viewer with Existing highlight.js

```typescript
// highlight.js is already installed and configured
import hljs from 'highlight.js'

// Detect language from file extension in Read tool input (file_path field)
const ext = filePath.split('.').pop()
const langMap: Record<string, string> = {
  ts: 'typescript', js: 'javascript', vue: 'xml', py: 'python',
  rs: 'rust', go: 'go', json: 'json', md: 'markdown', /* etc */
}
const highlighted = hljs.highlight(code, { language: langMap[ext] || 'plaintext' }).value
```

Line numbers via CSS `counter-increment` on a `<pre>` with individual `<span>` lines. File header shows path + language badge. No new dependency needed.

### Command Palette with Fuse.js

```typescript
import Fuse from 'fuse.js'

// Build index from conversation list (already fetched for sidebar/table)
const fuse = new Fuse(conversations.value, {
  keys: ['title', 'projectName', 'agentType'],
  threshold: 0.3,
  includeMatches: true,  // For highlighting matched text
})

// Also index navigation routes for "Go to..." commands
const routeIndex = new Fuse(routes, {
  keys: ['label'],
  threshold: 0.2,
})
```

### Keyboard Shortcuts with VueUse useMagicKeys

```typescript
import { useMagicKeys, whenever } from '@vueuse/core'

const keys = useMagicKeys()

// Cmd+K: command palette
whenever(keys['Meta+k'], () => {
  showCommandPalette.value = true
})

// Cmd+F: in-conversation search (must preventDefault to override browser find)
whenever(keys['Meta+f'], (v) => {
  // Note: useMagicKeys does not give access to the raw event for preventDefault.
  // Use onKeyStroke for Cmd+F where preventDefault is required.
})

// For Cmd+F specifically, use onKeyStroke:
import { onKeyStroke } from '@vueuse/core'
onKeyStroke('f', (e) => {
  if (e.metaKey) {
    e.preventDefault()
    showSearch.value = true
  }
})
```

Important: `useMagicKeys` + `whenever` is clean for shortcuts that don't need to override browser defaults. For Cmd+F (which must prevent browser's native find), use `onKeyStroke` which provides the raw event for `preventDefault()`.

### In-Conversation Search

No fuzzy search needed here -- this is exact text matching within the rendered conversation. Implementation approach:

1. Walk visible DOM text nodes in conversation container
2. Match against search query (case-insensitive `indexOf`)
3. Wrap matches with `<mark>` tags (already allowed by DOMPurify config)
4. Track match index for "X of Y" navigation with Enter/Shift+Enter
5. `scrollIntoView()` to navigate between matches

This is ~100 lines of custom code. No library needed -- the DOM API provides everything.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `diff` v8 | `diff-match-patch` / `diff-match-patch-es` | diff-match-patch is character-level (designed for Google Docs merge operations). We need line-level diffs for code display. `diff` provides `diffLines()` directly and is purpose-built for this. |
| `diff` v8 | Hand-rolled LCS algorithm | claude-devtools hand-rolls its own LCS. Unnecessary when `diff` is battle-tested with 8000+ dependents and provides exactly the API we need. Avoid NIH syndrome. |
| `fuse.js` | `minisearch` | MiniSearch offers TF-IDF ranking and field boosting but is heavier. Fuse.js is simpler, lighter, and sufficient for searching hundreds of conversations client-side. |
| `fuse.js` | SQLite FTS5 backend search | Over-engineered for our data scale. Client already has conversation list loaded. Adding a backend search endpoint introduces round-trip latency for search-as-you-type. Reserve FTS5 for when we have 10K+ conversations. |
| `@vueuse/core` | Custom `addEventListener` wrappers | VueUse is the standard Vue ecosystem utility library (14M+ weekly downloads). `useMagicKeys` handles edge cases (modifier keys on different OS, key release tracking, focus management) that hand-rolled solutions miss. Tree-shakeable, so unused composables add zero weight. |
| Build own command palette | `vue-command-palette` v0.2.3 | Last published 2 years ago. Only 290 GitHub stars. Would fight DaisyUI styling since it's unstyled. Building with Fuse.js + VueUse + DaisyUI modal gives full control and stays on maintained dependencies. |
| Build own command palette | `cmd-bar` | Same reasoning as vue-command-palette. Small community library with uncertain maintenance. Composing from primitives is more maintainable. |
| Keep pagination | `@tanstack/vue-virtual` v3.13.19 | Explicitly out of scope per PROJECT.md. Pagination + collapse already manages DOM size adequately. Would require rearchitecting conversation rendering. |
| `highlight.js` (existing) | `monaco-editor` or `@codemirror/view` | 1-3MB bundle for full editor capabilities we don't need. We only need read-only syntax-highlighted display. highlight.js is already installed and handles this perfectly. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@tanstack/vue-virtual` | Out of scope per PROJECT.md. Pagination + collapse handles DOM. | Keep load-more pagination |
| `vue-command-palette` | Unmaintained (2yr), 290 stars, fights DaisyUI | Build with Fuse.js + VueUse + DaisyUI modal |
| `diff-match-patch` | Character-level diffs. Wrong granularity for code. | `diff` with `diffLines()` |
| `diff2html` | Full diff-to-HTML renderer. Conflicts with DaisyUI theming, not Vue-native. | `diff` for computation + custom Vue template |
| `monaco-editor` / `codemirror` | 1-3MB for read-only display we can do with highlight.js | `highlight.js` (already installed) + CSS line numbers |
| `@headlessui/vue` | Overkill for one modal component. Adds unused primitives. | DaisyUI modal + VueUse composables |
| Any rich text editor | Read-only analytics. We never edit content. | `marked` + `highlight.js` (already installed) |
| `pinia` | State management library. Current composable pattern is sufficient. Shortcuts and search state are local to components or shared via simple composables. | Vue composables with reactive refs |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `diff@^8.0.3` | Node 16+, all modern browsers | ESM and CJS dual-published. Ships own types since v8. |
| `fuse.js@^7.1.0` | All modern browsers, ESM native | Zero dependencies. Works with any bundler. |
| `@vueuse/core@^14.2.1` | `vue@^3.5.0` (we have ^3.5.0) | Peer dependency on Vue 3.5+. Fully tree-shakeable. |

## Bundle Impact

| Package | Gzipped Size | Tree-Shakeable | Used Features |
|---------|-------------|----------------|---------------|
| `diff` | ~7KB | Partial (`diffLines` import) | `diffLines()` only |
| `fuse.js` | ~5KB | No (single class export) | `Fuse` constructor + `search()` |
| `@vueuse/core` | ~2KB per composable | Yes (fully) | `useMagicKeys`, `onKeyStroke`, `onClickOutside`, `useEventListener` |
| **Total added** | **~15KB gzipped** | | |

Modest footprint for the functionality gained. For comparison, `highlight.js` (already in project) is ~40KB gzipped.

## Sources

- [diff on npm](https://www.npmjs.com/package/diff) -- v8.0.3, 8000+ dependents, TypeScript types included (HIGH confidence)
- [Fuse.js official site](https://www.fusejs.io/) -- v7.1.0, 3200+ dependents, zero dependencies (HIGH confidence)
- [@vueuse/core on npm](https://www.npmjs.com/package/@vueuse/core) -- v14.2.1, released Feb 2026 (HIGH confidence)
- [useMagicKeys documentation](https://vueuse.org/core/usemagickeys/) -- reactive key combination detection API (HIGH confidence)
- [@tanstack/vue-virtual](https://tanstack.com/virtual/latest) -- v3.13.19, evaluated but NOT recommended (HIGH confidence)
- [vue-command-palette on GitHub](https://github.com/xiaoluoboding/vue-command-palette) -- 290 stars, last published 2yr ago, NOT recommended (MEDIUM confidence)
- [diff-match-patch on npm](https://www.npmjs.com/package/diff-match-patch) -- evaluated, NOT recommended for line-level diffs (HIGH confidence)

---
*Stack research for: cowboy v2.0 UX overhaul*
*Researched: 2026-03-09*
