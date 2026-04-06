---
phase: quick-78
plan: 01
subsystem: frontend/scroll
tags: [scroll, auto-scroll, streaming, composable, ux]
dependency_graph:
  requires: []
  provides: [intent-based-scroll-tracking]
  affects: [conversation-detail, scroll-tracker]
tech_stack:
  added: []
  patterns: [intent-based-state, programmatic-scroll-guard]
key_files:
  created: []
  modified:
    - packages/frontend/src/composables/useScrollTracker.ts
    - packages/frontend/src/components/ConversationDetail.vue
    - packages/frontend/tests/composables/useScrollTracker.test.ts
decisions:
  - Use userScrolledAway intent flag instead of isAtBottom for auto-scroll decisions
  - Guard programmatic scrolls with a flag to prevent false userScrolledAway flips
  - Replace captureScrollPosition in hot path with direct scrollToBottom for simplicity
metrics:
  duration: 164s
  completed: 2026-04-07
  tasks: 2
  commits: 3
---

# Quick Task 78: Fix Auto-Scroll Losing Bottom During Rapid Streaming

Intent-based scroll tracking with programmatic scroll guard replacing fragile isAtBottom capture/restore pattern.

## What Changed

### useScrollTracker.ts
- Added `userScrolledAway` ref (default false) representing user intent, not transient scroll position
- Added `programmaticScroll` boolean guard so auto-scroll calls to `scrollToBottom` do not trigger the scroll handler to flip `userScrolledAway` to true
- `scrollToBottom()` now sets `programmaticScroll = true` and resets `userScrolledAway = false` before calling `el.scrollTo()`
- `onScroll()` RAF handler: skips intent update when `programmaticScroll` is true; otherwise sets `userScrolledAway` based on `isAtBottom`
- `captureScrollPosition()` now uses `userScrolledAway` (not `isAtBottom`) for the auto-scroll vs preserve-position decision
- Exported `userScrolledAway` as readonly
- All existing exports (`isAtBottom`, `scrollToBottom`, `checkBottom`, `captureScrollPosition`) preserved with same signatures

### ConversationDetail.vue
- Message-length watcher: replaced `captureScrollPosition` capture/restore with simple `if (userScrolledAway) return; scrollToBottom(false)` -- eliminates the race condition during rapid streaming
- Auto-expand visible count watcher: uses `!userScrolledAway` instead of `isAtBottom`
- New messages pill computed: uses `!userScrolledAway` instead of `isAtBottom`
- `handleScrollToBottom()` (pill click) already calls `scrollToBottom(true)` which resets `userScrolledAway` via Task 1

### Tests
- 6 new test cases covering userScrolledAway behavior (default, user scroll away, scroll back, pill click reset, programmatic guard, captureScrollPosition integration)
- 1 existing test updated to work with new intent-based captureScrollPosition behavior
- All 14 tests pass

## Root Cause Analysis

During rapid streaming, the old approach:
1. Called `captureScrollPosition()` which snapshotted `isAtBottom` at capture time
2. Between capture and restore (across `await nextTick()`), content height changed
3. The RAF-throttled `onScroll` handler could not keep up with frequent height changes
4. A single missed scroll-to-bottom caused `isAtBottom` to flip false permanently

The fix separates "is the user at bottom right now?" (transient, unreliable during streaming) from "does the user want to follow bottom?" (sticky intent, only changes on deliberate user scroll).

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 851f95b | test(quick-78): add failing tests for intent-based scroll tracking |
| 2 | 0c24370 | feat(quick-78): add intent-based userScrolledAway tracking to useScrollTracker |
| 3 | 45bc211 | feat(quick-78): use intent-based auto-scroll in ConversationDetail |

## Self-Check: PASSED

All 4 files verified on disk. All 3 commits verified in git log.
