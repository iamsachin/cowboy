# Pitfalls Research

**Domain:** Adding diff/code viewers, search, command palette, keyboard shortcuts, streaming dedup, compaction detection, and subagent resolution to existing Vue 3 + DaisyUI developer tools dashboard
**Researched:** 2026-03-09
**Confidence:** HIGH (based on direct codebase analysis + claude-devtools reference implementation)

## Critical Pitfalls

### Pitfall 1: Content Block Duplication Creating Phantom Tool Calls

**What goes wrong:**
The current `processAssistantChunk` in `claude-code-parser.ts` (lines 244-245) **appends** all content blocks from every streaming chunk: `accumulator.contentBlocks.push(...contentBlocks)` and `accumulator.toolUseBlocks.push(...toolUseBlocks)`. Claude Code's streaming JSONL writes the full accumulated content in each chunk (not deltas), so the same `tool_use` block appears N times in the final `toolUseBlocks` array. The normalizer then creates N duplicate tool call records. This is currently masked because tool calls get deterministic IDs from `toolUse.id`, and SQLite's ON CONFLICT deduplicates at insert. But tool-specific viewers that count or render tool calls from the parser output (before DB insert) will show duplicates.

**Why it happens:**
The parser was built for correctness of final state (correct token counts, correct text) but not for deduplication of intermediate streaming states. It works because downstream dedup happens at the database layer.

**How to avoid:**
- Fix the parser to **replace** content blocks on each chunk rather than append. Each streaming chunk's content is a superset of all previous: `accumulator.contentBlocks = contentBlocks` and `accumulator.toolUseBlocks = toolUseBlocks`.
- This must happen BEFORE building tool-specific viewers.
- Write a test with actual streaming JSONL data (multiple entries, same `message.id`, growing content) and verify `toolUseBlocks.length` matches actual tool call count.

**Warning signs:**
- A single Edit tool call showing 3-5 times in the tool list.
- Tool call counts in `AssistantGroupCard` header inflated vs what actually happened.
- `toolCalls` array in `AssistantGroup` having duplicate entries with the same `tc.id`.

**Phase to address:**
Streaming deduplication -- must be the FIRST data quality fix, before any tool viewer work.

---

### Pitfall 2: LCS Diff Viewer Producing Unreadable Output on Large Edits

**What goes wrong:**
A naive LCS diff applied to Edit tool `old_string`/`new_string` produces character-level or word-level diffs that are visually noisy. Large refactors where most content changes create a wall of red/green that communicates nothing. Very long strings (multi-hundred-line files) make LCS O(n*m) computation slow enough to freeze the UI thread.

**Why it happens:**
The Edit tool's `old_string` and `new_string` are arbitrary snippets -- sometimes a single line, sometimes hundreds of lines. Developers build against small test cases and never test with large structurally different blocks.

**How to avoid:**
- Implement **line-level** LCS diffing, not character-level. Split on `\n` first, then diff lines.
- Set a hard limit (~500 lines per side). Beyond that, show a "Diff too large" fallback with raw old/new in tabs.
- Compute diffs lazily -- only when the tool call detail is expanded, not when the conversation loads.
- Memoize diff output keyed on `old_string + new_string` hash. Compute once per unique input pair.
- Use `requestAnimationFrame` chunking for diffs over ~200 lines so the main thread stays responsive.

**Warning signs:**
- UI jank when expanding Edit tool calls in long conversations.
- `performance.now()` showing >50ms for diff computation on typical edits.
- Users seeing more red/green noise than useful signal.

**Phase to address:**
Tool-specific viewers phase (diff viewer implementation).

---

### Pitfall 3: In-Conversation Search Missing Content in Collapsed/Paginated Groups

**What goes wrong:**
Search only finds text in currently rendered DOM elements. Collapsed `AssistantGroupCard` groups hide content behind `v-if="expanded"` (line 44 of `AssistantGroupCard.vue`), so that content doesn't exist in the DOM. Paginated turns (`visibleTurns` slice in `ConversationDetail.vue`, line 99) exclude turns beyond `visibleCount`. Users search for text they know exists and get zero results.

**Why it happens:**
The simplest search implementation uses DOM APIs (`textContent`, `TreeWalker`). Since Vue's `v-if` removes elements from the DOM, hidden content is unsearchable. Developers test with everything expanded and never notice.

**How to avoid:**
- Search against the **data model** (`turns` computed array and its `message.content` / `toolCall.input` / `toolCall.output` fields), not the DOM.
- Build a search index from `groupTurns()` output that includes all text content regardless of collapse/pagination state.
- When a match is found in a collapsed group, auto-expand it and scroll to the match.
- When a match is found beyond the current page, auto-extend `visibleCount` to include it.
- Highlight matches using a post-render step (after `nextTick()`) once the target element is in the DOM.

**Warning signs:**
- Search result count changes when you expand/collapse groups.
- "0 of 0" for text the user can see when they manually expand groups.
- Search works when all groups are expanded but fails when collapsed.

**Phase to address:**
In-conversation search. The search architecture decision (data model vs DOM) must be made at the start.

---

### Pitfall 4: Keyboard Shortcuts Hijacking Browser/OS Shortcuts

**What goes wrong:**
Registering Cmd+F for in-conversation search overrides the browser's native find. Cmd+K may conflict with browser URL bar focus (Chrome). Users get frustrated when familiar shortcuts stop working.

**Why it happens:**
Developer tests in one browser, doesn't consider that Cmd+F is deeply ingrained muscle memory for "browser find" which searches the full page including non-rendered content.

**How to avoid:**
- Use `e.preventDefault()` ONLY when the conversation panel is focused and no text input is active. Check `e.target` -- if it's an `<input>`, `<textarea>`, or `[contenteditable]`, skip most shortcuts.
- For Cmd+F: Show custom search bar but let Escape then Cmd+F again trigger browser find. Document this.
- Register all shortcuts via a centralized `useKeyboardShortcuts` composable, not scattered `addEventListener` calls. This makes conflicts visible and allows priority ordering.
- Test in Chrome, Safari, and Firefox. Safari uses Cmd+L for URL bar (not Cmd+K), so Cmd+K is safe there.

**Warning signs:**
- Users reporting "I can't use browser find anymore."
- Shortcuts firing when typing in the conversation table search input.
- Shortcuts not working because a different listener captured the event first.

**Phase to address:**
Keyboard shortcuts phase. Must be designed holistically, not piecemeal per feature.

---

### Pitfall 5: Subagent Resolution Creating Circular References or Incorrect Linking

**What goes wrong:**
Subagent JSONL files live in separate directories. Linking a parent conversation's `Task`/`Agent` tool call to the correct subagent requires matching on `agentId`, prompt content, or positional heuristics. Incorrect matching links the wrong subagent. Circular references (subagent A spawns B which appears to spawn A) crash recursive renderers.

**Why it happens:**
Claude Code's subagent linking is complex -- claude-devtools uses a three-phase matching strategy (result-based agentId, description-based, positional fallback) because there's no guaranteed 1:1 identifier linking parent to child. The JSONL format wasn't designed for easy cross-file linking.

**How to avoid:**
- Start with the simplest matching: look for `agentId` in the Task tool call result. Only fall back to heuristics if that fails.
- Set a **maximum recursion depth** (3 levels) for rendering nested subagent traces. Beyond that, show a "View subagent" link.
- Never render subagent content inline by default -- always collapsed behind a click.
- Filter warmup/initialization subagents that have no meaningful tool calls.
- Add a confidence indicator to linked subagents so users know when matching is uncertain.

**Warning signs:**
- Stack overflow errors in recursive component rendering.
- Subagent content showing tool calls that clearly belong to a different task.
- Performance degradation in conversations with many Task tool calls.

**Phase to address:**
Subagent resolution -- highest complexity, implement last after streaming dedup and compaction are stable.

---

### Pitfall 6: `getTurnContent` Bug Feeding Unsanitized Content to Tool Viewers

**What goes wrong:**
In `AssistantGroupCard.vue` lines 170-174, `getTurnContent` computes `cleaned = stripXmlTags(turn.message.content)` but then passes `turn.message.content` (original unsanitized) to `parseContent()`. XML system tags leak into rendered output. When tool-specific viewers are added, they'll receive content with `<system-reminder>`, `<local-command-caveat>`, and other XML tags that look like broken HTML.

**Why it happens:**
The bug exists today (documented in LEARNINGS.md) but impact is limited because markdown rendering handles XML as passthrough. With structured tool viewers parsing specific fields, the contamination becomes a real problem.

**How to avoid:**
- Fix the one-line bug first: pass `cleaned` to `parseContent()` instead of `turn.message.content`.
- Add a unit test verifying `getTurnContent` strips XML tags before passing to parseContent.
- Do this BEFORE building tool-specific viewers.

**Warning signs:**
- XML tags like `<system-reminder>` appearing in rendered tool viewer content.
- DiffViewer showing `<local-command-caveat>` text inside code diffs.

**Phase to address:**
Code cleanup phase (prerequisite). Trivial fix, should be first.

---

### Pitfall 7: Command Palette Search Too Slow at Scale

**What goes wrong:**
Full-text search across all conversations requires scanning message content from SQLite. With hundreds of conversations and tens of thousands of messages, a naive `LIKE '%query%'` query takes seconds. Command palette shows a spinner instead of instant results.

**Why it happens:**
SQLite's `LIKE` with leading wildcard can't use indexes. Developers test with 10-20 conversations.

**How to avoid:**
- Use SQLite FTS5 (Full-Text Search) for message content. Create an FTS5 virtual table indexing `messages.content`.
- Alternatively, search conversation titles first (fast, indexed), then offer "Search in messages" as a secondary slower action.
- Debounce input at 200ms minimum.
- Show title matches immediately, then progressively load message-level matches.
- Limit results to 50 with pagination.

**Warning signs:**
- Command palette taking >200ms to show results.
- UI freezing when typing in search.
- Backend CPU spikes on search queries.

**Phase to address:**
Command palette phase. The FTS5 decision must be made at architecture time, not retrofitted.

---

### Pitfall 8: Compaction Detection Relying on Undocumented JSONL Fields

**What goes wrong:**
claude-devtools detects compaction via an `isCompactSummary` flag in JSONL entries. This field is undocumented and could change without notice in Claude Code updates. Building compaction visualization on unstable data means it silently breaks when Claude Code updates.

**Why it happens:**
The compaction format is an implementation detail of Claude Code, not a documented API. Developers reverse-engineer the current format and assume stability.

**How to avoid:**
- Implement compaction detection as a **best-effort** feature, not a critical path.
- Use multiple signals: `isCompactSummary` flag, sudden drops in cumulative token counts between adjacent messages, message content patterns.
- If compaction can't be detected, the feature should degrade gracefully (no boundary shown, not an error).
- Log a warning when expected compaction fields are missing so breakage is noticed.

**Warning signs:**
- Compaction boundaries that appeared before disappear after a Claude Code update.
- Token delta calculations showing negative or nonsensical values.

**Phase to address:**
Compaction detection phase. Build defensively with fallbacks.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| DOM-based search instead of data-model search | Faster to implement | Misses collapsed/paginated content, unreliable match counts | Never -- data-model search is only slightly more work |
| Inline LCS implementation instead of library | No dependency | Edge cases in Unicode, performance on large inputs, maintenance burden | Acceptable if kept under 100 LOC and tested with known diff outputs |
| Registering shortcuts in individual components | Quick per-feature addition | Conflicts invisible, no priority system, no shortcut help dialog | Never -- centralized registry from the start |
| Skipping FTS5 and using LIKE queries | No schema migration | Unusable search at 100+ conversations | Only if search is limited to titles (already indexed) |
| Rendering subagent content inline (not lazy) | Simpler component tree | Stack overflows on deep nesting, massive DOM | Never -- lazy-load behind click |
| Building tool viewers without fixing streaming dedup | Ship viewers faster | Viewers show phantom duplicate tool calls | Never -- dedup is a prerequisite |
| Using `highlightAuto` for code detection | No file extension parsing needed | Guesses wrong ~30% of the time | Never -- extract extension from tool call `file_path` |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| highlight.js in DiffViewer | Importing all languages (2MB+) | Import only needed languages: `typescript`, `javascript`, `python`, `json`, `bash`, `css`, `html`. Detect language from Edit tool's `file_path` extension. |
| highlight.js in CodeBlockViewer | Using `highlightAuto` which guesses wrong 30% of time | Extract file extension from Read tool's `file_path` input, map to highlight.js language. Fall back to plain text. |
| DaisyUI modal for command palette | DaisyUI's `<dialog>` modal traps focus and has animation timing too sluggish for a palette | Build as custom overlay with `v-if` + focus trap, not DaisyUI modal. |
| `marked` renderer with search highlights | Injecting `<mark>` tags breaks markdown parsing | Render markdown FIRST, then apply highlights to rendered HTML text nodes (not inside code blocks). |
| Vue `v-if` vs `v-show` for collapsed groups | Switching to `v-show` to enable DOM search | Keep `v-if` (correct for performance). Search the data model, not DOM. `v-show` renders all collapsed groups simultaneously. |
| Existing `ToolCallRow.vue` highlight.js setup | Current code registers only JSON language (line 82). Adding code viewer means registering more languages globally. | Create a shared `highlight-setup.ts` that registers all needed languages once. Import in both ToolCallRow and new viewers. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| LCS diff computed on every render | UI jank scrolling past expanded Edit calls | Memoize diff output keyed on input hash. Compute once, cache in Map. | 10+ Edit tool calls expanded simultaneously |
| Search re-indexing on every keystroke | 200ms+ delay per character | Debounce at 200ms. Build index once when conversation loads. | Conversations with 500+ messages |
| Syntax highlighting all Read outputs eagerly | Page load 2-3s for many Read calls | Highlight lazily -- only when tool call is expanded. | 20+ Read tool calls in one conversation |
| Command palette loading all conversations on open | 500ms+ to show palette | Pre-fetch conversation list on app load (already available). Only fetch message content on demand. | 500+ conversations |
| Recursive subagent rendering without depth limit | Stack overflow or frozen tab | Cap at 3 levels. "View full subagent" link beyond that. | Subagent chains deeper than 5 levels |
| Diff viewer rendering full file content for tiny edits | 1000-line code block for a 2-line change | Show only changed lines with N lines of context (like `git diff`). Configurable context size. | Edit tool calls on large files where old_string/new_string are full file contents |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Rendering tool call output as raw HTML in code viewers | XSS if tool output contains `<script>` (e.g., Read of HTML file) | Always escape HTML in code viewers. highlight.js escapes by default. Never use `v-html` for tool call content. |
| Search highlight injection via `v-html` | Crafted message content could inject HTML through highlight markers | Use DOMPurify with `ALLOWED_TAGS: ['mark']` (established codebase pattern from v1.3). |
| Diff viewer rendering unsanitized old_string/new_string | Same XSS risk as above | Escape all diff content before rendering. Line-level diff output must be text-only. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Diff viewer showing character-level diffs | Unreadable red/green noise for multi-line edits | Line-level diffs with +N/-N stats header. Optional context lines like `git diff`. |
| Command palette replacing current page | User loses place in conversation | Overlay modal with backdrop blur. Navigate on selection but preserve palette query. |
| Search "X of Y" not updating after auto-expand | User sees "3 of 5" but only 2 highlights visible | After auto-expanding, `await nextTick()` then scroll and highlight. Update counter after DOM stable. |
| Keyboard shortcuts being undiscoverable | Users never learn they exist | "?" shortcut opens cheat sheet. Shortcut hints in tooltips: "Toggle sidebar (Cmd+B)". |
| Always-visible AI response too long | Collapsed preview takes more space than header, defeating collapse | Truncate to 3-4 lines max. Full content on expand only. |
| Compaction boundary visually jarring | Bright banner disrupts reading flow | Subtle horizontal rule with small label ("Context compacted: 45k to 12k"). Match ClearDivider weight. |
| Code viewer for Read without line range context | Line numbers start at 1 but the Read was for lines 50-100 | Read tool input has `offset`/`limit` fields. Start line numbers at the correct offset. |
| Edit diff viewer not handling new file creation | Empty old_string shows broken diff | Detect empty old_string, show as "all additions" (entire new_string in green). |

## "Looks Done But Isn't" Checklist

- [ ] **Diff Viewer:** Handles empty `old_string` (new file creation) as all-additions, not broken diff
- [ ] **Diff Viewer:** Shows line numbers on both sides and +N/-N summary stats header
- [ ] **Diff Viewer:** Tested with a 200+ line edit -- still responsive, falls back if too large
- [ ] **Code Viewer (Read):** Line numbers start at correct offset from Read tool's `offset` field, not always 1
- [ ] **Code Viewer (Read):** Language detected from `file_path` extension, not `highlightAuto`
- [ ] **In-conversation Search:** Finds text in collapsed groups (searches data model, not DOM)
- [ ] **In-conversation Search:** Searches tool call input/output, not just message text
- [ ] **In-conversation Search:** Finds text in paginated turns beyond current `visibleCount`
- [ ] **Command Palette:** Full keyboard navigation (arrows, Enter, Escape) without mouse
- [ ] **Command Palette:** Results appear within 100ms for title search
- [ ] **Keyboard Shortcuts:** Cmd+F doesn't fire when typing in conversation table search input
- [ ] **Keyboard Shortcuts:** All shortcuts tested in Chrome + Safari + Firefox
- [ ] **Streaming Dedup:** Token totals for conversations unchanged before/after fix
- [ ] **Streaming Dedup:** Tool call count per conversation matches actual tool use count
- [ ] **Compaction Detection:** Detected from real Claude Code JSONL, not just synthetic test data
- [ ] **Compaction Detection:** Graceful degradation when compaction fields are missing
- [ ] **Subagent Resolution:** No infinite recursion -- depth capped at 3 levels
- [ ] **Subagent Resolution:** Warmup/init subagents filtered out
- [ ] **Always-visible Response:** Groups with only tool calls (no text) show "Used N tool calls" not blank

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| LCS diff too slow on large edits | LOW | Add size threshold; fall back to side-by-side raw view. No schema changes. |
| Streaming dedup breaks token counts | MEDIUM | Revert parser change, re-ingest all conversations. JSONL source files are never modified. |
| Keyboard shortcuts conflict with browser | LOW | Make shortcuts configurable or add "app mode" toggle. |
| Search misses collapsed content | MEDIUM | Refactor from DOM search to data-model search. Rewrite search logic, not UI. |
| Subagent linking produces wrong matches | LOW | Add confidence indicators. Allow manual unlinking. Wrong links are UI-only. |
| Command palette search too slow | MEDIUM | Add FTS5 virtual table and migration. SQLite FTS5 is built-in. |
| getTurnContent bug corrupts viewer input | LOW | One-line fix: use `cleaned` variable. |
| Phantom duplicate tool calls | MEDIUM | Fix parser (replace vs append), re-ingest. JSONL source intact. |
| Compaction detection breaks after Claude Code update | LOW | Feature degrades gracefully (no boundary shown). Log warning for diagnosis. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Content block duplication (phantom tool calls) | Streaming dedup (FIRST) | Count tool calls per conversation before/after; totals decrease to actual count |
| `getTurnContent` bug | Code cleanup (FIRST) | Unit test: output has no XML tags when input has `<system-reminder>` |
| LCS diff unreadable on large edits | Tool viewers (diff) | Test with 200-line restructure; verify line-level diff |
| Code viewer wrong language detection | Tool viewers (code) | Test Read of `.py` file; verify Python highlighting, not auto-detect |
| Search missing collapsed content | In-conversation search | Collapse all, search for text in last group, verify found |
| Keyboard shortcut conflicts | Keyboard shortcuts | Test all shortcuts in Chrome, Safari, Firefox |
| Command palette slow search | Command palette | Test with 200+ conversations; results in <100ms |
| Subagent circular references | Subagent resolution | Test conversation where A spawns B; no infinite recursion |
| Compaction field instability | Compaction detection | Simulate missing `isCompactSummary`; verify graceful degradation |

## Recommended Phase Ordering (Based on Pitfall Dependencies)

1. **Code cleanup + streaming dedup** -- Fix `getTurnContent` bug and content block duplication FIRST. These are prerequisites for everything else. Tool viewers need clean data; search needs correct content.
2. **Conversation display improvements** -- Always-visible AI response, user message truncation, semantic colors. Independent of other features.
3. **Tool-specific viewers** -- Diff viewer, code viewer, tool-specific input rendering. Depends on clean data from phase 1.
4. **In-conversation search** -- Depends on understanding the data model well (informed by phases 2-3).
5. **Keyboard shortcuts + command palette** -- Build centralized shortcut registry first, then command palette uses it.
6. **Compaction detection + subagent resolution** -- Highest complexity, most uncertain. Benefits from all prior phases being stable.

## Sources

- Direct codebase analysis: `claude-code-parser.ts` streaming chunk handling (lines 200-258, append vs replace)
- Direct codebase analysis: `AssistantGroupCard.vue` `getTurnContent` bug (lines 170-174)
- Direct codebase analysis: `ConversationDetail.vue` pagination via `visibleTurns` (line 99)
- Direct codebase analysis: `ToolCallRow.vue` highlight.js JSON-only registration (line 82)
- Direct codebase analysis: `normalizer.ts` tool call ID generation from `toolUse.id` (line 148)
- LEARNINGS.md: claude-devtools streaming dedup by requestId (section 4)
- LEARNINGS.md: claude-devtools three-phase subagent matching (section 4)
- LEARNINGS.md: claude-devtools DiffViewer LCS implementation (section 3)
- LEARNINGS.md: claude-devtools command palette and search architecture (section 5)

---
*Pitfalls research for: v2.0 UX Overhaul -- cowboy developer tools dashboard*
*Researched: 2026-03-09*
