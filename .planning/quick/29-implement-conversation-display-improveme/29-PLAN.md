---
quick_task: 29
description: Implement conversation display improvements from claude-devtools research
mode: quick
date: 2026-03-28
---

# Quick Task 29: Implement Conversation Display Improvements

## Already implemented (skip):
- Model family color-coding: app.css already has distinct oklch colors per model
- Token usage tooltip: AssistantGroupCard already has tokenTooltip computed

## Task 1: Copy button on assistant responses + syntax highlighting in markdown

**files:** AssistantGroupCard.vue, render-markdown.ts, markdown-content.css

**action:**
1. Add a hover-reveal copy button on expanded assistant text content in AssistantGroupCard.vue
   - Import Copy, Check from lucide-vue-next (already imported in CodeBlock)
   - Add a copy button that appears on hover over the text content area
   - Copy the raw markdown/text content, not the rendered HTML
   - 2-second "Copied!" feedback

2. Add syntax highlighting to markdown code blocks via marked's highlight option
   - Import hljs in render-markdown.ts
   - Configure marked with a custom renderer that uses hljs.highlight() for code blocks
   - Add 'span' to DOMPurify ALLOWED_TAGS (hljs wraps tokens in spans)
   - Add 'class' to DOMPurify ALLOWED_ATTR so hljs classes survive sanitization

**verify:** Markdown code blocks in assistant messages show syntax colors. Copy button appears on hover.

**done:** Copy + syntax highlighting working

---

## Task 2: "Last Output" always-visible pattern + animated thinking blocks

**files:** AssistantGroupCard.vue

**action:**
1. Restructure collapsed view to show full last output (not just 3-line preview):
   - When collapsed, show the FULL last text content rendered as markdown below the header
   - Remove the preview-clamp and replace with full rendered content
   - Keep the summary header (model, tools, tokens, duration) as clickable expand trigger
   - When expanded, show thinking + tools in an expandable "Process" section, then the output at bottom

2. Replace native `<details>` for thinking blocks with Vue-managed expand/collapse:
   - Use a button with ChevronRight rotation + transition for toggle
   - Use `v-show` with CSS max-height transition for smooth reveal
   - Keep Brain icon and purple accent styling

**verify:** Last output visible without expanding. Thinking toggle animates smoothly.

**done:** Last output visible, animated thinking

---

## Task 3: Markdown preview toggle for Read tool + Export conversation

**files:** CodeViewer.vue, ConversationDetailPage.vue, new conversation-exporter.ts

**action:**
1. Add Code/Preview toggle to CodeViewer when displaying .md/.mdx files:
   - Detect markdown files from filePath extension
   - Add toggle button group (Code | Preview) above the code block
   - Preview mode renders content through renderMarkdown() in a styled container
   - Default to Code view

2. Add export dropdown to ConversationDetailPage.vue:
   - Add download button next to timeline toggle in the header
   - Dropdown with: Markdown, JSON, Plain Text
   - Create conversation-exporter.ts utility with three export functions
   - Markdown: structured with turn headings, thinking as blockquotes, tools as code blocks
   - JSON: pretty-printed conversation data
   - Plain text: USER:/ASSISTANT:/TOOL: labels
   - Download via Blob + URL.createObjectURL

**verify:** .md files in Read tool have Code/Preview toggle. Export button downloads conversation.

**done:** Markdown preview + export working
