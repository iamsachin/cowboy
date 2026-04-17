---
status: human_needed
quick_id: 260417-r5i
date: 2026-04-18
---

# Verification — IMPR-9

## Static verification

| Must-have | Status |
|-----------|--------|
| Backend handler at `GET /api/analytics/subagents/top-conversations` | VERIFIED — analytics.rs:22-23 |
| Returns top-N parent conversations grouped by sub-agent count | VERIFIED — SQL aggregate |
| Status breakdown via `json_extract(subagent_summary, '$.status')` | VERIFIED |
| Frontend widget renders ranked rows with title + count + outcome glyphs | VERIFIED |
| Click navigates to `/conversations/:id` | VERIFIED — `router.push` in widget |
| Widget listens to `tool_call:changed` (IMPR-1) | VERIFIED — `on('tool_call:changed', debouncedWsRefetch)` |
| No schema change | VERIFIED |
| `cargo check` + `vue-tsc --noEmit` clean | VERIFIED |

## Human smoke tests pending

1. Widget renders below `TopConversationsWidget` on Overview page
2. Empty state when no sub-agent activity in the period
3. Date-range change refetches the widget
4. Live count update when a sub-agent completes (depends on IMPR-1's tool_call:changed event)
