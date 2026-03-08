---
phase: quick-10
plan: 01
subsystem: conversation-browser
tags: [ui, status-indicator, ingestion, schema]
dependency_graph:
  requires: []
  provides: [conversation-status-tracking, active-conversation-indicator]
  affects: [ingestion-pipeline, conversation-list-api, conversation-browser-ui]
tech_stack:
  added: []
  patterns: [onConflictDoUpdate-for-status-tracking, css-pulse-animation]
key_files:
  created:
    - packages/backend/drizzle/0004_smooth_lily_hollister.sql
  modified:
    - packages/backend/src/db/schema.ts
    - packages/backend/src/ingestion/index.ts
    - packages/backend/src/db/queries/analytics.ts
    - packages/shared/src/types/api.ts
    - packages/frontend/src/components/ConversationBrowser.vue
    - packages/backend/tests/fixtures/seed-analytics.ts
decisions:
  - "status column uses text type with 'active'|'completed' values, default 'completed'"
  - "Staleness threshold: 5 minutes since last updatedAt marks conversation as completed"
  - "isActive is optional on ConversationRow to avoid breaking non-list consumers"
metrics:
  duration: 182s
  completed: 2026-03-08
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 10: Show Blinking Green Circle Indicator for Active Conversations

Active conversation status tracking with pulsing green dot in conversation list UI.

## One-liner

Status column on conversations table with ingestion-driven active/completed tracking and 8px pulsing green dot indicator in conversation browser.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | f722d45 | Add status column, ingestion update, and isActive query |
| 2 | 844637c | Add pulsing green dot indicator for active conversations |

## What Was Built

### Backend: Status Tracking

- Added `status` text column to `conversations` table (default: `'completed'`)
- Generated Drizzle migration `0004_smooth_lily_hollister.sql`
- Changed both Claude Code and Cursor ingestion from `onConflictDoNothing` to `onConflictDoUpdate` -- re-ingested conversations get `status: 'active'` and fresh `updatedAt`
- Added staleness cleanup after ingestion: conversations with `status='active'` and `updatedAt > 5 minutes ago` are marked `'completed'`
- Added `isActive` computed boolean field to `getConversationList` query via SQL CASE expression

### Shared Types

- Added `isActive?: boolean` to `ConversationRow` interface (optional to avoid breaking other consumers)

### Frontend: Pulse Indicator

- Added 8px green pulsing dot (`pulse-dot` class) next to conversation title when `row.isActive` is true
- Animation: smooth opacity transition between 1.0 and 0.3 on a 1.5s ease-in-out cycle
- Dot uses `shrink-0` to prevent compression; text container uses `min-w-0` to preserve truncation
- No indicator shown for completed conversations

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- Backend conversation analytics tests: 7/7 passing
- No new TypeScript errors introduced (pre-existing chart animation type errors are unrelated)

## Self-Check: PASSED
