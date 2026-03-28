# Quick Task 32: Fix Open Full Conversation Link

**Date:** 2026-03-28
**Status:** Complete

## Problem

"Open full conversation" link in SubagentSummaryCard navigates to `/conversations/:subagentId` but the page doesn't reload — it shows the same (parent) conversation data.

## Root Cause

`ConversationDetailPage.vue` captures `route.params.id` as a plain string at setup time. Vue Router reuses the component instance for same-route navigations (`/conversations/A` → `/conversations/B`), so the `id` never updates and `useConversationDetail(id)` keeps fetching the original conversation.

## Fix

Added `:key="$route.fullPath"` to `<RouterView>` in `App.vue`. This forces Vue to fully remount page components when the route path changes, ensuring all setup logic runs fresh with the new ID.

## Files Changed

- `packages/frontend/src/App.vue` — Added `:key="$route.fullPath"` to `<RouterView />`

## Commits

- `2a35d9d` — fix(quick-32): fix Open full conversation link not navigating in subagent cards
