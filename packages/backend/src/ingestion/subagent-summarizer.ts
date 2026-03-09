import type { ParseResult } from './claude-code-parser.js';
import type { SubagentSummary } from '@cowboy/shared';

// File path keys commonly found in tool_use input
const FILE_PATH_KEYS = ['file_path', 'path', 'filePath'];

/**
 * Parse a subagent's ParseResult to extract summary statistics.
 * The matchConfidence field must be set by the caller after matching.
 */
export function summarizeSubagent(parseResult: ParseResult): Omit<SubagentSummary, 'matchConfidence'> {
  // ── Tool breakdown ────────────────────────────────────────────────────
  const toolBreakdown: Record<string, number> = {};
  const filesTouched = new Set<string>();
  let totalToolCalls = 0;

  for (const assistant of parseResult.assistantMessages) {
    for (const toolUse of assistant.toolUseBlocks) {
      totalToolCalls++;
      toolBreakdown[toolUse.name] = (toolBreakdown[toolUse.name] ?? 0) + 1;

      // Extract file paths from input
      const input = toolUse.input as Record<string, unknown> | null;
      if (input) {
        for (const key of FILE_PATH_KEYS) {
          const val = input[key];
          if (typeof val === 'string' && val.length > 0) {
            filesTouched.add(val);
          }
        }
      }
    }
  }

  // ── Status ────────────────────────────────────────────────────────────
  // Collect all tool results across all user messages
  const allToolResults = parseResult.userMessages.flatMap(u => u.toolResults);
  const hasError = allToolResults.some(tr => tr.isError);
  const lastAssistant = parseResult.assistantMessages[parseResult.assistantMessages.length - 1];

  let status: 'success' | 'error' | 'interrupted';
  if (parseResult.assistantMessages.length === 0) {
    status = 'interrupted';
  } else if (hasError && allToolResults[allToolResults.length - 1]?.isError) {
    status = 'error';
  } else if (lastAssistant && lastAssistant.stopReason !== 'end_turn') {
    status = 'interrupted';
  } else {
    status = 'success';
  }

  // ── Duration ──────────────────────────────────────────────────────────
  const sortedTimestamps = [...parseResult.timestamps].sort();
  const firstTs = sortedTimestamps[0];
  const lastTs = sortedTimestamps[sortedTimestamps.length - 1];
  const durationMs = firstTs && lastTs
    ? new Date(lastTs).getTime() - new Date(firstTs).getTime()
    : 0;

  // ── Tokens ────────────────────────────────────────────────────────────
  let inputTokens = 0;
  let outputTokens = 0;
  for (const assistant of parseResult.assistantMessages) {
    if (assistant.usage) {
      inputTokens += assistant.usage.input_tokens;
      outputTokens += assistant.usage.output_tokens;
    }
  }

  // ── Last error ────────────────────────────────────────────────────────
  const errorResults = allToolResults.filter(tr => tr.isError);
  const lastError = errorResults.length > 0
    ? errorResults[errorResults.length - 1].content
    : null;

  return {
    toolBreakdown,
    filesTouched: Array.from(filesTouched),
    totalToolCalls,
    status,
    durationMs,
    inputTokens,
    outputTokens,
    lastError,
  };
}
