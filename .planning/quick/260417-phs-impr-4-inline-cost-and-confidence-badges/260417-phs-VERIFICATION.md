---
phase: quick-260417-phs
verified: 2026-04-17T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Open any conversation with a completed Task sub-agent in dev build. Confirm collapsed card row-1 shows title, status badge, status icon, duration, then '· $X.YZ' cost label."
    expected: "Cost appears as formatted string (e.g. '$0.08', '< $0.0001') in text-success/70 colour, separated by middot. No raw numbers."
    why_human: "Requires running dev build with real conversation data — cannot grep for runtime rendering."
  - test: "Open a sub-agent with matchConfidence === 'medium'. Inspect row-1 and row-4."
    expected: "Yellow dot (bg-warning, 2x2 circle) at end of row-1; hover title reads 'Match confidence: medium'. Row-4 italic 'matched by description' hint still present."
    why_human: "Dot colour and hover title require visual inspection in a running browser."
  - test: "Open a sub-agent with matchConfidence === 'low'. Inspect row-1 and row-4."
    expected: "Red dot (bg-error) at end of row-1; hover title reads 'Match confidence: low'. Row-4 italic 'matched by position -- may be inaccurate' hint still present."
    why_human: "Requires live data with low-confidence match to verify colour and hint coexistence."
  - test: "Open a sub-agent whose parent assistant turn's model is null or not in MODEL_PRICING."
    expected: "No cost label in row-1. Duration and confidence dot still render. No crash or blank screen."
    why_human: "Requires a conversation where the parent model is absent/unknown — needs runtime verification."
  - test: "Open a conversation containing running, unmatched, or missing sub-agent tool calls (IMPR-7 ghost states)."
    expected: "Ghost cards (dashed borders, ghost-state-specific copy) render byte-identical to pre-IMPR-4 state — no cost label, no dot, no new elements."
    why_human: "Requires a live conversation with ghost-state sub-agents to confirm ghost branches are unmodified."
---

# Phase quick-260417-phs: IMPR-4 Inline Cost and Confidence Badges Verification

**Phase Goal:** Collapsed sub-agent card shows `$X.YZ` cost and a confidence dot in the row-1 strip. Format matches `formatCost` helper. Cost is null-safe.
**Verified:** 2026-04-17
**Status:** human_needed — all automated checks pass; 5 visual smoke tests require a running dev build.
**Re-verification:** No — initial verification.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees inline cost (`$X.YZ`) in the collapsed sub-agent card row-1 alongside duration, without expanding the card | VERIFIED | `SubagentSummaryCard.vue:74-76` — `<span v-if="formattedCost" class="text-success/70 whitespace-nowrap">· {{ formattedCost }}</span>` is the first new span inserted after `formattedDuration` in the row-1 flex div (line 60). `formattedCost` computed at lines 331-345 calls `calculateCost` then `formatCost`. |
| 2 | User sees a coloured confidence dot in row-1 for medium (yellow) and low (red); high/null shows no dot | VERIFIED | `confidenceDotClass` computed at lines 371-376: returns `'bg-warning'` for medium, `'bg-error'` for low, `null` otherwise. Template at lines 77-82 renders the dot only `v-if="confidenceDotClass"` with a `title` hover. The `null` return for high/null suppresses rendering entirely. |
| 3 | Ghost states (running/unmatched/missing) show no cost — only existing IMPR-7 ghost copy renders | VERIFIED | `formattedCost` layer 1: `if (!s) return null` (line 333). The cost and dot spans live inside the `v-else` branch (line 53 — `ghostState === 'summary'`). The three ghost templates at lines 4-49 are byte-identical to their pre-IMPR-4 state — no new elements inside those `v-if`/`v-else-if` blocks. |
| 4 | When parentModel is null or not in MODEL_PRICING, cost cell is suppressed — duration and dot remain | VERIFIED | `formattedCost` layer 2: `if (!model) return null` (line 335). Layer 3: `if (!result) return null` (line 343) — `calculateCost` itself returns `null` when the model key is absent from `MODEL_PRICING` after exact + fuzzy-includes lookup (pricing.ts:46-48). The `v-if="formattedCost"` guard on the span means only the cost hides; the `formattedDuration` span and `confidenceDotClass` dot are independently guarded and remain visible. |
| 5 | IMPR-7 three-state ghost render branches and null-safety of SubagentSummaryCard are untouched | VERIFIED | (a) Bare-dereference audit: `grep "summary\.value\.[a-zA-Z]"` → 0 matches. (b) `summary` computed typed as `SubagentSummary \| null` at line 244. (c) All `summary.value` accesses in existing code use `?.` (e.g. lines 275, 280, 300, 317, 365-368). (d) Ghost branches at lines 4-49 contain no references to `formattedCost`, `confidenceDotClass`, or `parentModel`. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/frontend/src/components/SubagentSummaryCard.vue` | `formattedCost` computed, `confidenceDotClass` computed, `parentModel?: string \| null` prop, row-1 template inserts | VERIFIED | All four items present: prop at line 235, `formattedCost` at line 331, `confidenceDotClass` at line 371, template spans at lines 74-82. 8 grep matches for `formattedCost\|confidenceDotClass\|parentModel`. |
| `packages/frontend/src/components/ToolCallRow.vue` | Forward `parentModel` prop to `<SubagentSummaryCard>` | VERIFIED | Prop declared at line 70 (`parentModel?: string \| null`); forwarded at line 3 (`:parentModel="parentModel"`). |
| `packages/frontend/src/components/AssistantGroupCard.vue` | Pass `group.model` as `parentModel` to every `<ToolCallRowComponent>` | VERIFIED | Line 114: `:parentModel="group.model"` inside the `v-for` loop over `turn.toolCalls`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `AssistantGroupCard.vue` | `ToolCallRow.vue` | `:parentModel="group.model"` | WIRED | `AssistantGroupCard.vue:114` confirmed. `group.model` is `AssistantGroup.model: string \| null` — same source already consumed by `modelBadge` at line 169. |
| `ToolCallRow.vue` | `SubagentSummaryCard.vue` | `:parentModel="parentModel"` | WIRED | `ToolCallRow.vue:3` — prop forwarded on the `<SubagentSummaryCard>` render conditional. |
| `SubagentSummaryCard.vue formattedCost` | `types/pricing.ts calculateCost` | null-safe call with `s.inputTokens ?? 0 / s.outputTokens ?? 0` | WIRED | Lines 336-343: `calculateCost(model, s.inputTokens ?? 0, s.outputTokens ?? 0, 0, 0)`. Correct 5-arg signature matches `pricing.ts:39-45`. Cache args 0 as specified. |
| `SubagentSummaryCard.vue row-1 template` | `utils/format-tokens.ts formatCost` | computed `formattedCost` | WIRED | `formatCost` imported at line 225; called at line 344; rendered at line 75. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `SubagentSummaryCard.vue` row-1 cost span | `formattedCost` | `props.toolCall.subagentSummary.inputTokens/outputTokens` + `props.parentModel` → `calculateCost` → `formatCost` | Yes — derives from API-populated token counts and model string; no hardcoded values | FLOWING |
| `SubagentSummaryCard.vue` row-1 dot span | `confidenceDotClass` | `summary.value?.matchConfidence` from `props.toolCall.subagentSummary` | Yes — reads live `matchConfidence` field; returns `null` for absent values | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — these are Vue components requiring a running browser and real Tauri conversation data. CLI verification not applicable.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| IMPR-4 | Inline cost badge (`$X.YZ`) and confidence dot in row-1 of collapsed sub-agent card | SATISFIED | Cost span at `SubagentSummaryCard.vue:74-76`; dot at lines 77-82; null-safe `formattedCost` and `confidenceDotClass` computeds; prop chain threaded from `AssistantGroupCard` through `ToolCallRow`. |

### Anti-Patterns Found

No anti-patterns detected.

- No TODO/FIXME/PLACEHOLDER comments in modified files.
- No stub return patterns (`return null`, `return []`, `return {}`) in production rendering paths.
- No bare `summary.value.xxx` dereferences (0 matches on bare-dereference audit).
- No out-of-scope `summary.subagentModel` references (0 matches confirmed).
- `confidenceHint` row-4 italic is preserved at line 100 (additive, not replaced).

### IMPR-2 SubagentOverviewStrip Regression Check

`SubagentOverviewStrip.vue` consumes `SubagentListEntry` / `SubagentListAggregate` from `useSubagentList.ts`. That composable reads directly from `ToolCallRow` fields (`subagentSummary`, `subagentLinkAttempted`, `subagentConversationId`) — it does not reference any `SubagentSummaryCard` props or computeds. IMPR-4 added no new fields to `ToolCallRow` and did not modify `useSubagentList.ts`. No regression path exists.

### Human Verification Required

#### 1. Cost label renders in row-1 with real data

**Test:** Open any conversation containing a completed Task or Agent sub-agent. Expand the parent assistant group, locate the collapsed sub-agent card. Inspect row-1.
**Expected:** Row-1 reads: `<chevron> <bot-icon> <title> <status-badge> <status-icon> <duration> · $X.YZ [optional dot]`. Cost uses `formatCost` formatting (e.g. `$0.08`, `$0.004`, `< $0.0001`) — not raw numbers.
**Why human:** Requires a running dev build with a real conversation that has `subagentSummary.inputTokens > 0` and a known parent model.

#### 2. Medium confidence shows yellow dot + row-4 hint intact

**Test:** Find a sub-agent card where `matchConfidence === 'medium'`. Inspect row-1 and row-4.
**Expected:** Yellow circle (DaisyUI `bg-warning`, `w-2 h-2 rounded-full`) appears at the end of row-1. Hover over it — tooltip reads "Match confidence: medium". Row-4 italic text "matched by description" is still present beneath the card.
**Why human:** Dot colour and hover title require browser inspection; row-4 coexistence requires visual confirmation.

#### 3. Low confidence shows red dot + row-4 hint intact

**Test:** Find a sub-agent card where `matchConfidence === 'low'`. Inspect row-1 and row-4.
**Expected:** Red circle (`bg-error`) at end of row-1. Hover reads "Match confidence: low". Row-4 italic "matched by position -- may be inaccurate" is present.
**Why human:** Same as above.

#### 4. Unknown/null parentModel suppresses cost only

**Test:** Find (or mock) a sub-agent whose parent assistant turn's model is null or a string not in `MODEL_PRICING` (e.g. `"gpt-4"`). Inspect row-1.
**Expected:** No `· $X.YZ` cost label. Duration still shows. If `matchConfidence` is medium or low, the dot still shows. No JavaScript error in console.
**Why human:** Requires a conversation with an unusual or null model string.

#### 5. Ghost states are unmodified

**Test:** Find a conversation with running, unmatched, or missing sub-agent cards (IMPR-7 ghost states). Inspect each.
**Expected:** Dashed-border ghost cards render exactly as before IMPR-4. No cost label, no dot, no visual change relative to the IMPR-7 baseline.
**Why human:** Requires a live conversation with active sub-agent execution or unmatched link states.

---

### Gaps Summary

No gaps. All 5 must-have truths are verified against the actual code. The 5 human verification items above are confirmatory smoke tests for visual rendering — the code logic is fully implemented and null-safe.

---

_Verified: 2026-04-17T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
