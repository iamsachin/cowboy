import type { DiscoveredFile } from './types.js';

// ── agentId extraction ──────────────────────────────────────────────────

const AGENT_ID_REGEX = /agentId:\s*([a-f0-9]+)/;

/**
 * Extract the agentId from a tool_result output string.
 * Returns null if not found or input is not a string.
 */
export function extractAgentId(output: unknown): string | null {
  if (typeof output !== 'string') return null;
  const match = output.match(AGENT_ID_REGEX);
  return match ? match[1] : null;
}

// ── Types ────────────────────────────────────────────────────────────────

interface ToolCallInfo {
  id: string;
  name: string;
  input: unknown;
  output: unknown;
  createdAt: string;
}

export interface SubagentLink {
  toolCallId: string;
  subagentConversationId: string;
  parentConversationId: string;
  matchConfidence: 'high' | 'medium' | 'low';
}

export interface LinkSubagentsParams {
  parentFiles: DiscoveredFile[];
  subagentFiles: DiscoveredFile[];
  getToolCalls: (conversationId: string) => ToolCallInfo[];
  getConversationId: (sessionId: string) => string | null;
  getFirstUserMessage?: (conversationId: string) => string | null;
}

// ── Tool call name filter ────────────────────────────────────────────────

const SUBAGENT_TOOL_NAMES = new Set(['Task', 'Agent']);

// ── Main linking algorithm ──────────────────────────────────────────────

/**
 * Three-phase matching algorithm to link subagent files to parent tool calls.
 *
 * Phase 1 (agentId - HIGH): Extract agentId from tool_result output, match to subagent sessionId.
 * Phase 2 (description - MEDIUM): Compare tool call input.description to subagent first user message.
 * Phase 3 (positional - LOW): Match by timestamp order as last resort.
 */
export async function linkSubagents(params: LinkSubagentsParams): Promise<SubagentLink[]> {
  const { parentFiles, subagentFiles, getToolCalls, getConversationId, getFirstUserMessage } = params;
  const results: SubagentLink[] = [];

  // Filter out acompact- prefixed subagent files (background compaction agents)
  const validSubagentFiles = subagentFiles.filter(f => !f.sessionId.startsWith('acompact'));

  // Build a sessionId -> subagent file lookup
  const subagentBySessionId = new Map<string, DiscoveredFile>();
  for (const sf of validSubagentFiles) {
    subagentBySessionId.set(sf.sessionId, sf);
  }

  // Track which subagent files have been matched
  const matchedSubagentSessionIds = new Set<string>();
  // Track which tool calls have been matched
  const matchedToolCallIds = new Set<string>();

  // For each parent file, get tool calls and attempt matching
  for (const parentFile of parentFiles) {
    const parentConvId = getConversationId(parentFile.sessionId);
    if (!parentConvId) continue;

    const toolCallsList = getToolCalls(parentConvId);
    const agentToolCalls = toolCallsList.filter(tc => SUBAGENT_TOOL_NAMES.has(tc.name));

    // ── Phase 1: agentId matching (HIGH confidence) ──────────────────

    for (const tc of agentToolCalls) {
      if (matchedToolCallIds.has(tc.id)) continue;

      const agentId = extractAgentId(tc.output);
      if (!agentId) continue;

      const subagentFile = subagentBySessionId.get(agentId);
      if (!subagentFile || matchedSubagentSessionIds.has(agentId)) continue;

      const subagentConvId = getConversationId(agentId);
      if (!subagentConvId) continue;

      results.push({
        toolCallId: tc.id,
        subagentConversationId: subagentConvId,
        parentConversationId: parentConvId,
        matchConfidence: 'high',
      });

      matchedToolCallIds.add(tc.id);
      matchedSubagentSessionIds.add(agentId);
    }

    // ── Phase 2: description matching (MEDIUM confidence) ────────────

    if (getFirstUserMessage) {
      const unmatchedToolCalls = agentToolCalls.filter(tc => !matchedToolCallIds.has(tc.id));
      const unmatchedSubagents = validSubagentFiles.filter(sf => !matchedSubagentSessionIds.has(sf.sessionId));

      for (const tc of unmatchedToolCalls) {
        const input = tc.input as Record<string, unknown> | null;
        const description = (input?.description as string) ?? (input?.prompt as string) ?? '';
        if (!description) continue;

        // Compare description first line to subagent first user message
        const descFirstLine = description.split('\n')[0].trim();
        if (!descFirstLine) continue;

        for (const sf of unmatchedSubagents) {
          if (matchedSubagentSessionIds.has(sf.sessionId)) continue;

          const subagentConvId = getConversationId(sf.sessionId);
          if (!subagentConvId) continue;

          const firstMsg = getFirstUserMessage(subagentConvId);
          if (!firstMsg) continue;

          const firstMsgFirstLine = firstMsg.split('\n')[0].trim();

          // Check if description matches the first line of the subagent's first user message
          if (descFirstLine === firstMsgFirstLine || firstMsgFirstLine.startsWith(descFirstLine)) {
            results.push({
              toolCallId: tc.id,
              subagentConversationId: subagentConvId,
              parentConversationId: parentConvId,
              matchConfidence: 'medium',
            });

            matchedToolCallIds.add(tc.id);
            matchedSubagentSessionIds.add(sf.sessionId);
            break;
          }
        }
      }
    }

    // ── Phase 3: positional matching (LOW confidence) ────────────────

    const remainingToolCalls = agentToolCalls
      .filter(tc => !matchedToolCallIds.has(tc.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const remainingSubagents = validSubagentFiles
      .filter(sf => !matchedSubagentSessionIds.has(sf.sessionId));

    const matchCount = Math.min(remainingToolCalls.length, remainingSubagents.length);
    for (let i = 0; i < matchCount; i++) {
      const tc = remainingToolCalls[i];
      const sf = remainingSubagents[i];

      const subagentConvId = getConversationId(sf.sessionId);
      if (!subagentConvId) continue;

      results.push({
        toolCallId: tc.id,
        subagentConversationId: subagentConvId,
        parentConversationId: parentConvId,
        matchConfidence: 'low',
      });

      matchedToolCallIds.add(tc.id);
      matchedSubagentSessionIds.add(sf.sessionId);
    }
  }

  return results;
}
