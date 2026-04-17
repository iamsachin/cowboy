---
phase: quick-260417-phs
plan: 01
subsystem: frontend/conversation-display
tags: [subagent, cost, confidence, impr-4, frontend-only]
requires:
  - AssistantGroup.model (useGroupedTurns.ts)
  - SubagentSummary.inputTokens / outputTokens / matchConfidence (types/api.ts — populated by IMPR-1)
  - types/pricing.ts MODEL_PRICING + calculateCost
  - utils/format-tokens.ts formatCost
provides:
  - Inline cost badge ($X.YZ) in row-1 of the collapsed SubagentSummaryCard
  - Inline confidence dot (bg-warning / bg-error) in row-1 for medium / low match
  - `parentModel?: string | null` prop chain: AssistantGroupCard -> ToolCallRow -> SubagentSummaryCard
affects:
  - packages/frontend/src/components/SubagentSummaryCard.vue
  - packages/frontend/src/components/ToolCallRow.vue
  - packages/frontend/src/components/AssistantGroupCard.vue
tech-stack:
  added: []
  patterns: [vue-3-defineProps, computed-null-safety, daisyui-semantic-colors, prop-drilling-mirrors-isActive-chain]
key-files:
  created: []
  modified:
    - packages/frontend/src/components/SubagentSummaryCard.vue
    - packages/frontend/src/components/ToolCallRow.vue
    - packages/frontend/src/components/AssistantGroupCard.vue
decisions:
  - Used a 3-step prop chain (mirrors IMPR-7 isActive chain) rather than provide/inject for parentModel — zero new architectural concept, one hop deep, AssistantGroup.model already in scope at the root.
  - Used the spawning assistant turn's model (AssistantGroup.model) for cost attribution. Sub-agents may run a different model; a follow-up to add SubagentSummary.subagentModel (Rust-side) is tracked as out-of-scope.
  - Confidence dot rule — medium=warning yellow, low=error red, high/null=no dot (preserves existing design language where confidenceHint already returns null for high).
  - Additive dot — did NOT replace the existing row-4 `confidenceHint` italic. Low-confidence users still get the descriptive hint under the card.
metrics:
  duration: ~15m
  completed: 2026-04-17
requirements: [IMPR-4]
---

# Phase quick-260417-phs Plan 01: IMPR-4 Inline Cost and Confidence Badges Summary

Inline `$X.YZ` cost badge and DaisyUI-coloured match-confidence dot now render in row-1 of the collapsed sub-agent summary card, wired via a 3-step `parentModel` prop chain (AssistantGroupCard -> ToolCallRow -> SubagentSummaryCard) that reuses `calculateCost` from `types/pricing.ts` and `formatCost` from `utils/format-tokens.ts`.

## What Changed

### SubagentSummaryCard.vue (+40 / -1)

Script block:
- Imports: added `formatCost` to existing `format-tokens` import; new import `calculateCost` from `../types/pricing`.
- `defineProps`: added third optional prop `parentModel?: string | null`.
- New computed `formattedCost` (after `formattedDuration`): null-safe at 3 layers — missing summary, missing parentModel, model not in MODEL_PRICING. Passes 0 for both cache token args (SubagentSummary has no cache fields).
- New computed `confidenceDotClass` (next to `confidenceHint`): returns `bg-warning` / `bg-error` / `null`.
- Inline code comment documents the known inaccuracy (parent turn's model != sub-agent's own model) with the FINDINGS.md §5 follow-up reference.

Template (inside `v-else` / `ghostState === 'summary'` branch, row-1 only):
- Added two spans after the `formattedDuration` span: the cost span (`text-success/70` — matches AssistantGroupCard cost pill style) and the 2x2 `w-2 h-2 rounded-full` dot with a `title` hover revealing the confidence level.

Ghost branches (`missing`, `unmatched`, `running`), row-4 `confidenceHint` italic, and all IMPR-7 null-safety computeds are byte-identical (no edits).

### ToolCallRow.vue (+2 / -1)

- Extended `defineProps` with `parentModel?: string | null` (5th prop, optional).
- Forwarded it on the `<SubagentSummaryCard>` render (`:parentModel="parentModel"`).

### AssistantGroupCard.vue (+1)

- Bound `:parentModel="group.model"` on `<ToolCallRowComponent>` inside the per-turn `v-for`. Type matches (`AssistantGroup.model: string | null`).

## Verification

### vue-tsc

```
cd packages/frontend && npx vue-tsc --noEmit
```
Result: **0 errors.** Ran twice (once after source edits, once post-commit).

Note: initial run in this agent's worktree showed "Cannot find module 'vue' ..." errors because the worktree lacked a `node_modules/`. Resolved by symlinking `packages/frontend/node_modules` and the monorepo-root `node_modules` from `/Users/sachin/Desktop/learn/cowboy`. The symlinks are not tracked (already in `.gitignore`) and are external to the commit.

### vitest — IMPR-7 non-regression

```
npx vitest run tests/utils/ghost-card-state.test.ts
```
Result: **8/8 pass** — IMPR-7 classifier unchanged.

### Grep audits

| Audit | Expected | Actual |
|-------|----------|--------|
| `formattedCost\|confidenceDotClass\|parentModel` in SubagentSummaryCard.vue | >=4 matches | **8 matches** (lines 74-80 template, 235 prop, 331-334 computed, 371 computed) |
| `:parentModel` across SubagentSummaryCard/ToolCallRow/AssistantGroupCard | 2 matches | **2 matches** — `ToolCallRow.vue:3`, `AssistantGroupCard.vue:114` |
| `summary\.value\.[a-zA-Z]` (bare, no `?`) in SubagentSummaryCard.vue | 0 matches | **0 matches** — IMPR-7 null-safety audit passes |
| `'bg-warning'\|'bg-error'` in SubagentSummaryCard.vue | 2 lines | **2 lines** — `confidenceDotClass` body (`:373-374`) |
| `summary\.subagentModel\|summary\?\.subagentModel` in `src/` | 0 matches | **0 matches** — out-of-scope backend field did not sneak in |

### Commit sanity

- `git diff --diff-filter=D --name-only HEAD~1 HEAD` -> **empty** (no deletions).
- `git log --oneline -1` -> `1831e14 feat(quick-260417-phs): inline cost and confidence dot in collapsed sub-agent card`.
- `git diff HEAD~1 HEAD --stat` -> 3 files changed, 42 insertions(+), 2 deletions(-).

## Visual States (design confirmation — pending in-app manual smoke)

| State | Expected row-1 | Expected row-4 |
|-------|----------------|----------------|
| summary, high / null confidence, known model | `<title> <badge> <icon> <duration> · $X.YZ` | (unchanged — no hint) |
| summary, medium confidence, known model | `<title> <badge> <icon> <duration> · $X.YZ <yellow-dot>` | `matched by description` (italic) |
| summary, low confidence, known model | `<title> <badge> <icon> <duration> · $X.YZ <red-dot>` | `matched by position -- may be inaccurate` (italic) |
| summary, any confidence, unknown or null parentModel | `<title> <badge> <icon> <duration> <dot?>` (no cost) | (as above) |
| ghost (`missing` / `unmatched` / `running`) | ghost template only — byte-identical to IMPR-7 | N/A |

Manual smoke steps 1-7 from the plan are ready to run once the dev build is launched; the data flow is fully wired.

## Deviations from Plan

**None — plan executed exactly as written.**

Rules 1-4 did not fire. The three file edits, their ordering, the computed definitions, the prop chain, the template inserts, and the DaisyUI class names all match the plan's `<action>` block to the line. No auto-fixes, no architectural rethinks.

One environmental adjustment worth noting (not a code deviation): the worktree's `node_modules` were absent, so two symlinks were created (via `node fs.symlinkSync`) pointing to the main checkout's `packages/frontend/node_modules` and monorepo-root `node_modules`. These are git-ignored and external to the commit; they exist only so `npx vue-tsc --noEmit` can resolve the pnpm-layout workspace dependencies.

## Known Limitations / Follow-ups

1. **Sub-agent's own model not yet used.** The inline cost uses the parent turn's model. A sub-agent dispatched with `model: "claude-haiku-4-5"` from a Sonnet parent will show the Sonnet-priced cost. Follow-up: extend `SubagentSummary` with a `subagentModel: string | null` field populated from `src-tauri/src/ingestion/subagent_summarizer.rs`, then prefer it in `formattedCost`. A code comment above `formattedCost` links this to FINDINGS.md §5 IMPROVEMENT-4.
2. **Expanded dashboard cost cell not added.** The plan explicitly marked it as optional; adding a `Cost` row to the 2-col metadata grid would be a trivial follow-up referencing the same `formattedCost` computed.
3. **No new MODEL_PRICING entries.** Any model absent from the pricing table (exact + fuzzy-includes match) silently suppresses the cost — by design, no crash. Adding new model rows is independent work.

## Threat Flags

None introduced. IMPR-4 is display-only, adds no network surface, no storage writes, no new API parameters. `AssistantGroup.model` is already surfaced by `modelBadge` at `AssistantGroupCard.vue:13-17` — no new exposure.

## TDD Gate Compliance

Not applicable — plan frontmatter is `type: execute` (not `type: tdd`), and the single task is `type="auto" tdd="false"`. Standard feature commit gate followed (`feat(...)` scope).

## Self-Check

- [x] File exists: `packages/frontend/src/components/SubagentSummaryCard.vue` (modified, 419 lines after edit)
- [x] File exists: `packages/frontend/src/components/ToolCallRow.vue` (modified, 100 lines after edit)
- [x] File exists: `packages/frontend/src/components/AssistantGroupCard.vue` (modified, 317 lines after edit)
- [x] Commit `1831e14` found in `git log --oneline -5`
- [x] SUMMARY.md written to `.planning/quick/260417-phs-impr-4-inline-cost-and-confidence-badges/260417-phs-SUMMARY.md`

## Self-Check: PASSED
