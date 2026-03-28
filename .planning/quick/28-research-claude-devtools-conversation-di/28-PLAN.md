---
quick_task: 28
description: Research claude-devtools conversation display and identify improvements for our implementation
mode: quick
date: 2026-03-28
---

# Quick Task 28: Research claude-devtools Conversation Display Improvements

## Task 1: Create comprehensive comparison analysis and implement top improvements

### Context
Deep comparison of matt1398/claude-devtools (Electron + React) conversation display vs our Vue 3 implementation reveals several high-impact improvements we can adopt.

### Key Findings from claude-devtools

**Architecture differences:**
- They use flat ChatItem list with 4 types (user/system/ai/compact) vs our 7 GroupedTurn types
- React.memo + Zustand vs our Vue reactivity
- @tanstack/react-virtual for 120+ items vs our pagination (PAGE_SIZE=50)
- Custom regex syntax highlighter vs our highlight.js

**Their standout features we lack:**
1. **"Last Output" always-visible pattern** — AI groups show final answer at bottom, tools/thinking in collapsible section above. Users see results immediately.
2. **Copy button on assistant text responses** — We only have copy on code blocks and JSON viewer
3. **Syntax highlighting in markdown code blocks** — Our `renderMarkdown()` produces unstyled `<pre><code>`, only CodeBlock.vue gets highlight.js
4. **Model family color-coding** — Opus/Sonnet/Haiku each get distinct accent colors on model badges
5. **Markdown preview toggle for Read tool** — Code/Preview switch for .md/.mdx files
6. **Export conversation** — Download as Markdown/JSON/Plain text
7. **Deep navigation with auto-expand** — Clicking search results auto-expands collapsed groups and scrolls to exact match
8. **Token usage breakdown tooltip** — Detailed input/output/cache-read/cache-creation/thinking breakdown
9. **@path mention styling** — File references in user messages rendered as validated inline badges
10. **Reply-link spotlight** — Hover dims unrelated items to visually connect request-response pairs
11. **Virtualization** — @tanstack/react-virtual for long conversations instead of pagination
12. **Notification trigger colors** — Custom color-coded alerts propagating through conversation

**What we do better:**
- Timeline panel with IntersectionObserver tracking (they have context panel but different purpose)
- Rich system message classification (7 categories vs their basic system messages)
- Compaction dividers with severity color-coding
- Sub-conversation parent-child relationships
- Live WebSocket updates with scroll position preservation

### Deliverable
Write a detailed comparison document at the quick task directory with prioritized, actionable improvement recommendations organized by effort/impact.

### files
- .planning/quick/28-research-claude-devtools-conversation-di/28-SUMMARY.md

### action
Create the comparison analysis document with:
1. Side-by-side feature comparison table
2. Top 10 prioritized improvements (ranked by impact × feasibility)
3. Implementation notes for each improvement
4. What we already do better (to preserve)

### verify
Document exists and contains actionable, specific recommendations

### done
Comparison document created with prioritized improvements
