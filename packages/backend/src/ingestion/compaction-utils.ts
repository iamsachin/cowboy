import type { AssistantMessageData } from './claude-code-parser.js';

// ── Preamble stripping ───────────────────────────────────────────────

/**
 * Remove the boilerplate preamble from compaction summaries.
 * Falls back to returning full text if preamble pattern is not found.
 */
const COMPACTION_PREAMBLE = /^This session is being continued from a previous conversation.*?\n\n/s;

export function stripCompactionPreamble(summary: string): string {
  return summary.replace(COMPACTION_PREAMBLE, '').trim();
}

// ── Token delta computation ──────────────────────────────────────────

/**
 * Compute input token counts before and after a compaction boundary.
 * Uses input_tokens + cache_read_input_tokens + cache_creation_input_tokens
 * from the last assistant message before and first assistant message after.
 */
export function computeTokenDelta(
  compactionTimestamp: string,
  assistantMessages: AssistantMessageData[],
): { before: number | null; after: number | null } {
  const sorted = [...assistantMessages]
    .filter(m => m.usage)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const lastBefore = sorted
    .filter(m => m.timestamp < compactionTimestamp)
    .pop();

  const firstAfter = sorted
    .find(m => m.timestamp > compactionTimestamp);

  const sumTokens = (u: NonNullable<AssistantMessageData['usage']>) =>
    u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);

  return {
    before: lastBefore?.usage ? sumTokens(lastBefore.usage) : null,
    after: firstAfter?.usage ? sumTokens(firstAfter.usage) : null,
  };
}
