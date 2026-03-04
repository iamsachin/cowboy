---
phase: 04-conversation-browser
plan: 03
subsystem: ui
tags: [vue, highlight.js, daisyui, chat-bubbles, code-blocks, syntax-highlighting]

# Dependency graph
requires:
  - phase: 04-conversation-browser
    provides: getConversationDetail API, MessageRow, ToolCallRow, ConversationDetailResponse types
provides:
  - ConversationDetailPage with full metadata header and chat bubble layout
  - ChatMessage component with role-based positioning and markdown code fence parsing
  - CodeBlock component with highlight.js syntax highlighting, line numbers, copy-to-clipboard
  - ToolCallCard collapsible component with status badge and JSON input/output
  - ConversationDetail timeline merging messages and tool calls chronologically
  - useConversationDetail composable fetching single conversation with 404 handling
affects: [frontend-conversation-browser, future-conversation-enhancements]

# Tech tracking
tech-stack:
  added: [highlight.js, "@highlightjs/vue-plugin"]
  patterns: [selective-hljs-loading, content-fence-parsing, chronological-timeline-merge, composable-immediate-fetch]

key-files:
  created:
    - packages/frontend/src/components/CodeBlock.vue
    - packages/frontend/src/components/ToolCallCard.vue
    - packages/frontend/src/components/ChatMessage.vue
    - packages/frontend/src/components/ConversationDetail.vue
    - packages/frontend/src/composables/useConversationDetail.ts
  modified:
    - packages/frontend/src/main.ts
    - packages/frontend/src/app.css
    - packages/frontend/src/pages/ConversationDetailPage.vue
    - packages/frontend/package.json

key-decisions:
  - "highlight.js with selective language loading (12 languages) over full bundle for smaller payload"
  - "Transparent hljs background via CSS override for DaisyUI theme compatibility"
  - "Regex-based markdown code fence parsing in ChatMessage for inline code block rendering"
  - "Chronological timeline merge of messages and toolCalls for natural conversation flow"

patterns-established:
  - "Selective hljs loading: import core + register individual languages to minimize bundle size"
  - "Content parsing: regex /```(\\w*)\\n([\\s\\S]*?)```/g splits message content into text/code blocks"
  - "Timeline merge: map both arrays to unified type, concat, sort by createdAt ascending"
  - "Immediate fetch composable: call fetchDetail() on creation without watch (ID is static per page)"

requirements-completed: [CONV-03, CONV-04]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 04 Plan 03: Conversation Detail Page Summary

**Chat bubble layout with highlight.js syntax-highlighted code blocks, collapsible tool call cards, and full metadata header at /conversations/:id**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T08:14:00Z
- **Completed:** 2026-03-04T08:17:59Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Installed highlight.js with selective loading of 12 common languages and github-dark theme
- Built CodeBlock component with syntax highlighting, line numbers gutter, and copy-to-clipboard with feedback
- Built ToolCallCard with DaisyUI collapse, status badges (success/warning/ghost), and formatted JSON input/output
- Built ChatMessage with DaisyUI chat bubbles (user right/primary, assistant left/neutral) and markdown code fence parsing
- Built ConversationDetail timeline merging messages and tool calls chronologically
- Built ConversationDetailPage with metadata header (title, agent, model, project, date, duration, tokens, cost/savings)
- Implemented useConversationDetail composable with loading, error, and 404 states
- Full production build passes with proper code splitting (detail page: 10.77 kB / 3.89 kB gzip)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install highlight.js, create CodeBlock and ToolCallCard** - `ba57460` (feat)
2. **Task 2: Create ChatMessage, ConversationDetail, detail page, and composable** - `0c6c112` (feat)

## Files Created/Modified
- `packages/frontend/src/main.ts` - Added highlight.js setup with 12 languages and hljsVuePlugin registration
- `packages/frontend/src/app.css` - Added transparent hljs background override for DaisyUI compatibility
- `packages/frontend/package.json` - Added highlight.js and @highlightjs/vue-plugin dependencies
- `packages/frontend/src/components/CodeBlock.vue` - Syntax highlighted code with line numbers and copy button
- `packages/frontend/src/components/ToolCallCard.vue` - Collapsible tool call display with status badge and JSON
- `packages/frontend/src/components/ChatMessage.vue` - Chat bubble with role styling and code fence parsing
- `packages/frontend/src/components/ConversationDetail.vue` - Timeline merging messages and tool calls chronologically
- `packages/frontend/src/composables/useConversationDetail.ts` - Fetch single conversation detail with 404 handling
- `packages/frontend/src/pages/ConversationDetailPage.vue` - Full detail page with metadata header and conversation timeline

## Decisions Made
- Used highlight.js core with selective language registration (12 languages) instead of full bundle to minimize payload
- Applied transparent background override on .hljs to let DaisyUI base-300 container provide the background color
- Parsed markdown code fences with regex to split message content into text and code blocks inline
- Merged messages and tool calls into a single chronological timeline sorted by createdAt for natural conversation flow
- Used immediate fetch pattern in composable (no watch needed since conversation ID is static per page visit)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Conversation detail page fully functional at /conversations/:id
- Phase 04 complete (all 3 plans: API, browser list, detail page)
- Ready for Phase 05 (Agent Profiles)

## Self-Check: PASSED

- All 7 expected files found on disk
- Both task commits (ba57460, 0c6c112) found in git log

---
*Phase: 04-conversation-browser*
*Completed: 2026-03-04*
