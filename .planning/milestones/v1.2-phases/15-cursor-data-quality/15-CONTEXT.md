# Phase 15: Cursor Data Quality - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix three Cursor-specific data quality issues: assistant messages showing "Empty response" instead of actual content, missing Cursor option in the conversation filter dropdown, and the hardcoded "Cursor" project name instead of the actual workspace path. Includes migration for existing data.

</domain>

<decisions>
## Implementation Decisions

### Empty response fix (CURSOR-01)
- Investigate actual Cursor state.vscdb to discover where assistant content lives — `data.text` may not be the only content field (check `richText`, `rawText`, `codeBlocks`, etc.)
- Only skip assistant bubbles if they have no text AND no other content fields — don't discard bubbles that have text just because they're capability iterations
- When an assistant bubble genuinely has no text content (pure tool execution), show a tool activity summary like "Executed 3 tool calls" or the capability type instead of "Empty response"
- Skip thinking/reasoning extraction for now — focus on getting basic text content right first

### Agent filter dropdown (CURSOR-02)
- Use the existing `AGENTS` constant from `agent-constants.ts` (`['claude-code', 'cursor']`) with display names already defined
- Claude checks which pages are missing Cursor in their agent filter and fixes where needed (at minimum ConversationBrowser, but audit other pages too)

### Project path display (CURSOR-03)
- Extract workspace path from Cursor DB data (composerData may have workspace context)
- Display format: last directory segment (e.g., `/Users/sachin/Desktop/myapp` → `myapp`) — matches existing `deriveProjectName` pattern for Claude Code
- Fallback: 'Cursor' literal if workspace path can't be determined — better than NULL, at least tells you the agent

### Existing data migration
- Extend the existing `migration.ts` from Phase 14 with new Cursor-specific fixes
- Migration re-reads Cursor state.vscdb readonly to derive workspace paths for conversations currently stored with project='Cursor'
- Reuse the same idempotent startup migration pattern (runs alongside title/model fixes)
- Claude decides feasibility of retroactively fixing message content (re-extracting from Cursor DB bubbles)

### Claude's Discretion
- Which content fields to extract from Cursor bubbles (depends on what's found in actual data)
- Whether to extract thinking/reasoning content if discovered in Cursor data
- Exact pages that need the agent filter fix beyond ConversationBrowser
- Whether retroactive message content fix is feasible in the migration
- Tool activity summary format for genuinely empty assistant bubbles
- How to extract workspace path from Cursor DB structure

</decisions>

<specifics>
## Specific Ideas

- The Cursor DB file path itself (state.vscdb location) may encode workspace info — Cursor stores per-workspace databases in `~/.cursor/User/workspaceStorage/{hash}/state.vscdb`
- The `fullConversationHeadersOnly` field in composerData might contain workspace context
- `agent-constants.ts` already has `AGENT_DISPLAY_NAMES` mapping — frontend changes should be minimal
- The "Empty response" string comes from `getPreviewSnippet()` in `turn-helpers.ts` when content is null — fixing the normalizer to populate content will fix the display automatically

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cursor-parser.ts:parseCursorDb()`: Reads composerData from state.vscdb — extend to extract workspace path fields
- `cursor-parser.ts:getBubblesForConversation()`: Reads bubble data — may need to extract additional content fields
- `cursor-normalizer.ts:normalizeCursorConversation()`: Takes `project` as a parameter (line 15) — just need to pass the right value
- `migration.ts:runDataQualityMigration()`: Phase 14 migration module — extend with Cursor-specific fixes
- `agent-constants.ts`: `AGENTS` array and `AGENT_DISPLAY_NAMES` map already define Cursor
- `title-utils.ts:shouldSkipForTitle()`: Shared skip logic already used by Cursor normalizer

### Established Patterns
- `deriveProjectName()` in `file-discovery.ts`: Extracts last directory segment from path — reuse for Cursor workspace path
- Idempotent migration pattern from Phase 14: check condition → fix → skip if already fixed
- `onConflictDoNothing` for all DB inserts — safe for re-ingestion

### Integration Points
- `index.ts:188`: Hardcoded `'Cursor'` project → replace with derived workspace path
- `ConversationBrowser.vue:10-12`: Agent dropdown hardcodes only Claude Code → iterate AGENTS constant
- `cursor-normalizer.ts:54-58`: Skip logic for empty assistant bubbles → refine conditions
- `turn-helpers.ts:getPreviewSnippet()`: Returns "Empty response" for null content → upstream fix in normalizer should resolve this

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-cursor-data-quality*
*Context gathered: 2026-03-05*
