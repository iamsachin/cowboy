import { stripXmlTags } from './content-sanitizer';
import type { AssistantTurn, Turn } from '../composables/useGroupedTurns';

/**
 * Extract a short preview snippet from an assistant turn for collapsed header display.
 *
 * Priority: first line of stripped text content -> tool call summary -> "Empty response"
 */
export function getPreviewSnippet(turn: AssistantTurn): string {
  const raw = turn.message.content;

  if (raw) {
    const cleaned = stripXmlTags(raw);
    if (cleaned) {
      const firstLine = cleaned.split('\n')[0];
      if (firstLine.length > 80) {
        return firstLine.slice(0, 80) + '...';
      }
      return firstLine;
    }
  }

  // Fallback to tool call summary
  if (turn.toolCalls.length > 0) {
    const names = [...new Set(turn.toolCalls.map(tc => tc.name))];
    const count = turn.toolCalls.length;
    return `Used ${names.join(', ')} (${count} tool call${count === 1 ? '' : 's'})`;
  }

  return 'Empty response';
}

/**
 * Calculate the duration of an assistant turn.
 *
 * If tool calls exist: (last TC createdAt + TC duration) - assistant createdAt
 * If no tool calls but next turn exists: nextTurn createdAt - assistant createdAt
 * Otherwise: null
 */
export function calculateDuration(turn: AssistantTurn, nextTurn?: Turn): string | null {
  const startMs = new Date(turn.message.createdAt).getTime();

  if (turn.toolCalls.length > 0) {
    // Find last tool call by createdAt
    let lastTc = turn.toolCalls[0];
    for (let i = 1; i < turn.toolCalls.length; i++) {
      if (new Date(turn.toolCalls[i].createdAt).getTime() > new Date(lastTc.createdAt).getTime()) {
        lastTc = turn.toolCalls[i];
      }
    }
    const endMs = new Date(lastTc.createdAt).getTime() + (lastTc.duration ?? 0);
    const ms = endMs - startMs;
    if (ms < 0) return '--';
    return formatMs(ms);
  }

  if (nextTurn) {
    const endMs = new Date(nextTurn.message.createdAt).getTime();
    const ms = endMs - startMs;
    if (ms < 0) return '--';
    return formatMs(ms);
  }

  return null;
}

/**
 * Format milliseconds to a human-readable duration string.
 *
 * <1000 -> "Xms", 1000-59999 -> "Xs", 60000+ -> "Xm Ys"
 */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Truncate output text beyond a maximum number of lines.
 *
 * Non-string values are JSON.stringified with 2-space indentation.
 * Null/undefined returns empty string with truncated=false.
 */
export function truncateOutput(
  value: unknown,
  maxLines: number = 20,
): { text: string; truncated: boolean } {
  if (value === null || value === undefined) {
    return { text: '', truncated: false };
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const lines = text.split('\n');

  if (lines.length <= maxLines) {
    return { text, truncated: false };
  }

  return { text: lines.slice(0, maxLines).join('\n'), truncated: true };
}
