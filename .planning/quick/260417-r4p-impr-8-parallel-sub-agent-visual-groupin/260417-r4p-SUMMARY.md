---
status: complete
quick_id: 260417-r4p
date: 2026-04-18
---

# Quick Task 260417-r4p — IMPR-8: Parallel sub-agent visual grouping

## What was built

Contiguous runs of 2+ Task/Agent tool_calls within a single assistant turn now collapse into a `SubagentBatch.vue` wrapper with a shared header (`3 sub-agents · 2✓ 1⟳`) and a flex-wrap card grid. Solo Task/Agent calls render as before via `SubagentSummaryCard`. The timeline sidebar emits a single `subagent-batch` event per parallel batch, with a `batchAggregate` and `batchToolCallIds` payload.

## Files modified

- `packages/frontend/src/components/SubagentBatch.vue` — new wrapper component (header + flex-wrap container)
- `packages/frontend/src/components/AssistantGroupCard.vue` — refactored to bucket contiguous Task/Agent runs into batch slots; threads parentModel into each batched card
- `packages/frontend/src/components/ConversationTimeline.vue` — new case in `iconConfig` and `labelClass` for `subagent-batch`
- `packages/frontend/src/composables/useTimeline.ts` — extended `TimelineEvent` with `subagent-batch` type, `batchAggregate`, `batchToolCallIds`; new run-detection loop emits batch events when run length ≥ 2
- `packages/frontend/tests/composables/useTimeline.test.ts` — 9 new test cases covering single Task, parallel batch, mixed runs, and aggregate edge cases

## Cross-improvement guardrails

- IMPR-2's `useSubagentList.ts` and `SubagentOverviewStrip.vue` are UNMODIFIED — chip strip stays granular per sub-agent, NOT per batch
- IMPR-4's `parentModel` prop continues to flow into each batched sub-agent card

## Verification

- `vue-tsc --noEmit` — clean
- `vitest run useTimeline.test.ts` — 33/33 pass (15 baseline + 9 batch + 9 status)
- Status: human_needed (visual confirmation of grid layout pending)

## Execution context

Started as a parallel worktree executor. The executor wrote the SubagentBatch component, refactored AssistantGroupCard, and added the test cases — but hit the rate limit before completing the timeline integration in `useTimeline.ts`. Recovered by:
1. `git checkout` of the worktree's component + test files
2. Manually writing the `useTimeline.ts` batch derivation
3. Adding the `subagent-batch` case to `ConversationTimeline.vue` (warned by checker)
4. Fixing the missing-glyph encoding from `!` to `\u26A0`

## Final commit

`3ed26bb` — feat(quick-260417-r4p): parallel sub-agent visual grouping (IMPR-8)
