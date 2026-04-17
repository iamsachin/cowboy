import type { SubagentSummary } from '../types';

export type GhostCardState = 'running' | 'unmatched' | 'missing' | 'summary';

export interface GhostCardFlags {
  subagentSummary: SubagentSummary | null | undefined;
  subagentLinkAttempted: boolean;
  subagentConversationId: string | null | undefined;
  isActive: boolean;
}

/**
 * Classify the render state of a sub-agent ghost/summary card.
 *
 * Precedence (high -> low):
 *   1. subagentSummary present         -> 'summary'  (rich three-tier card)
 *   2. subagentConversationId present  -> 'missing'  (link written but child JSONL gone)
 *   3. subagentLinkAttempted true      -> 'unmatched' (linker ran, no match found)
 *   4. otherwise                       -> 'running'  (linker has not yet visited)
 *
 * The `isActive` field is NOT used for classification -- it is consumed by the
 * template to decide whether to pulse the 'running' icon. Running state with
 * isActive=false is valid legacy behavior for pre-migration rows; the UI stays
 * static instead of misleadingly pulsing.
 */
export function classifyGhostState(flags: GhostCardFlags): GhostCardState {
  if (flags.subagentSummary) return 'summary';
  if (flags.subagentConversationId) return 'missing';
  if (flags.subagentLinkAttempted) return 'unmatched';
  return 'running';
}
