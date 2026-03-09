# Project Research Summary

**Project:** Cowboy v2.0 -- UX Overhaul
**Domain:** AI coding agent analytics dashboard -- conversation display, tool viewers, navigation, data quality
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

Cowboy v2.0 is a comprehensive UX overhaul of the conversation detail view, adding tool-specific viewers (LCS diffs for Edit, syntax-highlighted code for Read/Write, natural Bash display), always-visible AI responses on collapsed groups, semantic message coloring, in-conversation search (Cmd+F), a command palette (Cmd+K), keyboard shortcuts, and backend data quality fixes (streaming deduplication, compaction detection, subagent resolution). The existing v1.3 codebase already provides collapsible assistant groups, pagination, markdown rendering, and syntax highlighting -- v2.0 layers presentation intelligence on top of that foundation without rearchitecting the data pipeline.

The recommended approach adds only three npm packages (`diff`, `fuse.js`, `@vueuse/core` -- totaling ~15KB gzipped) and creates ~10 new files (7 frontend components, 1 composable, 1 utility, 1 backend module) while modifying 6 existing files. The reference implementation is claude-devtools (1,835+ stars), whose source code was analyzed in detail. We adopt their proven patterns (tool dispatch by name, LastOutputDisplay, CompactBoundary, requestId dedup, three-phase subagent linking) while making deliberate divergences: using the `diff` library instead of hand-rolled LCS, data-model search instead of DOM-only search, and flat subagent summaries instead of recursive rendering. The architecture change is purely additive -- ToolCallRow.vue gains a v-if dispatch chain to viewer components, and no existing API contracts change for display features.

The primary risks are (1) content block duplication in the parser that will produce phantom tool calls in viewers unless fixed first, (2) in-conversation search missing collapsed/paginated content if built against the DOM rather than the data model, and (3) subagent JSONL resolution complexity with three-phase matching and no guaranteed identifiers. All three have clear mitigation strategies documented in research. The critical sequencing insight: streaming deduplication and the getTurnContent bug fix must land before any tool viewer work, because viewers need clean, non-duplicated data to render correctly.

## Key Findings

### Recommended Stack

The v2.0 features are predominantly frontend. Only three new packages are needed, all lightweight and well-maintained. No new backend dependencies required -- streaming dedup, compaction detection, and subagent resolution use pure logic and existing `fs/promises`.

**New dependencies:**
- `diff` v8.0.3: LCS line-level diffing for Edit tool viewer -- 49M weekly downloads, zero dependencies, `diffLines()` API is exactly what we need. Replaces the need for a hand-rolled LCS algorithm (which claude-devtools uses with O(m*n) DP matrix).
- `fuse.js` v7.1.0: Fuzzy search for command palette -- <5KB gzipped, zero dependencies. Client-side search over conversation titles/projects without backend round-trips.
- `@vueuse/core` v14.2.1: Keyboard shortcuts via `useMagicKeys`/`onKeyStroke`, plus `onClickOutside` for palette dismissal -- standard Vue 3 utility library, fully tree-shakeable.

**Explicitly not adding:** `@tanstack/vue-virtual` (out of scope per PROJECT.md), `vue-command-palette` (unmaintained), `diff-match-patch` (character-level, wrong granularity), `monaco-editor`/`codemirror` (1-3MB for read-only display).

### Expected Features

**Must have (table stakes -- P1):**
- Always-visible AI response on collapsed groups -- the single highest-impact UX change; claude-devtools' LastOutputDisplay pattern shows final text below the header
- LCS diff viewer for Edit tool calls -- red/green line-level diffs replacing raw JSON dumps
- Syntax-highlighted code viewer for Read/Write results -- with line numbers and language detection from file path
- Tool-specific input rendering dispatch -- Bash commands as shell prompts, file paths as headers, diffs as visual diffs
- Streaming deduplication by requestId -- fixes silent token overcounting across all displays
- User message truncation at 500 chars -- prevents viewport domination by pasted content
- Semantic message colors -- purple/amber/green/red tints for visual scanning (matches claude-devtools' 5-category classifier approach)

**Should have (differentiators -- P2):**
- In-conversation search (Cmd+F) with "X of Y" match navigation and auto-expand of collapsed groups
- Command palette (Cmd+K) for power-user navigation across conversations and pages
- Keyboard shortcuts (Cmd+B sidebar toggle, J/K navigation, `?` cheat sheet)
- Compaction boundary visualization with token deltas ("45k -> 12k, 33k freed")

**Defer to v3+:**
- Multi-pane split view (use browser tabs)
- Virtual scrolling (collapse pattern handles performance)
- Context window reconstruction (token counts + compaction covers 80% of insight at 10% effort)
- Light mode (low priority for dev tool)
- Subagent execution traces (HIGH complexity -- move to P3 nice-to-have)

### Architecture Approach

The architecture is purely additive. ToolCallRow.vue gains a v-if dispatch chain routing to viewer components by `toolCall.name`. New viewer components live in `components/viewers/`. Search and palette are top-level components mounted in ConversationDetail.vue and App.vue respectively. Backend changes are confined to the ingestion pipeline (parser and normalizer).

**New component tree:**
1. `components/viewers/DiffViewer.vue` -- receives old_string/new_string, computes LCS diff via `diff` library, renders line-by-line with colored backgrounds
2. `components/viewers/CodeViewer.vue` -- wraps existing highlight.js with line numbers via CSS counters, language detection from file extension
3. `components/viewers/BashInputDisplay.vue` -- shows description label + command in terminal-styled code block
4. `components/ConversationSearch.vue` -- floating Cmd+F bar, searches data model (not DOM), auto-expands collapsed groups for matches
5. `components/CommandPalette.vue` -- Cmd+K modal, uses existing search API + Fuse.js for client-side title matching
6. `components/CompactionBoundary.vue` -- amber accent bar with token delta, similar to existing ClearDivider
7. `composables/useKeyboardShortcuts.ts` -- centralized shortcut registry preventing conflicts

**Key pattern decisions:**
- Search against the data model, not the DOM -- prevents missing collapsed/paginated content (critical lesson from PITFALLS research)
- Lazy diff computation -- only when tool call is expanded, memoized in a ref since inputs are immutable
- Centralized keyboard shortcuts -- single composable prevents scattered addEventListener calls and shortcut conflicts
- Custom overlay for command palette -- DaisyUI `<dialog>` modal is too sluggish for a palette; use v-if + focus trap

### Critical Pitfalls

1. **Content block duplication (phantom tool calls)** -- The parser appends content blocks from each streaming chunk instead of replacing. Same tool_use block appears N times. Currently masked by SQLite ON CONFLICT dedup at insert, but tool viewers will expose duplicates. Fix: change `push(...contentBlocks)` to assignment `= contentBlocks` in processAssistantChunk. Must be fixed BEFORE building any viewer.

2. **Search missing collapsed/paginated content** -- DOM-based search with TreeWalker only finds text in rendered elements. Collapsed groups (v-if) and paginated turns are invisible. Fix: search the data model (turns array with message.content/toolCall.input/toolCall.output), auto-expand collapsed groups and extend pagination when matches found.

3. **LCS diff unreadable on large edits** -- Naive character-level diffs produce noise. O(n*m) computation on large files freezes UI. Fix: line-level diffing only, 500-line cap with "Diff too large" fallback, lazy computation on expand, memoize results.

4. **Keyboard shortcuts hijacking browser defaults** -- Cmd+F override breaks browser find on non-conversation pages. Fix: only intercept on conversation-detail route, skip when focus is on input/textarea elements, centralized handler with priority system.

5. **getTurnContent bug** -- Existing bug passes unsanitized `turn.message.content` to `parseContent()` instead of the `cleaned` (XML-stripped) variable. XML system tags will leak into tool viewers. Fix: one-line change, prerequisite for viewer work.

## Implications for Roadmap

Based on combined research across all four files and the claude-devtools source analysis, the following phase structure emerges from dependency analysis and risk ordering.

### Phase 1: Data Quality Prerequisites
**Rationale:** Tool viewers and search need clean data. The parser's content block duplication bug and getTurnContent XML leak must be fixed before any presentation work. Streaming dedup by requestId corrects token overcounting across all existing displays.
**Delivers:** Accurate tool call counts, correct token totals, clean content pipeline
**Addresses:** Streaming deduplication (P1), getTurnContent bug fix, content block dedup in parser
**Avoids:** Phantom duplicate tool calls in viewers, XML tag contamination, inflated token counts
**Estimated scope:** ~3 files modified, backend-focused, low risk

### Phase 2: Display Quick Wins
**Rationale:** Highest user-visible impact with lowest effort. No new dependencies needed. All changes are independent modifications to existing components.
**Delivers:** Always-visible AI response on collapsed groups, user message truncation, semantic message colors
**Addresses:** Always-visible response (P1), truncation (P1), semantic colors (P1)
**Avoids:** Always-visible response being too long (3-4 line clamp), groups with only tool calls showing blank (fallback to "Used N tool calls")
**Estimated scope:** 3 components modified, CSS + minor template changes

### Phase 3: Tool-Specific Viewers
**Rationale:** The core differentiating feature set. Depends on Phase 1 for clean data. Creates the `viewers/` directory with DiffViewer, CodeViewer, and BashInputDisplay, then wires them into ToolCallRow.vue via dispatch.
**Delivers:** LCS diff viewer for Edit, syntax-highlighted code viewer for Read/Write, natural Bash display, file path headers with language badges
**Addresses:** Diff viewer (P1), code viewer (P1), tool-specific input rendering (P1)
**Uses:** `diff` npm package (new dependency), existing `highlight.js`
**Avoids:** Diff computed on every render (memoize), wrong language detection (use file extension not highlightAuto), large diff freezing UI (500-line cap)
**Estimated scope:** 4 new components, 1 new utility, 1 component modified

### Phase 4: Navigation and Keyboard Shortcuts
**Rationale:** Power-user features that require the keyboard shortcuts infrastructure as a foundation. Search depends on conversation display being stable (phases 2-3). Command palette depends on keyboard shortcut composable.
**Delivers:** Centralized keyboard shortcut registry, in-conversation search with Cmd+F override, command palette with Cmd+K
**Addresses:** In-conversation search (P2), command palette (P2), keyboard shortcuts (P2)
**Uses:** `@vueuse/core` (new dependency), `fuse.js` (new dependency), existing search API
**Avoids:** Shortcuts firing in text inputs, Cmd+F intercepted on wrong pages, search missing collapsed content (data-model search), palette search too slow (debounce + title-first)
**Estimated scope:** 3 new components, 1 new composable

### Phase 5: Compaction Detection
**Rationale:** Medium complexity backend+frontend feature. Benefits from stable display pipeline (phases 1-3). Depends on understanding JSONL compaction format which is undocumented and may change.
**Delivers:** Compaction boundary markers with token deltas, expandable compacted content
**Addresses:** Compaction boundary visualization (P2)
**Avoids:** Relying solely on undocumented `isCompactSummary` field (use multiple signals), false positives (only flag explicit markers), visual jarring (subtle horizontal rule matching ClearDivider weight)
**Estimated scope:** Parser changes, normalizer changes, 1 new component, 1 composable modification

### Phase 6: Subagent Resolution (if time permits)
**Rationale:** Highest complexity feature. Three-phase matching algorithm (result-based agentId, description-based teammate matching, positional fallback), cross-file JSONL scanning, new database relationships. Most likely to need mid-implementation research. Deferred to last because it provides lower value relative to its cost.
**Delivers:** Linked subagent execution traces within Task tool calls
**Addresses:** Subagent execution traces (P3)
**Avoids:** Circular references (3-level depth cap), wrong linking (confidence indicators), stack overflow (flat summary, never recursive inline rendering), warmup subagent noise (filter by first message content)
**Estimated scope:** 1 new backend module, normalizer changes, 1 new frontend component

### Phase Ordering Rationale

- Phase 1 before everything else because the parser bug produces phantom duplicates that would corrupt every viewer and inflate every count.
- Phase 2 before Phase 3 because display quick wins are independent, ship immediate value, and stabilize the component tree that viewers plug into.
- Phase 3 before Phase 4 because search quality improves when tool-specific content is properly rendered (search can index structured tool data).
- Phase 4 after display work because keyboard shortcuts and search need the conversation display to be stable.
- Phase 5 after Phase 4 because compaction is best-effort and benefits from stable ingestion pipeline.
- Phase 6 last because it has the highest risk-to-value ratio and most unknowns.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Compaction Detection):** The `isCompactSummary` field is undocumented. Need to analyze real JSONL files from Claude Code sessions that experienced compaction to verify detection signals before implementing.
- **Phase 6 (Subagent Resolution):** Three-phase matching algorithm is complex. claude-devtools' SubagentLocator supports two directory structures (new and legacy). Need to verify which structure current Claude Code versions use and test the matching with real multi-agent sessions.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Data Quality):** Parser fix is a one-line change (replace vs append). requestId dedup is a well-documented pattern from claude-devtools (~20 lines).
- **Phase 2 (Display Quick Wins):** CSS changes and minor template modifications using existing patterns.
- **Phase 3 (Tool Viewers):** `diff` library has straightforward API (`diffLines`). highlight.js is already configured. Dispatch pattern is a simple v-if chain.
- **Phase 4 (Navigation):** VueUse `useMagicKeys` is well-documented. Command palette is a standard modal+input+list pattern. Search is DOM TreeWalker + data-model indexing.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All three new packages verified on npm with current versions, bundle sizes measured, compatibility confirmed with Vue 3.5. Alternatives systematically evaluated and rejected with documented rationale. |
| Features | HIGH | Primary reference is claude-devtools source code analysis (1,835+ stars). Feature prioritization validated against competitor patterns. Dependency graph between features is fully mapped. |
| Architecture | HIGH | Based on direct inspection of cowboy codebase (32 Vue components, 14 composables, 4 backend route modules). Integration points identified at the file and line level. No API contract changes needed for display features. |
| Pitfalls | HIGH | All 8 critical pitfalls derived from direct codebase analysis of existing bugs (getTurnContent, content block append) and known failure modes from claude-devtools patterns. Each has specific prevention strategy and recovery cost estimate. |

**Overall confidence:** HIGH

### Gaps to Address

- **Real compaction JSONL samples:** Research identified the `isCompactSummary` detection approach but no real compaction JSONL data was analyzed. Before Phase 5, collect sample JSONL files from conversations that experienced compaction to validate the detection logic.
- **Subagent directory structure:** claude-devtools supports two layouts (new session-scoped and old project-scoped). Need to confirm which layout current Claude Code versions (2025-2026) produce before implementing Phase 6.
- **FTS5 vs title-only search:** Command palette search may need SQLite FTS5 if title-only search proves insufficient at scale (500+ conversations). The decision can be deferred -- start with title search and existing search API, add FTS5 only if latency exceeds 200ms.
- **Cmd+F interaction with existing Cmd+F overrides in chat:** FEATURES.md notes the Cmd+F override should only fire on the conversation detail route. Need to verify this works cleanly with Vue Router navigation guards and doesn't leak to other pages.

## Sources

### Primary (HIGH confidence)
- claude-devtools source code analysis (`/tmp/claude-devtools-source-analysis.md`) -- DiffViewer LCS, LastOutputDisplay, MessageClassifier, CompactBoundary, deduplicateByRequestId, SubagentLocator/Resolver, SearchBar/CommandPalette
- Direct cowboy codebase analysis -- all 32 Vue components, 14 composables, backend parser/normalizer, shared types
- [diff on npm](https://www.npmjs.com/package/diff) -- v8.0.3, 49M weekly downloads, 8000+ dependents
- [@vueuse/core](https://www.npmjs.com/package/@vueuse/core) -- v14.2.1, useMagicKeys/onKeyStroke documentation
- [Fuse.js](https://www.fusejs.io/) -- v7.1.0, zero dependencies, client-side fuzzy search

### Secondary (MEDIUM confidence)
- [vue-command-palette](https://github.com/xiaoluoboding/vue-command-palette) -- evaluated and rejected (stale, v0.2.3)
- [DaisyUI Collapse](https://daisyui.com/components/collapse/) -- modal behavior and animation timing limitations for command palette

### Tertiary (LOW confidence)
- Compaction JSONL format -- reverse-engineered from claude-devtools source; undocumented by Anthropic; may change without notice
- Subagent directory layout -- two structures identified in claude-devtools; unclear which is current default

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
