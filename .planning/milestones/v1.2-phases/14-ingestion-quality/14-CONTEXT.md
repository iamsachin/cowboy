# Phase 14: Ingestion Quality - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix title extraction and model attribution during backend ingestion so conversations have accurate, meaningful titles and correct model attribution. Covers Claude Code normalizer and Cursor normalizer. Includes a one-time migration for existing data.

</domain>

<decisions>
## Implementation Decisions

### Title skip patterns
- Skip messages that are system caveats ("Caveat: The messages below..."), interruption notices ("[Request interrupted...]"), slash commands (any `/` prefix), empty/whitespace-only messages, and XML-starting messages (existing behavior)
- Consolidate all skip logic into a unified, ordered check — single function, single loop
- Apply same skip patterns to both Claude Code and Cursor normalizers

### Title fallback behavior
- When all user messages are system/slash content and no real message exists, use the first assistant response's text content (no thinking blocks, no tool_use blocks) truncated to 100 chars as the title
- Apply this assistant-snippet fallback to both Claude Code and Cursor normalizers
- If no assistant text content either, return NULL

### Model fallback chain
- Conversation-level model only (per-message model stays as-is)
- Claude Code fallback: assistant messages → token_usage records (most common model) → NULL
- Cursor "default" handling: check individual bubble modelInfo for actual model names first. If all say "default" or no modelInfo exists, store "unknown". Never store the literal string "default"
- Final fallback for Claude Code: NULL (don't fabricate data)
- Final fallback for Cursor "default": "unknown"

### Existing data migration
- One-time migration that runs automatically on server startup
- Detect if migration is needed (e.g., version flag or check for NULL/bad titles)
- Recompute titles only for conversations with NULL titles or titles matching known bad patterns (starts with "Caveat:", "[Request interrupted", etc.)
- Fix both Claude Code NULL models (derive from token_usage) and Cursor "default" model values
- Preserves any already-correct titles and models

### Claude's Discretion
- Detection approach for system caveats (prefix matching vs regex vs hybrid)
- Migration detection mechanism (version flag, content check, etc.)
- Exact ordering of skip pattern checks
- Transaction/batch strategy for migration
- Whether to share skip pattern logic between Claude Code and Cursor normalizers via a shared utility or duplicate

</decisions>

<specifics>
## Specific Ideas

- The skip logic should be extensible — easy to add new patterns as they're discovered
- Migration should be idempotent — safe to run multiple times
- For Cursor "default" model resolution: the existing `deriveModel` function already checks `modelConfig.modelName` first, then bubble `modelInfo` — just need to add "default" detection before returning

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `normalizer.ts:deriveTitle()` (line 189): Current title extraction with XML skip — needs expansion, not rewrite
- `normalizer.ts:deriveMostCommonModel()` (line 215): Model derivation from assistant messages — needs token_usage fallback
- `cursor-normalizer.ts:deriveTitle()` (line 153): Cursor title extraction — same pattern, same fixes needed
- `cursor-normalizer.ts:deriveModel()` (line 175): Cursor model derivation — needs "default" handling
- `normalizer.ts:extractAssistantContent()` (line 248): Already separates text from thinking blocks — reusable for assistant-snippet title fallback

### Established Patterns
- Both normalizers follow identical structure: derive title → derive timestamps → derive model → build records
- Deterministic ID generation via `id-generator.ts` — migration can look up existing records reliably
- Drizzle ORM for all DB operations — migration should use Drizzle, not raw SQL
- Per-file transactions during ingestion — migration should batch updates similarly

### Integration Points
- `normalizer.ts` and `cursor-normalizer.ts` are the two files that need title/model fixes
- `ingestion/index.ts` orchestrates the ingestion pipeline — migration could hook in here or run separately
- `app.ts` registers plugins — migration could be a startup plugin
- Token usage data is already in the `token_usage` table with model field — queryable for model derivation fallback

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-ingestion-quality*
*Context gathered: 2026-03-05*
