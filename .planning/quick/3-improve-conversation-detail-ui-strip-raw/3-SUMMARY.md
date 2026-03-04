---
phase: quick-3
plan: 01
subsystem: frontend-display
tags: [ui, content-sanitizer, xml-stripping]
dependency_graph:
  requires: []
  provides: [content-sanitizer-utility, clean-message-display, clean-title-display]
  affects: [ChatMessage, ConversationDetailPage]
tech_stack:
  added: []
  patterns: [pure-utility-functions, computed-property-sanitization]
key_files:
  created:
    - packages/frontend/src/utils/content-sanitizer.ts
  modified:
    - packages/frontend/src/components/ChatMessage.vue
    - packages/frontend/src/pages/ConversationDetailPage.vue
decisions:
  - Broad regex strips ALL XML-style tags (not just known ones) for future-proofing
  - stripXmlTags handles newline collapsing and trimming in one pass
  - cleanTitle falls back to 'Untitled Conversation' and truncates at 200 chars
  - Text blocks that become empty after stripping are skipped entirely
metrics:
  duration: 2min
  completed: 2026-03-04
  tasks: 2
  files: 3
---

# Quick Task 3: Improve Conversation Detail UI - Strip Raw XML Summary

XML tag stripping utility with regex-based removal, newline collapsing, and integration into ChatMessage text blocks and ConversationDetailPage title display.

## What Was Built

### Task 1: Content Sanitizer Utility
- Created `packages/frontend/src/utils/content-sanitizer.ts` with two pure functions:
  - `stripXmlTags(text)` -- removes all XML/HTML-like tags via regex, collapses 3+ newlines to 2, trims whitespace
  - `cleanTitle(title)` -- applies stripXmlTags, returns 'Untitled Conversation' for empty results, truncates at 200 chars
- Regex pattern: `/<\/?[a-zA-Z][a-zA-Z0-9_-]*(?:\s+[^>]*)?\s*\/?>/g` handles opening, closing, self-closing, and attributed tags
- All edge cases verified: empty input, tag-only content, nested tags, long titles, attribute-bearing tags

### Task 2: Component Integration
- **ChatMessage.vue**: Applied `stripXmlTags` to all 3 text block push sites in `parseContent()` plus the fallback path. Empty-after-strip text blocks are skipped (no empty paragraphs rendered). Code blocks inside markdown fences are untouched.
- **ConversationDetailPage.vue**: Added `displayTitle` computed property using `cleanTitle`. Header `<h1>` and `document.title` watchEffect both use `displayTitle` for consistent clean rendering.

## Commits

| # | Hash | Description |
|---|------|-------------|
| 1 | dd3d472 | feat(quick-3): create content-sanitizer utility with XML stripping functions |
| 2 | 6b2c8e0 | feat(quick-3): integrate XML stripping into ChatMessage and ConversationDetailPage |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- Content sanitizer unit tests: ALL PASS (12 test cases covering tags, empty input, newline collapsing, title truncation)
- Frontend build: passes cleanly with no type errors (`pnpm --filter @cowboy/frontend build` success in 2.39s)
