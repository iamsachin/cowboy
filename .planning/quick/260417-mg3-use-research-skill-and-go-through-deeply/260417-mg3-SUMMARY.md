---
status: complete
quick_id: 260417-mg3
date: 2026-04-17
---

# Quick Task 260417-mg3 — Summary

**Task:** Use research skill and go through deeply about how we identify sub-agent calls and how we display them. Come up with the ways we can improve this discovery.

**Status:** Research complete; no production code changes.
**Primary artifact:** `FINDINGS.md` (Sections 1-5 — identification, display, prior art, gap analysis, prioritised backlog).

## What was investigated and how

Applied the project `research` skill (`.claude/skills/research/SKILL.md`) with three parallel angles:

1. **Identification pipeline** — deep read of `src-tauri/src/ingestion/subagent_linker.rs`, `subagent_summarizer.rs`, `types.rs`, `mod.rs`; traced `Task` tool_use → JSONL discovery → three-phase match → DB write.
2. **Display pipeline** — deep read of `SubagentSummaryCard.vue`, `ToolCallRow.vue`, `ConversationTimeline.vue`, `ConversationBrowser.vue`, `ConversationTable.vue`, `TrayPanelPage.vue`, `ConversationDetailPage.vue`, `useGroupedTurns.ts`, `useTimeline.ts`, `types/api.ts`; mapped per-surface rendering and the parent→child journey.
3. **Prior art + gaps** — reviewed quick-task summaries 28, 30, 31, 32, 69, 75; cross-referenced PROJECT.md Key Decisions table.

## Headline finding

Cowboy identifies sub-agents via a four-phase pipeline (file discovery → parse → three-phase linker → summary write) that produces a JSON blob on `tool_calls.subagent_summary` plus a redundant filesystem-level `conversations.parent_conversation_id`. Display is anchored by the three-tier `SubagentSummaryCard` (ghost / collapsed / dashboard+trace) inside `ToolCallRow`, with secondary surfaces in the timeline sidebar and as indented child rows in list views. **Discovery is strongest inside an open conversation and weakest everywhere else** — the tray hides sub-agents, the dashboard has no aggregate widget, the browser has no sub-agent facet, FTS does not index sub-agent summary JSON, and the subagent_summary UPDATE does not emit a WebSocket event, so live cards do not refresh until an unrelated change fires.

## Top 3 P0 improvements

1. **IMPROVEMENT-1** — Emit WebSocket `tool_call:changed` event after sub-agent linking completes (`src-tauri/src/ingestion/mod.rs:582-589`). Fixes live-UX regression where completing sub-agents stay as ghost cards.
2. **IMPROVEMENT-2** — Sub-agent overview strip at top of ConversationDetailPage (`packages/frontend/src/pages/ConversationDetailPage.vue` header area + new `SubagentOverviewStrip.vue`). Gives scannable "3 sub-agents · 2 ✓ 1 ✗" chip row with click-to-jump.
3. **IMPROVEMENT-3** — Status-aware timeline icons + pulse-during-running (`packages/frontend/src/components/ConversationTimeline.vue:52-76` + `packages/frontend/src/composables/useTimeline.ts:44-66`). Distinguishes success/error/running at a glance in the sidebar.

## Execution note

The sub-agent executor was blocked by its role-level rule against writing `.md` report/findings files and returned the content inline; the parent orchestrator persisted `FINDINGS.md` and this `SUMMARY.md` directly.
