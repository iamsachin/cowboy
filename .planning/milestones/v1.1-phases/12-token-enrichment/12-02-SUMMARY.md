---
phase: 12-token-enrichment
plan: 02
subsystem: ui
tags: [vue, token-usage, cost-display, compact-formatting, prop-drilling]

requires:
  - phase: 12-token-enrichment
    provides: MessageTokenUsage interface and tokenUsageByMessage map on ConversationDetailResponse
provides:
  - formatTokenCount and formatTurnCost utility functions for compact token/cost display
  - Aggregated token count and cost display in AssistantGroupCard collapsed headers
  - Per-turn token/cost display in AssistantGroupCard expanded view
affects: []

tech-stack:
  added: []
  patterns: [compact number formatting with k/M suffixes, conditional cost precision]

key-files:
  created:
    - packages/frontend/src/utils/format-tokens.ts
  modified:
    - packages/frontend/src/components/AssistantGroupCard.vue
    - packages/frontend/src/components/ConversationDetail.vue
    - packages/frontend/src/pages/ConversationDetailPage.vue

key-decisions:
  - "text-base-content/50 for token counts, text-success/70 for cost -- consistent with existing metadata styling"
  - "Aggregation in computed property iterating group turns -- simple, reactive, no extra store needed"
  - "Graceful omission via v-if guards -- no zeros or N/A when token data is absent"

patterns-established:
  - "Compact token formatting: >= 1M -> 1.2M, >= 1k -> 12.3k, else raw number"
  - "Cost precision: >= $0.01 -> 2 decimals, >= $0.001 -> 3 decimals, else < $0.001"

requirements-completed: [META-01, META-02]

duration: 19min
completed: 2026-03-05
---

# Phase 12 Plan 02: Frontend Token Display Summary

**Compact per-turn token counts and cost in AssistantGroupCard headers with aggregation across grouped turns**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-05T08:59:36Z
- **Completed:** 2026-03-05T09:18:29Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Created format-tokens.ts with formatTokenCount (compact k/M suffixes) and formatTurnCost (conditional precision)
- Prop-drilled tokenUsageByMessage from ConversationDetailPage through ConversationDetail to AssistantGroupCard
- Aggregated token counts and cost in collapsed group headers (e.g., "758 in / 35.6k out" and "$4.31")
- Per-turn token/cost breakdown in expanded view (e.g., "2 in / 277 out . $0.09")
- Graceful degradation verified -- Cursor conversations with no token data show no token/cost info

## Task Commits

Each task was committed atomically:

1. **Task 1: Token formatting utilities and prop drilling** - `5178bc1` (feat)
2. **Task 2: Visual verification** - checkpoint approved by user

## Files Created/Modified
- `packages/frontend/src/utils/format-tokens.ts` - formatTokenCount and formatTurnCost utility functions
- `packages/frontend/src/components/AssistantGroupCard.vue` - Aggregated group tokens in header, per-turn tokens in expanded view
- `packages/frontend/src/components/ConversationDetail.vue` - Accept and pass tokenUsageByMessage prop
- `packages/frontend/src/pages/ConversationDetailPage.vue` - Pass data.tokenUsageByMessage to ConversationDetail

## Decisions Made
- Used text-base-content/50 for token counts and text-success/70 for cost, consistent with existing metadata styling
- Aggregated tokens via computed property iterating group turns rather than pre-computing in composable
- Graceful omission via v-if guards -- nothing renders when token data is absent (no zeros, no "N/A")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rebuilt shared package types**
- **Found during:** Task 1 verification (vue-tsc --noEmit)
- **Issue:** Frontend could not resolve MessageTokenUsage from @cowboy/shared because shared package .d.ts files were stale
- **Fix:** Ran `npx tsc --build` in packages/shared to regenerate declaration files
- **Files modified:** packages/shared/tsconfig.tsbuildinfo
- **Verification:** vue-tsc --noEmit passes cleanly
- **Committed in:** 5178bc1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential build step. No scope creep.

## Issues Encountered
None beyond the shared package rebuild documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 12 (Token Enrichment) fully complete -- both backend data (Plan 01) and frontend display (Plan 02)
- META-01 and META-02 requirements satisfied
- Ready for Phase 13 or any remaining milestone work

---
*Phase: 12-token-enrichment*
*Completed: 2026-03-05*
