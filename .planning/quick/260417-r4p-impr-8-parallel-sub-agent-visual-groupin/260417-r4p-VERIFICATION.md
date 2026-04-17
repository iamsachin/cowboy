---
status: human_needed
quick_id: 260417-r4p
date: 2026-04-18
---

# Verification — IMPR-8

## Static verification

| Must-have | Status |
|-----------|--------|
| New `SubagentBatch.vue` component exists | VERIFIED |
| `AssistantGroupCard.vue` buckets contiguous Task/Agent runs | VERIFIED — `buildRenderSlots` + render loop |
| Single Task/Agent calls render unchanged via SubagentSummaryCard | VERIFIED — runLen === 1 branch |
| Timeline emits one `subagent-batch` event per batch (not N) | VERIFIED — useTimeline run-detection loop |
| `subagent-batch` event includes `batchAggregate` and `batchToolCallIds` | VERIFIED — TimelineEvent extension |
| Aggregate covers success / error / running / unmatched / missing | VERIFIED — 33/33 tests pass |
| `interrupted` merges into `error` (matches useSubagentList convention) | VERIFIED |
| IMPR-2 `useSubagentList` is unmodified | VERIFIED — git diff scope |
| IMPR-4 `parentModel` still flows to each batched card | VERIFIED — AssistantGroupCard threading |
| `vue-tsc --noEmit` clean | VERIFIED |

## Human smoke tests pending

1. Visual confirmation of the flex-wrap grid for 3+ parallel sub-agents
2. Aggregate header glyphs render correctly (✓ ✗ ⟳ ? ⚠)
3. Solo Task/Agent calls still render as the existing card (no batch wrapper)
4. Timeline sidebar shows one row per batch (not N)
5. Mixed Read+Task+Agent in one turn breaks/forms batches at the right boundaries
