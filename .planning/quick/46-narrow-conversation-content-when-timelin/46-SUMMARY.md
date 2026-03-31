---
phase: quick-46
plan: 01
subsystem: frontend
tags: [layout, timeline, conversation-detail]
dependency_graph:
  requires: [useTimeline composable]
  provides: [dynamic content margin when timeline open]
  affects: [ConversationDetailPage layout]
tech_stack:
  patterns: [dynamic class binding, Tailwind transition utilities]
key_files:
  modified:
    - packages/frontend/src/pages/ConversationDetailPage.vue
decisions: []
metrics:
  duration: 32s
  completed: 2026-03-31
---

# Quick Task 46: Narrow Conversation Content When Timeline Open

Dynamic right margin on conversation content using Tailwind `mr-[220px]` class bound to timeline `isOpen` state, with smooth 200ms margin transition.

## Changes Made

### Task 1: Add dynamic right margin to content when timeline is open
**Commit:** 043bf55

Added a dynamic `:class` binding to the main content div in ConversationDetailPage.vue that applies `mr-[220px]` when the timeline sidebar is open (`isOpen && data`). Also added `transition-[margin] duration-200` for a smooth animated resize when toggling the sidebar.

**Files modified:**
- `packages/frontend/src/pages/ConversationDetailPage.vue` - Added dynamic class binding and transition classes to main content div (line 3)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- [x] `mr-[220px]` class binding present with `isOpen && data` condition
- [x] Transition classes added for smooth animation
- [x] Frontend build succeeds with no errors
