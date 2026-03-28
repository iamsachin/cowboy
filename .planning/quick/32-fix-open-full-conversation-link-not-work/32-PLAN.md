---
phase: quick-32
type: quick
description: "Fix 'Open full conversation' link not working in subagent cards"
---

# Quick Task 32: Fix Open Full Conversation Link

## Root Cause

`ConversationDetailPage.vue` captures `route.params.id` as a plain string at setup time (line 190). When navigating from one conversation to another via the "Open full conversation" router-link, Vue Router reuses the same component instance — `id` never updates, `useConversationDetail(id)` keeps the stale conversation, and the WebSocket listener still filters on the old ID.

## Fix

Add `:key="$route.fullPath"` to `<RouterView>` in `App.vue` so same-route navigations fully remount the page component. This ensures all setup logic (id capture, composable init, WebSocket listeners) runs fresh.

## Tasks

### Task 1: Add route key to RouterView

**Files:** `packages/frontend/src/App.vue`
**Action:** Change `<RouterView />` to `<RouterView :key="$route.fullPath" />`
**Verify:** Navigate between conversation detail pages — each should load fresh data
**Done:** RouterView re-mounts on route change
