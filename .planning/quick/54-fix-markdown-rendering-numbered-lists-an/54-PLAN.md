---
phase: quick-54
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/frontend/src/styles/markdown-content.css
  - packages/frontend/src/components/ConversationDetail.vue
autonomous: true
requirements: [FIX-MD-RENDER, FIX-TABLES, FIX-AUTO-EXPAND]
must_haves:
  truths:
    - "Markdown lists (ul/ol) render with proper bullets/numbers and indentation"
    - "Markdown tables render with visible borders, padding, and proper width"
    - "Headings, blockquotes, code blocks, and other markdown elements are styled"
    - "The last assistant group auto-expands when new groups arrive during streaming"
  artifacts:
    - path: "packages/frontend/src/styles/markdown-content.css"
      provides: "Working markdown styles without :deep() pseudo-class"
      contains: ".thinking-content ul"
    - path: "packages/frontend/src/components/ConversationDetail.vue"
      provides: "Auto-expand last assistant group logic"
      contains: "ids.length"
  key_links:
    - from: "packages/frontend/src/styles/markdown-content.css"
      to: "packages/frontend/src/components/AssistantGroupCard.vue"
      via: "CSS import in unscoped style block"
      pattern: "import.*markdown-content"
---

<objective>
Fix markdown rendering in conversation view (lists, tables, headings, blockquotes all broken) and auto-expand the last assistant group when new data streams in.

Purpose: Markdown content currently renders as unstyled flat text because CSS selectors use `:deep()` in an unscoped style block (browser ignores them). Additionally, new assistant groups start collapsed during streaming, requiring manual expansion.
Output: Properly styled markdown content and auto-expanding last group behavior.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/frontend/src/styles/markdown-content.css
@packages/frontend/src/components/ConversationDetail.vue
@packages/frontend/src/components/AssistantGroupCard.vue
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix markdown CSS by removing :deep() and improving table styles</name>
  <files>packages/frontend/src/styles/markdown-content.css</files>
  <action>
Remove ALL `:deep()` wrappers from every selector in markdown-content.css. The file is imported in an unscoped style block, so `:deep()` is invalid and causes the browser to skip the entire rule.

Transform every selector like this:
- `.thinking-content :deep(h1)` becomes `.thinking-content h1`
- `.thinking-content :deep(ul)` becomes `.thinking-content ul`
- Apply this to ALL selectors in the file (h1-h4, ul, ol, li, code, pre, pre code, p, strong, blockquote, a, hr, table, th, td)

Also update the file comment at the top - remove the line about `:deep()` selectors since they are no longer used.

Improve table styles:
- Add `width: 100%` to the table rule
- Add `text-align: left` to th
- Add `font-weight: 600` to th
- Add alternating row background: `.thinking-content tr:nth-child(even) { background: oklch(0.3 0 0 / 0.2); }`
- Add header background: `.thinking-content th { background: oklch(0.3 0 0 / 0.3); }`

Ensure nested list support:
- Add `.thinking-content ul ul { list-style-type: circle; }`
- Add `.thinking-content ul ul ul { list-style-type: square; }`
  </action>
  <verify>
    <automated>cd /Users/sachin/Desktop/learn/cowboy && grep -c ":deep(" packages/frontend/src/styles/markdown-content.css | grep "^0$"</automated>
  </verify>
  <done>Zero occurrences of `:deep()` in markdown-content.css. All selectors use plain descendant combinators. Table styles include width, header background, and alternating rows.</done>
</task>

<task type="auto">
  <name>Task 2: Auto-expand last assistant group when new groups arrive</name>
  <files>packages/frontend/src/components/ConversationDetail.vue</files>
  <action>
Find the existing watcher around line 293 that auto-expands when there's only one group:

```javascript
watch(groupIds, (ids) => {
  if (ids.length === 1 && !isExpanded(ids[0])) {
    toggle(ids[0]);
  }
}, { immediate: true });
```

Replace it with logic that:
1. Tracks the previous group count using a ref: `const prevGroupCount = ref(0)`
2. On every change to groupIds:
   - If `ids.length === 1` and not expanded, expand it (preserve existing behavior)
   - If `ids.length > prevGroupCount.value` (new group added), expand the LAST group `ids[ids.length - 1]` if not already expanded
   - Update `prevGroupCount.value = ids.length`
3. Keep `{ immediate: true }` so it fires on initial load

The replacement code should look like:

```javascript
const prevGroupCount = ref(0);

watch(groupIds, (ids) => {
  const lastId = ids[ids.length - 1];
  if (ids.length === 1 && !isExpanded(lastId)) {
    toggle(lastId);
  } else if (ids.length > prevGroupCount.value && lastId && !isExpanded(lastId)) {
    toggle(lastId);
  }
  prevGroupCount.value = ids.length;
}, { immediate: true });
```

Make sure `ref` is already imported from vue (it should be since the file uses other refs). Place `prevGroupCount` declaration near the other refs/state in the setup, just before the watcher.
  </action>
  <verify>
    <automated>cd /Users/sachin/Desktop/learn/cowboy && grep -q "prevGroupCount" packages/frontend/src/components/ConversationDetail.vue && grep -q "ids.length > prevGroupCount" packages/frontend/src/components/ConversationDetail.vue && echo "PASS"</automated>
  </verify>
  <done>Last assistant group auto-expands when new groups are added during streaming. Single-group auto-expand still works. prevGroupCount ref tracks group count changes.</done>
</task>

</tasks>

<verification>
1. `grep -c ":deep(" packages/frontend/src/styles/markdown-content.css` returns 0
2. `grep "prevGroupCount" packages/frontend/src/components/ConversationDetail.vue` shows the new tracking logic
3. `cd packages/frontend && npx vue-tsc --noEmit 2>&1 | head -20` - no new type errors
</verification>

<success_criteria>
- All markdown elements (lists, tables, headings, blockquotes, code) render with proper styling
- Tables have full width, borders, header styling, and alternating row colors
- Last assistant group auto-expands when streaming adds new groups
- Existing single-group auto-expand behavior preserved
</success_criteria>

<output>
After completion, create `.planning/quick/54-fix-markdown-rendering-numbered-lists-an/54-SUMMARY.md`
</output>
