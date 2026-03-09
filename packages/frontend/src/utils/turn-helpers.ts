import { stripXmlTags } from './content-sanitizer';
import type { AssistantTurn, AssistantGroup, Turn } from '../composables/useGroupedTurns';

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

/**
 * Get the last text content from an assistant group, walking turns in reverse.
 * Returns stripped content or null if no turn has text.
 */
export function getLastTextContent(group: AssistantGroup): string | null {
  for (let i = group.turns.length - 1; i >= 0; i--) {
    const turn = group.turns[i];
    if (turn.message.content) {
      const cleaned = stripXmlTags(turn.message.content);
      if (cleaned) return cleaned;
    }
  }
  return null;
}

const TOOL_VERBS: Record<string, string> = {
  Read: 'Read',
  Edit: 'Edited',
  Write: 'Wrote',
  Bash: 'Ran',
  Grep: 'Searched',
  Glob: 'Scanned',
  Agent: 'Spawned',
  WebSearch: 'Searched web',
};

/**
 * Generate a human-readable tool summary for a group.
 * e.g. "Read 3 files, Edited 2 files"
 */
export function getToolSummary(group: AssistantGroup): string {
  const allToolCalls = group.turns.flatMap(t => t.toolCalls);
  if (allToolCalls.length === 0) return 'Assistant response';

  const counts = new Map<string, number>();
  for (const tc of allToolCalls) {
    counts.set(tc.name, (counts.get(tc.name) || 0) + 1);
  }

  const parts: string[] = [];
  for (const [name, count] of counts) {
    const verb = TOOL_VERBS[name] || name;
    if (['Read', 'Edit', 'Write'].includes(name)) {
      parts.push(`${verb} ${count} file${count > 1 ? 's' : ''}`);
    } else if (name === 'Bash') {
      parts.push(`${verb} ${count} command${count > 1 ? 's' : ''}`);
    } else {
      parts.push(`${verb} (${count})`);
    }
  }
  return parts.join(', ');
}

/**
 * Extract unique file basenames from tool call inputs in a group.
 * Only processes Read, Edit, Write, Glob, Grep tools.
 */
export function extractFilenames(group: AssistantGroup): string[] {
  const files = new Set<string>();
  for (const turn of group.turns) {
    for (const tc of turn.toolCalls) {
      if (!['Read', 'Edit', 'Write', 'Glob', 'Grep'].includes(tc.name)) continue;
      const input = tc.input as Record<string, unknown> | null;
      if (!input) continue;
      const filePath = (input.file_path || input.path) as string | undefined;
      if (filePath) {
        const basename = filePath.split('/').pop() || filePath;
        files.add(basename);
      }
    }
  }
  return [...files];
}

/**
 * Truncate text at a word boundary near the given limit.
 * Searches backwards up to 50 chars for whitespace; hard cuts if none found.
 */
export function truncateAtWordBoundary(text: string, limit: number): string {
  if (text.length <= limit) return text;
  let cutoff = limit;
  while (cutoff > limit - 50 && cutoff > 0 && !/\s/.test(text[cutoff])) {
    cutoff--;
  }
  if (cutoff <= limit - 50) cutoff = limit;
  return text.slice(0, cutoff);
}
