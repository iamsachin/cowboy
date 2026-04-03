---
phase: quick-60
plan: 01
subsystem: frontend/conversation-detail
tags: [timeline, tool-calls, ux-polish]
dependency_graph:
  requires: []
  provides: [centered-timeline, skill-tool-display, tool-status-badges]
  affects: [ConversationTimeline, ToolCallRow, ConversationDetailPage]
tech_stack:
  patterns: [computed-property-extraction, conditional-badge-styling]
key_files:
  modified:
    - packages/frontend/src/components/ConversationTimeline.vue
    - packages/frontend/src/components/ToolCallRow.vue
    - packages/frontend/src/pages/ConversationDetailPage.vue
decisions:
  - Timeline top offset set to 128px to align with metadata card (toolbar 64px + padding 16px + back button 32px + margin 16px)
  - Tool calls with output but null status treated as success (implicit completion)
metrics:
  duration: 77s
  completed: 2026-04-03
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 60: Timeline Positioning, Skill Tool Call Titles, and Status Badges

Centered timeline vertical line within sidebar panel, aligned panel top with title card, added skill name display in Skill tool call titles, and replaced "unknown" status with meaningful "success"/"pending" badges.

## Task Results

### Task 1: Fix timeline line centering and top alignment
- **Commit:** 9aac34f
- **Changes:**
  - ConversationTimeline.vue: Increased outer padding (px-3 -> px-4), widened icon column (15px -> 20px), repositioned connector line (left-[7px] -> left-[14px])
  - ConversationDetailPage.vue: Adjusted timeline panel top position (72px -> 128px) and height calc to align with metadata card

### Task 2: Show skill name in Skill tool title and fix unknown status
- **Commit:** 00b850d
- **Changes:**
  - Added `displayName` computed: shows "Skill: skill-name" for Skill tool calls
  - Added `displayInput` computed: extracts just `args` from Skill input for detail view
  - Updated `isSuccess` to treat null status with output as success
  - Added `isError` computed for error status badge styling
  - Replaced "unknown" badge with "pending" for no-status/no-output tool calls

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Build passes: `pnpm --filter frontend build` succeeds with no errors
- All success criteria met

## Self-Check: PASSED
