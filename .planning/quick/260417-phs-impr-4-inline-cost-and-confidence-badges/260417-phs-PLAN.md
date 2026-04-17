---
phase: quick-260417-phs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/frontend/src/components/SubagentSummaryCard.vue
  - packages/frontend/src/components/ToolCallRow.vue
  - packages/frontend/src/components/AssistantGroupCard.vue
autonomous: true
requirements:
  - IMPR-4
tags: [subagent, cost, confidence, impr-4, frontend-only]
must_haves:
  truths:
    - "User sees inline cost (e.g. '$0.08') in the collapsed sub-agent card row-1 alongside duration, without expanding the card."
    - "User sees a coloured confidence dot in row-1 for medium (yellow) and low (red) match confidence; high/null shows no dot (keeps high-confidence case uncluttered)."
    - "When the sub-agent summary is missing (ghost states: running/unmatched/missing) no cost is shown — only the existing ghost copy from IMPR-7 renders."
    - "When the parent assistant turn's model is not in MODEL_PRICING (or model is null), the cost cell is suppressed rather than crashing — the duration and dot remain."
    - "The IMPR-7 three-state ghost render branches and null-safety of SubagentSummaryCard are untouched; vue-tsc and the IMPR-7 vitest suite still pass."
  artifacts:
    - path: "packages/frontend/src/components/SubagentSummaryCard.vue"
      provides: "`formattedCost` computed (uses calculateCost from types/pricing.ts + formatCost from utils/format-tokens.ts), `confidenceDotClass` computed (mapped to DaisyUI bg-success/bg-warning/bg-error or null), new `parentModel?: string | null` prop, row-1 template insert for cost + dot"
      contains: "const formattedCost = computed"
    - path: "packages/frontend/src/components/ToolCallRow.vue"
      provides: "Forward `parentModel` prop from caller to `<SubagentSummaryCard>`"
      contains: ":parentModel=\"parentModel\""
    - path: "packages/frontend/src/components/AssistantGroupCard.vue"
      provides: "Pass `group.model` as `parentModel` to every `<ToolCallRowComponent>`"
      contains: ":parentModel=\"group.model\""
  key_links:
    - from: "AssistantGroupCard.vue"
      to: "ToolCallRow.vue"
      via: "parentModel prop (group.model)"
      pattern: ":parentModel=\"group.model\""
    - from: "ToolCallRow.vue"
      to: "SubagentSummaryCard.vue"
      via: "parentModel prop forwarded"
      pattern: ":parentModel=\"parentModel\""
    - from: "SubagentSummaryCard.vue formattedCost computed"
      to: "types/pricing.ts calculateCost"
      via: "null-safe call with summary.value?.inputTokens/outputTokens"
      pattern: "calculateCost\\("
    - from: "SubagentSummaryCard.vue row-1 template"
      to: "utils/format-tokens.ts formatCost"
      via: "computed formattedCost"
      pattern: "formatCost\\("
---

<objective>
Add an inline cost badge (`$X.YZ`) and a coloured confidence dot to row-1 of the collapsed sub-agent summary card (IMPROVEMENT-4 from FINDINGS.md §5). Users scan a conversation and rank sub-agents by cost without expanding any card. Reuses `MODEL_PRICING` + `calculateCost` from `types/pricing.ts` and `formatCost` from `utils/format-tokens.ts`. Uses the parent assistant turn's `model` (from `AssistantGroup.model`) threaded via a one-level prop chain that mirrors the IMPR-7 `isActive` chain (AssistantGroupCard → ToolCallRow → SubagentSummaryCard).

Purpose: Closes FINDINGS.md §4.7a (cost missing from the collapsed card) and §2.2 (collapsed card is the canonical scan surface). Confidence dot lets users distinguish description-matched (medium) and position-matched (low) sub-agents at a glance — complementing IMPR-7's three-state ghost card for the summary branch.

Output: Cost string rendered in row-1 between duration and the existing confidence italic hint; confidence dot appended to row-1 for medium/low only. No crash paths for missing summaries, missing parent model, or models absent from MODEL_PRICING.
</objective>

<execution_context>
@/Users/sachin/Desktop/learn/cowboy/.claude/get-shit-done/workflows/execute-plan.md
@/Users/sachin/Desktop/learn/cowboy/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260417-mg3-use-research-skill-and-go-through-deeply/FINDINGS.md
@.planning/quick/260417-ok0-impr-7-three-state-ghost-sub-agent-card-/260417-ok0-SUMMARY.md
@packages/frontend/src/components/SubagentSummaryCard.vue
@packages/frontend/src/components/ToolCallRow.vue
@packages/frontend/src/components/AssistantGroupCard.vue
@packages/frontend/src/types/pricing.ts
@packages/frontend/src/utils/format-tokens.ts
@packages/frontend/src/types/api.ts

<interfaces>
<!-- Key types and contracts the executor needs. Executor should use these directly — no codebase exploration needed. -->

From packages/frontend/src/types/api.ts:
```typescript
export interface SubagentSummary {
  status: 'completed' | 'error' | 'interrupted' | string;
  durationMs: number | null;
  inputTokens: number;        // present per IMPR-7 SUMMARY
  outputTokens: number;       // present per IMPR-7 SUMMARY
  matchConfidence: 'high' | 'medium' | 'low' | null;
  // ... plus toolBreakdown, filesTouched, lastError, etc.
}

export interface ToolCallRow {
  id: string;
  name: string;
  input: unknown;
  // ...
  subagentSummary?: SubagentSummary | null;
  subagentLinkAttempted: boolean;
  subagentConversationId?: string | null;
}
```

From packages/frontend/src/types/pricing.ts:
```typescript
export const MODEL_PRICING: Record<string, ModelPricing>; // has 13 entries (opus/sonnet/haiku families)
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,          // pass 0 for IMPR-4 (SubagentSummary has no cache fields)
  cacheCreationTokens: number,      // pass 0 for IMPR-4
): { cost: number; savings: number } | null; // returns null when model not in MODEL_PRICING (exact + fuzzy-includes lookup)
```

From packages/frontend/src/utils/format-tokens.ts:
```typescript
export function formatCost(cost: number): string; // '$0.00', '$X.XX' (>=0.01), '$X.XXX' (>=0.001), '$X.XXXX' (>=0.0001), '< $0.0001' (below)
```

From packages/frontend/src/composables/useGroupedTurns.ts:
```typescript
export interface AssistantGroup {
  // ...
  model: string | null;   // parent turn's model — the right source for sub-agent cost attribution
}
```

From packages/frontend/src/components/SubagentSummaryCard.vue (current state after IMPR-7):
- `summary` computed is typed `SubagentSummary | null` and is null-safe.
- `defineProps<{ toolCall: ToolCallRow; isActive: boolean }>()` — add `parentModel?: string | null` as a THIRD prop (optional, defaults to undefined when not passed).
- Row-1 template is inside the `v-else` ghostState === 'summary' branch at approx lines 60-74 (flex row: ChevronRight, Bot, cardTitle, status badge, statusIcon, formattedDuration).
- Row-4 (approx :90-93) renders `confidenceHint` italic — KEEP UNCHANGED (low-confidence text stays; the dot is an ADDITIONAL visual cue, not a replacement).
</interfaces>

**Decision — prop chain vs. injection for `parentModel`:** Use a 3-step prop chain (AssistantGroupCard → ToolCallRow → SubagentSummaryCard) mirroring the existing `isActive` chain established by IMPR-7. Rationale: (a) zero new architectural concept — executor copies the `isActive` pattern mechanically; (b) `AssistantGroup.model` is already in scope where the chain starts; (c) only one hop of depth; (d) provide/inject would add implicit coupling and invisible data flow for no payoff.

**Decision — which model to use:** Use the spawning assistant turn's model (`AssistantGroup.model`). This is more accurate than a conversation-rollup model because a conversation can mix models across turns, and the sub-agent is spawned within one specific turn. FINDINGS.md §5 IMPROVEMENT-4 notes the sub-agent may itself use a different model; that's tracked as a follow-up (add `summary.subagentModel` from `src-tauri/src/ingestion/subagent_summarizer.rs`) and explicitly out of scope.

**Decision — confidence dot rendering rule:**
- `matchConfidence === 'low'` → red dot (`bg-error`)
- `matchConfidence === 'medium'` → yellow dot (`bg-warning`)
- `matchConfidence === 'high'` or `null`/missing → **no dot rendered** (keeps the high-confidence case uncluttered; consistent with `confidenceHint` already returning `null` for high)

Note: the task_scope color legend lists green=high for completeness, but the existing design language (see `confidenceHint`) suppresses UI noise when confidence is high. We keep that convention.
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add parentModel prop chain + inline cost + confidence dot to SubagentSummaryCard</name>
  <files>
    packages/frontend/src/components/SubagentSummaryCard.vue,
    packages/frontend/src/components/ToolCallRow.vue,
    packages/frontend/src/components/AssistantGroupCard.vue
  </files>
  <action>
Single-commit change spanning three files. Follow this exact order to keep vue-tsc green throughout (prop flows top-down: declare the new prop at the leaf first, then forward from middle, then supply from root).

**1a. SubagentSummaryCard.vue — the real work**

Script block edits:

- Add to the top of the `<script setup>` imports (around `:216-217`):
  ```typescript
  import { calculateCost } from '../types/pricing';
  import { formatCost } from '../utils/format-tokens';
  ```
  (`formatTokenCount` is already imported; add `formatCost` to the existing `format-tokens` import to keep one line.)

- Extend `defineProps` (current `:222-225`) to add a third, optional prop:
  ```typescript
  const props = defineProps<{
    toolCall: ToolCallRow;
    isActive: boolean;
    parentModel?: string | null;
  }>();
  ```

- Add a `formattedCost` computed directly after `formattedDuration` (around `:314`), null-safe at every layer:
  ```typescript
  const formattedCost = computed<string | null>(() => {
    const s = summary.value;
    if (!s) return null;                           // ghost states — covered by ghostState branches
    const model = props.parentModel;
    if (!model) return null;                       // no parent model → no cost attribution
    const result = calculateCost(
      model,
      s.inputTokens ?? 0,
      s.outputTokens ?? 0,
      0,                                           // SubagentSummary has no cache token fields
      0,
    );
    if (!result) return null;                      // model not in MODEL_PRICING (exact or fuzzy) → suppress
    return formatCost(result.cost);
  });
  ```

- Add a `confidenceDotClass` computed (next to `confidenceHint` around `:333-338`):
  ```typescript
  const confidenceDotClass = computed<string | null>(() => {
    const c = summary.value?.matchConfidence;
    if (c === 'medium') return 'bg-warning';
    if (c === 'low') return 'bg-error';
    return null;   // high | null → no dot
  });
  ```

Template edits — inside the `v-else` (ghostState === 'summary') branch, row-1 at approx `:60-74`. Current row-1 ends with `<span class="text-base-content/50 whitespace-nowrap">{{ formattedDuration }}</span>`. Insert TWO new spans immediately after the duration span (still inside the same `<div class="flex items-center gap-2 text-xs">`):

```html
<span v-if="formattedCost" class="text-success/70 whitespace-nowrap">
  · {{ formattedCost }}
</span>
<span
  v-if="confidenceDotClass"
  class="inline-block w-2 h-2 rounded-full shrink-0"
  :class="confidenceDotClass"
  :title="`Match confidence: ${summary?.matchConfidence}`"
></span>
```

Notes:
- The leading `·` middot mirrors FINDINGS.md §5 IMPROVEMENT-4's example rendering (`· 12 tools · $0.08 · high`).
- `text-success/70` matches the AssistantGroupCard cost pill style at `AssistantGroupCard.vue:41-43` — codebase consistency.
- The dot is a 2x2 `w-2 h-2` DaisyUI-semantic coloured circle; `title` attribute gives a hover reveal for the actual confidence level (keeps row-1 compact but accessible). `shrink-0` prevents flex squashing.
- Do NOT remove or modify the existing row-4 `confidenceHint` italic at `:90-93`. The dot is additive, not a replacement — low-confidence still gets the descriptive hint.

Ghost state branches (`missing`, `unmatched`, `running` at `:4-49`) — DO NOT TOUCH. The computeds above are null-safe (early-return when `!summary.value`), and the ghost templates don't reference them.

**1b. ToolCallRow.vue — forward the prop**

Extend `defineProps` (current `:65-70`) to add the optional `parentModel`:
```typescript
const props = defineProps<{
  toolCall: ToolCallRow;
  autoExpand?: boolean;
  tokenInfo?: string;
  isActive: boolean;
  parentModel?: string | null;
}>();
```

Forward it to the `<SubagentSummaryCard>` at `:3`:
```html
<SubagentSummaryCard v-if="isSubagentCall" :toolCall="toolCall" :isActive="isActive" :parentModel="parentModel" />
```

**1c. AssistantGroupCard.vue — supply the prop from the parent turn's model**

At the `<ToolCallRowComponent>` call site (`:109-114`), add the `parentModel` binding:
```html
<ToolCallRowComponent
  :toolCall="tc"
  :autoExpand="tc.id === autoExpandToolCallId"
  :tokenInfo="tcIdx === turn.toolCalls.length - 1 ? formatTurnTokenInfo(turn) : undefined"
  :isActive="isActive"
  :parentModel="group.model"
/>
```

`group.model` is already in scope (it's the same value `modelBadge` consumes at `:168`). Type is `string | null`, matches the declared prop.

**Out of scope for this task (explicitly do NOT add):**
- Expanded dashboard cost cell — task_scope marks it optional ("can ALSO show"); adding it doubles the test surface for marginal value. If we want it later it's a trivial follow-up (add two grid cells referencing the same `formattedCost`).
- `summary.subagentModel` backend field — follow-up, requires Rust work in `src-tauri/src/ingestion/subagent_summarizer.rs`.
- New pricing entries in `MODEL_PRICING`.
- Touching ghost state branches or any IMPR-7 null-safety code.
- Passing cache tokens (SubagentSummary has none; explicitly 0).

**Known inaccuracy (document inline as a code comment above `formattedCost`):**
```typescript
// NOTE: Uses the parent turn's model for pricing. Sub-agents can use a different model
// (e.g. Haiku dispatched by an Opus parent). Follow-up: extend SubagentSummary with
// `subagentModel` populated from src-tauri/src/ingestion/subagent_summarizer.rs and prefer
// it when present. See FINDINGS.md §5 IMPROVEMENT-4 dependency note.
```
  </action>
  <verify>
    <automated>cd packages/frontend && npx vue-tsc --noEmit && npx vitest run tests/utils/ghost-card-state.test.ts</automated>
    <manual>
      1. `npm run dev` (or Tauri equivalent) and open any conversation that has a completed Task sub-agent.
      2. Collapsed card row-1 shows `&lt;title&gt; [badge] [icon] &lt;duration&gt; · $X.XX [optional dot]`.
      3. If `matchConfidence === 'medium'`: a yellow dot appears at end of row-1, hover title says "Match confidence: medium". The row-4 italic hint ("matched by description") still appears underneath.
      4. If `matchConfidence === 'low'`: red dot + "matched by position -- may be inaccurate" hint.
      5. If `matchConfidence === 'high'` or null: no dot, no hint (current behaviour preserved).
      6. For a parent turn whose model is missing from MODEL_PRICING (or null): cost is absent, duration + dot still render, nothing crashes.
      7. For a ghost card (running/unmatched/missing per IMPR-7): no cost, no dot — the three existing ghost templates render exactly as before.
    </manual>
  </verify>
  <done>
    - `npx vue-tsc --noEmit` → 0 errors
    - `npx vitest run tests/utils/ghost-card-state.test.ts` → 8/8 pass (IMPR-7 classifier untouched)
    - `grep -n 'formattedCost\|confidenceDotClass\|parentModel' packages/frontend/src/components/SubagentSummaryCard.vue` → shows new computeds + prop (≥4 matches expected).
    - `grep -n ':parentModel' packages/frontend/src/components/ToolCallRow.vue packages/frontend/src/components/AssistantGroupCard.vue` → 2 matches (one in each file).
    - `grep -n 'summary\.value\.' packages/frontend/src/components/SubagentSummaryCard.vue` (bare, no `?`) → 0 matches (IMPR-7 null-safety not regressed).
    - `grep -n "'bg-warning'\|'bg-error'" packages/frontend/src/components/SubagentSummaryCard.vue` → contains the two dot-class strings inside `confidenceDotClass`.
    - Visual checks 2-7 above pass in dev build.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | All data is already inside the frontend trust boundary — `SubagentSummary.inputTokens/outputTokens` and `AssistantGroup.model` already flow from the Rust detail API projection verified by IMPR-1 and IMPR-7. No new network calls, no new API parameters, no new storage. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-phs-01 | Tampering | `calculateCost` inputs (inputTokens/outputTokens from API) | accept | Display-only; worst case is a misleading cost label on a malformed row. No downstream side effects (no billing, no storage write). |
| T-phs-02 | Information Disclosure | Model name shown via cost computation path | accept | Model name is already surfaced by AssistantGroupCard's `modelBadge` at `:13-17`. IMPR-4 only uses it for a local cost computation — no new exposure. |
| T-phs-03 | Denial of Service | `confidenceDotClass` / `formattedCost` computed re-evaluation on missing summary | mitigate | Both computeds early-return `null` when `summary.value` is nullish or model is missing; `calculateCost` null-returns on unknown model. Template guards are `v-if` on the computed itself, not on `summary.value`, so no nested dereference risk. |
</threat_model>

<verification>
**Automated (one command, fast):**
```bash
cd packages/frontend && npx vue-tsc --noEmit && npx vitest run tests/utils/ghost-card-state.test.ts
```
- vue-tsc: 0 errors (prop chain type-correct end-to-end).
- vitest: 8/8 IMPR-7 classifier cases still pass (no regression on ghost state logic).

**Full frontend suite (sanity check before commit):**
```bash
cd packages/frontend && npx vitest run
```
Expected: 272/276 pass (same 4 pre-existing failures documented in IMPR-7 SUMMARY's "Deferred Items" — `useCommandPalette`, `app.test.ts`, `useConversationDetail`). Zero NEW failures.

**Grep audits:**
- `grep -n 'summary\.value\.[a-zA-Z]' packages/frontend/src/components/SubagentSummaryCard.vue` (no `?`) → 0 matches (bare-dereference audit per IMPR-7 convention).
- `grep -n 'parentModel' packages/frontend/src/components/*.vue` → ≥5 matches across 3 files.
- `grep -cE 'subagentModel|summary\.subagentModel' packages/frontend/src/` → 0 (confirms we didn't sneak the out-of-scope field into this plan).

**Manual smoke (per task 1 verify block):**
7 visual checks covering the happy path, both confidence tiers, the high-confidence no-dot case, the unknown-model suppression path, and ghost-state non-regression.
</verification>

<success_criteria>
- Collapsed summary row-1 reads `&lt;title&gt; &lt;status-badge&gt; &lt;status-icon&gt; &lt;duration&gt; · $X.YZ [dot]`.
- Cost uses `formatCost` (e.g. `$0.08`, `$0.004`, `< $0.0001`) — never raw numbers.
- Cost is null-safe: missing summary → no cost cell; null parent model → no cost cell; model absent from `MODEL_PRICING` (exact + fuzzy-includes lookup) → no cost cell.
- Confidence dot renders only for `matchConfidence` in `{medium, low}`; color is `bg-warning` / `bg-error` respectively; hover title reveals the level.
- Prop chain is type-clean: `parentModel?: string | null` declared in SubagentSummaryCard.vue and ToolCallRow.vue; `:parentModel="group.model"` bound in AssistantGroupCard.vue. No other callers need updating (`SubagentSummaryCard` is only consumed via `ToolCallRow`; `ToolCallRow` is only consumed via `AssistantGroupCard` — verified by grep in pre-plan scan).
- IMPR-7 ghost branches (`missing`, `unmatched`, `running`) render byte-identical to their current state — zero edits inside those `v-if` blocks.
- IMPR-7 null-safety audit (no bare `summary.value.xxx` dereferences) still passes.
- `npx vue-tsc --noEmit` passes; IMPR-7 classifier tests pass; full suite introduces zero new failures.
</success_criteria>

<output>
After completion, create `.planning/quick/260417-phs-impr-4-inline-cost-and-confidence-badges/260417-phs-SUMMARY.md` capturing:
- Files modified (3) and LOC diff.
- Exact grep audits run and their match counts.
- vue-tsc and vitest results.
- Screenshots or descriptions of the four visual states covered by the manual smoke (medium dot, low dot, high/null no-dot, unknown-model no-cost).
- Any deviations (Rule 3 / Rule 4 per project SUMMARY convention — none expected).
- Note the known inaccuracy + follow-up (sub-agent's own model) with the FINDINGS.md §5 reference.
</output>
