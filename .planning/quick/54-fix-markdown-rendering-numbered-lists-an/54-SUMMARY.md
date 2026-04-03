# Quick Task 54: Fix markdown rendering and auto-expand last assistant group

## What Changed

### Task 1: Fix markdown CSS (`:deep()` removal + table improvements)
- **File:** `packages/frontend/src/styles/markdown-content.css`
- Removed `:deep()` pseudo-class from ALL selectors — the file is imported in an unscoped `<style>` block, so `:deep()` was being passed to the browser as invalid CSS, causing the browser to skip every rule
- This means Tailwind v4 preflight resets (`list-style: none`, `margin: 0`, `padding: 0`) were winning, making lists/tables/headings render as unstyled flat text
- Added nested list style variants (`circle` for level 2, `square` for level 3)
- Improved table styling: full width, header background, alternating row colors, left-aligned headers

### Task 2: Auto-expand last assistant group on streaming
- **File:** `packages/frontend/src/components/ConversationDetail.vue`
- Added `prevGroupCount` ref to track group count changes
- Updated the `groupIds` watcher to expand the last group when new groups arrive during streaming
- Preserved existing single-group auto-expand behavior

## Commits
- `910eaff` — fix: markdown rendering and auto-expand last assistant group

## Verification
- Zero `:deep()` occurrences in markdown-content.css
- `prevGroupCount` tracking logic in ConversationDetail.vue
- `vue-tsc --noEmit` passes with no type errors
