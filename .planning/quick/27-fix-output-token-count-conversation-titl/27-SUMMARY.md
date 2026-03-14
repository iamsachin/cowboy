---
phase: quick-27
plan: 01
subsystem: ui, ingestion
tags: [vue, rust, token-display, title-derivation, scroll, intersection-observer]

requires: []
provides:
  - Context-based token display with tooltip breakdown in assistant group headers
  - Slash command fallback for conversation title derivation
  - Race-condition-free timeline scroll navigation
affects: [AssistantGroupCard, title_utils, normalizer, ConversationDetailPage]

tech-stack:
  added: []
  patterns:
    - "Navigating flag pattern to prevent observer/scroll race conditions"
    - "Slash command fallback pass in title derivation chain"

key-files:
  created: []
  modified:
    - packages/frontend/src/components/AssistantGroupCard.vue
    - src-tauri/src/ingestion/title_utils.rs
    - src-tauri/src/ingestion/normalizer.rs
    - packages/frontend/src/pages/ConversationDetailPage.vue

key-decisions:
  - "Show last turn context window size as main metric rather than cumulative sum across all turns"
  - "Slash commands take priority over assistant text in title fallback chain"
  - "Updated existing assistant_fallback test to reflect new slash command priority"

requirements-completed: [FIX-TOKEN-DISPLAY, FIX-CONV-TITLE, FIX-TIMELINE-SCROLL]

duration: 5min
completed: 2026-03-14
---

# Quick Task 27: Fix Token Display, Conversation Title, and Timeline Scroll

**Context window size display with tooltip, slash command title fallback, and navigating-flag scroll fix**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T09:55:55Z
- **Completed:** 2026-03-14T10:00:35Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Token display now shows last turn's context window size (inputTokens + cacheReadTokens) instead of misleading cumulative sum
- DaisyUI tooltip on token display shows full breakdown: context, cache reads, new input, output
- Conversations starting with slash commands (e.g., /gsd:discuss-phase) followed by short replies use the slash command as title
- Timeline click-to-navigate no longer drifts on repeated clicks due to observer/scroll race condition

## Task Commits

1. **Task 1: Fix token display to show context size with tooltip** - `86c7c31` (fix)
2. **Task 2: Fix conversation title for slash command conversations** - `f074035` (fix)
3. **Task 3: Fix timeline scroll race condition** - `84b3c5d` (fix)

## Files Created/Modified
- `packages/frontend/src/components/AssistantGroupCard.vue` - Added contextTokens to groupTokens computed, tokenTooltip computed, updated header display
- `src-tauri/src/ingestion/title_utils.rs` - Added short message skip (<=2 chars), slash command fallback pass, 5 new tests
- `src-tauri/src/ingestion/normalizer.rs` - Added should_skip_for_title check on XML fallback, slash command fallback pass
- `packages/frontend/src/pages/ConversationDetailPage.vue` - Added navigating ref flag, guarded observer callback, instant scroll during navigation

## Decisions Made
- Show last turn's context window size as main metric: this is what users care about (actual context size), not the cumulative sum across all turns
- Slash commands take priority over assistant text in the title fallback chain: when a conversation only has a slash command and a short reply, the slash command is more informative than a generic assistant response
- Updated existing `derive_title_assistant_fallback` test to reflect new behavior where slash commands are preferred over assistant text, and added a new test for the assistant-only fallback case

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing test for new slash command priority**
- **Found during:** Task 2
- **Issue:** Existing `derive_title_assistant_fallback` test expected assistant text to win over slash commands, but the new slash command fallback pass intentionally changes this priority
- **Fix:** Updated test expectation to match new behavior, added separate test `derive_title_assistant_fallback_no_slash` for the case with no slash commands
- **Files modified:** src-tauri/src/ingestion/title_utils.rs
- **Committed in:** f074035

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test update was necessary to reflect intentional behavior change. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

---
*Quick Task: 27*
*Completed: 2026-03-14*
