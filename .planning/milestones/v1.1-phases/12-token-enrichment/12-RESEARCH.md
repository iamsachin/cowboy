# Phase 12: Token Enrichment - Research

**Researched:** 2026-03-05
**Domain:** Backend token data enrichment + frontend per-turn cost display
**Confidence:** HIGH

## Summary

Phase 12 requires surfacing per-message token usage data in the conversation detail API and displaying it in the TurnCard/AssistantGroupCard summary headers. The good news: all the infrastructure already exists. The `tokenUsage` table already stores `messageId` as a foreign key to `messages`, and the normalizer already populates it for Claude Code conversations. The shared `calculateCost()` function already handles model-specific pricing with cache-aware calculations.

The work is a straightforward three-layer change: (1) modify the backend `getConversationDetail` query to return per-message token data alongside messages, (2) extend the shared types to carry token data through the API, and (3) update TurnCard and AssistantGroupCard to display token counts and cost in their summary headers.

**Primary recommendation:** Add a `tokenUsageByMessageId` map to the `ConversationDetailResponse`, keyed by messageId, so the frontend can look up token data per turn without any additional API calls. Calculate cost server-side using the existing `calculateCost()` function.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| META-01 | User sees per-turn input/output/cache token counts in response block summary header | tokenUsage table has messageId FK, backend query can group by messageId, frontend TurnCard header has space for additional metadata |
| META-02 | User sees estimated cost per assistant turn in the summary header | Shared `calculateCost()` function exists, tokenUsage table stores model per record, cost calculation can happen server-side |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | (existing) | SQLite query for per-message token aggregation | Already used throughout backend |
| @cowboy/shared | (existing) | `calculateCost()`, `ModelPricing`, shared types | Single source of truth for pricing |
| Vue 3 | (existing) | Reactive display in TurnCard/AssistantGroupCard | Already the frontend framework |
| Intl.NumberFormat | Built-in | Token count formatting (e.g., "12,345") | Already used in ConversationDetailPage.vue |

### Supporting
No additional libraries needed. This phase uses only existing dependencies.

## Architecture Patterns

### Data Flow (End-to-End)

```
tokenUsage table (messageId FK)
    |
    v
getConversationDetail() -- new query: GROUP BY messageId
    |
    v
ConversationDetailResponse.tokenUsageByMessage: Record<messageId, TokenUsageSummary>
    |
    v
ConversationDetailPage.vue passes to ConversationDetail.vue
    |
    v
ConversationDetail.vue passes per-turn data to TurnCard/AssistantGroupCard
    |
    v
TurnCard header shows: "1.2k in / 850 out / $0.04"
```

### Pattern 1: Server-Side Token Aggregation
**What:** Query tokenUsage grouped by messageId within `getConversationDetail()`, calculate cost server-side, return as a flat map alongside existing response fields.
**When to use:** Always -- the backend already has the pricing function and model info.
**Why not client-side:** The `calculateCost()` function lives in `@cowboy/shared` and could technically run client-side, but the backend already uses it for conversation-level cost. Keeping cost calculation server-side maintains consistency and avoids shipping the pricing table to the client.

```typescript
// New type in packages/shared/src/types/api.ts
export interface MessageTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cost: number | null;
}

// Add to ConversationDetailResponse
export interface ConversationDetailResponse {
  // ... existing fields ...
  tokenUsageByMessage: Record<string, MessageTokenUsage>;
}
```

### Pattern 2: Props Drilling Through Component Hierarchy
**What:** Pass the `tokenUsageByMessage` map from ConversationDetailPage -> ConversationDetail -> AssistantGroupCard/TurnCard. Each card looks up its message's tokens from the map.
**When to use:** This matches the existing pattern where ConversationDetail receives `messages` and `toolCalls` as props and passes them down.

```typescript
// In TurnCard.vue -- lookup pattern
const tokenUsage = computed(() => {
  return props.tokenUsage ?? null; // MessageTokenUsage | null
});
```

### Pattern 3: Compact Token Display Formatting
**What:** Format large token counts compactly (e.g., "12.3k" instead of "12,345") to fit in the already-tight summary header line.
**When to use:** Token counts regularly exceed 10,000 for Claude Code conversations.

```typescript
// Utility function for compact formatting
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}
```

### Anti-Patterns to Avoid
- **Dividing conversation totals by message count:** The success criteria explicitly forbids this. Token counts MUST come from actual per-message data.
- **Adding a new API endpoint:** No need. The existing `GET /api/analytics/conversations/:id` should be enriched with per-message data.
- **Storing cost in the database:** Cost is derived from tokens + pricing table. The pricing table may change; cost should always be calculated on the fly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cost calculation | Custom pricing logic | `calculateCost()` from `@cowboy/shared` | Already handles 20+ models, fuzzy matching, cache-aware pricing |
| Number formatting | Custom formatters | `Intl.NumberFormat` (already in use) | Locale-aware, already used in ConversationDetailPage |
| Token aggregation | Client-side summing from raw data | Drizzle `sum()` GROUP BY messageId | Database is the right layer for aggregation |

## Common Pitfalls

### Pitfall 1: tokenUsage.messageId May Be Null
**What goes wrong:** The schema defines `messageId` as nullable: `messageId: text('message_id').references(() => messages.id)`. Some records (especially older or Cursor-sourced) may lack messageId.
**Why it happens:** Cursor normalizer or older data may not always have per-message token attribution.
**How to avoid:** The query should filter to `WHERE message_id IS NOT NULL` when building the per-message map. Records without messageId are already accounted for in the conversation-level `tokenSummary`.
**Warning signs:** Token counts showing as 0 for all turns despite conversation-level totals being non-zero.

### Pitfall 2: Multiple tokenUsage Rows Per messageId
**What goes wrong:** A single assistant message could theoretically have multiple tokenUsage records (e.g., if re-processed or from multiple model calls within one message).
**Why it happens:** The normalizer creates one tokenUsage per assistant message with `usage` data, but edge cases exist.
**How to avoid:** Use `SUM()` aggregation in the query, not `LIMIT 1`.

### Pitfall 3: Seed Data Missing messageId
**What goes wrong:** The existing test fixture (`seed-analytics.ts`) inserts tokenUsage records WITHOUT `messageId` field. Tests will show no per-message data.
**Why it happens:** The seed was written for conversation-level analytics, not per-message.
**How to avoid:** Update the seed fixture to include `messageId` values that reference the seeded messages (e.g., `tu-1` -> `msg-1b`, `tu-2` -> `msg-2b`, etc.).

### Pitfall 4: AssistantGroup Aggregation
**What goes wrong:** AssistantGroupCard groups multiple assistant turns. It needs aggregate token totals across all turns in the group, not just the first turn's tokens.
**Why it happens:** A group has multiple `turns`, each with its own messageId.
**How to avoid:** Sum token data across all turns in the group for the group-level header display. Each individual turn within the group can also show its own tokens when expanded.

### Pitfall 5: Cost Display Precision
**What goes wrong:** Showing too many decimal places (e.g., "$0.00142857") or rounding to "$0.00" for small turns.
**Why it happens:** Per-turn costs are often fractions of a cent.
**How to avoid:** Use conditional formatting: if cost >= $0.01 show 2 decimals ("$0.04"), if cost >= $0.001 show 3 decimals ("$0.004"), if cost < $0.001 show "< $0.001".

## Code Examples

### Backend: Per-Message Token Query (Drizzle)
```typescript
// In getConversationDetail(), add after existing tokenRows query:
const perMessageTokens = db
  .select({
    messageId: tokenUsage.messageId,
    model: tokenUsage.model,
    inputTokens: sql<number>`sum(${tokenUsage.inputTokens})`,
    outputTokens: sql<number>`sum(${tokenUsage.outputTokens})`,
    cacheReadTokens: sql<number>`sum(${tokenUsage.cacheReadTokens})`,
    cacheCreationTokens: sql<number>`sum(${tokenUsage.cacheCreationTokens})`,
  })
  .from(tokenUsage)
  .where(and(
    eq(tokenUsage.conversationId, conversationId),
    sql`${tokenUsage.messageId} IS NOT NULL`
  ))
  .groupBy(tokenUsage.messageId)
  .all();

// Build map with cost calculation
const tokenUsageByMessage: Record<string, MessageTokenUsage> = {};
for (const row of perMessageTokens) {
  const input = Number(row.inputTokens);
  const output = Number(row.outputTokens);
  const cacheRead = Number(row.cacheReadTokens);
  const cacheCreation = Number(row.cacheCreationTokens);
  const costResult = calculateCost(row.model, input, output, cacheRead, cacheCreation);

  tokenUsageByMessage[row.messageId!] = {
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheCreationTokens: cacheCreation,
    cost: costResult?.cost ?? null,
  };
}
```

### Frontend: TurnCard Header with Tokens
```vue
<!-- In TurnCard.vue summary header, after duration -->
<span v-if="tokenUsage" class="text-base-content/50">
  {{ formatTokenCount(tokenUsage.inputTokens) }} in /
  {{ formatTokenCount(tokenUsage.outputTokens) }} out
</span>
<span v-if="tokenUsage?.cost != null" class="text-base-content/50">
  {{ formatCost(tokenUsage.cost) }}
</span>
```

### Frontend: AssistantGroupCard Aggregated Tokens
```typescript
// In AssistantGroupCard.vue
const groupTokens = computed(() => {
  if (!props.tokenUsageByMessage) return null;
  let input = 0, output = 0, cacheRead = 0, cacheCreation = 0, cost = 0;
  let hasCost = false;
  for (const turn of props.group.turns) {
    const tu = props.tokenUsageByMessage[turn.message.id];
    if (tu) {
      input += tu.inputTokens;
      output += tu.outputTokens;
      cacheRead += tu.cacheReadTokens;
      cacheCreation += tu.cacheCreationTokens;
      if (tu.cost != null) { cost += tu.cost; hasCost = true; }
    }
  }
  if (input === 0 && output === 0) return null;
  return { inputTokens: input, outputTokens: output, cacheReadTokens: cacheRead, cacheCreationTokens: cacheCreation, cost: hasCost ? cost : null };
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Conversation-level token totals only | Per-message token data via messageId FK | Phase 12 (now) | Enables per-turn cost visibility |

**Already in place:**
- tokenUsage table with messageId FK (since Phase 1 schema)
- normalizer populates messageId for Claude Code (since Phase 2)
- calculateCost() with 20+ models (since Phase 3, updated Phase 6)
- TurnCard/AssistantGroupCard summary headers (since Phase 11)

## Open Questions

1. **Cursor tokenUsage messageId population**
   - What we know: Claude Code normalizer sets `messageId` on tokenUsage records. Cursor normalizer needs verification.
   - What's unclear: Whether Cursor-sourced tokenUsage has messageId populated.
   - Recommendation: Check cursor-normalizer.ts. If messageId is null for Cursor data, the frontend should gracefully show "N/A" for token data on those turns. This is acceptable -- the conversation-level summary still shows totals.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | packages/backend/vitest.config.ts (or inline) |
| Quick run command | `cd packages/backend && pnpm test -- --reporter=verbose tests/analytics/conversation-detail.test.ts` |
| Full suite command | `cd packages/backend && pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| META-01 | Per-message token counts returned in API response | integration | `cd packages/backend && pnpm test -- tests/analytics/conversation-detail.test.ts` | Exists (needs new test cases) |
| META-01 | Token counts display in TurnCard header | manual | Visual verification | N/A |
| META-02 | Per-turn cost calculated from token counts + model pricing | unit | `cd packages/backend && pnpm test -- tests/analytics/pricing.test.ts` | Exists (calculateCost already tested) |
| META-02 | Cost displays in summary header | manual | Visual verification | N/A |

### Sampling Rate
- **Per task commit:** `cd packages/backend && pnpm test -- tests/analytics/conversation-detail.test.ts`
- **Per wave merge:** `cd packages/backend && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Update `tests/fixtures/seed-analytics.ts` -- add `messageId` to tokenUsage seed records
- [ ] Add new test cases in `tests/analytics/conversation-detail.test.ts` -- verify `tokenUsageByMessage` field in API response

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Direct reading of schema.ts, normalizer.ts, analytics.ts, TurnCard.vue, AssistantGroupCard.vue, ConversationDetail.vue, ConversationDetailPage.vue, seed-analytics.ts, conversation-detail.test.ts
- **packages/shared/src/types/pricing.ts** -- calculateCost() function, ModelPricing type, MODEL_PRICING table
- **packages/shared/src/types/api.ts** -- ConversationDetailResponse, MessageRow, ToolCallRow types
- **packages/backend/src/db/schema.ts** -- tokenUsage table with messageId FK (nullable)

### Secondary (MEDIUM confidence)
- None needed -- all findings are from direct codebase analysis

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- extending existing patterns (props drilling, Drizzle queries, shared types)
- Pitfalls: HIGH -- identified from direct schema/normalizer/seed analysis

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- internal project, no external dependency changes)
