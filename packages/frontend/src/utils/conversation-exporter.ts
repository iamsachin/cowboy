import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import type { ConversationDetailResponse, MessageRow, ToolCallRow } from '../types';

/**
 * Export conversation as structured Markdown.
 */
export function exportAsMarkdown(data: ConversationDetailResponse): string {
  const conv = data.conversation;
  const lines: string[] = [];

  lines.push(`# Conversation: ${conv.title || 'Untitled'}`);
  lines.push('');
  lines.push(`**Agent:** ${conv.agent} | **Model:** ${conv.model || 'unknown'} | **Date:** ${formatExportDate(conv.createdAt)}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Build tool call index by messageId
  const tcByMsg = buildToolCallIndex(data.toolCalls);

  // Sort messages by createdAt
  const sorted = [...data.messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let turnNum = 0;
  for (const msg of sorted) {
    turnNum++;
    const role = normalizeRole(msg.role);

    lines.push(`### Turn ${turnNum} — ${role}`);
    lines.push('');

    if (msg.thinking) {
      lines.push('> **Thinking:**');
      for (const thinkLine of msg.thinking.split('\n')) {
        lines.push(`> ${thinkLine}`);
      }
      lines.push('');
    }

    if (msg.content) {
      lines.push(msg.content);
      lines.push('');
    }

    // Append tool calls for this message
    const toolCalls = tcByMsg.get(msg.id) || [];
    for (const tc of toolCalls) {
      const status = tc.status || 'unknown';
      lines.push(`**Tool: ${tc.name}** — ${status}`);
      lines.push('');
      if (tc.input != null) {
        const inputStr = typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input, null, 2);
        lines.push('```json');
        lines.push(inputStr);
        lines.push('```');
        lines.push('');
      }
      if (tc.output != null) {
        const outputStr = typeof tc.output === 'string' ? tc.output : JSON.stringify(tc.output, null, 2);
        // Truncate very long outputs
        const truncated = outputStr.length > 2000 ? outputStr.slice(0, 2000) + '\n... (truncated)' : outputStr;
        lines.push('**Output:**');
        lines.push('```');
        lines.push(truncated);
        lines.push('```');
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * Export conversation as pretty-printed JSON.
 */
export function exportAsJson(data: ConversationDetailResponse): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Export conversation as plain text.
 */
export function exportAsPlainText(data: ConversationDetailResponse): string {
  const conv = data.conversation;
  const lines: string[] = [];

  lines.push(`Conversation: ${conv.title || 'Untitled'}`);
  lines.push(`Agent: ${conv.agent} | Model: ${conv.model || 'unknown'} | Date: ${formatExportDate(conv.createdAt)}`);
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('');

  const tcByMsg = buildToolCallIndex(data.toolCalls);

  const sorted = [...data.messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const msg of sorted) {
    const role = normalizeRole(msg.role).toUpperCase();

    lines.push(`${role}:`);
    if (msg.content) {
      lines.push(msg.content);
    }

    const toolCalls = tcByMsg.get(msg.id) || [];
    for (const tc of toolCalls) {
      lines.push('');
      const outputStr = tc.output != null
        ? (typeof tc.output === 'string' ? tc.output : JSON.stringify(tc.output))
        : '(no output)';
      const truncated = outputStr.length > 1000 ? outputStr.slice(0, 1000) + '... (truncated)' : outputStr;
      lines.push(`TOOL (${tc.name}): ${truncated}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Show native save dialog and write file.
 */
export async function downloadFile(content: string, filename: string, _mimeType: string): Promise<void> {
  const ext = filename.split('.').pop() || 'txt';
  const path = await save({
    defaultPath: filename,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (!path) return; // user cancelled
  await writeTextFile(path, content);
}

/**
 * Sanitize a string for use as a filename.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
    .toLowerCase() || 'conversation';
}

// --- Helpers ---

function buildToolCallIndex(toolCalls: ToolCallRow[]): Map<string, ToolCallRow[]> {
  const map = new Map<string, ToolCallRow[]>();
  for (const tc of toolCalls) {
    const list = map.get(tc.messageId);
    if (list) {
      list.push(tc);
    } else {
      map.set(tc.messageId, [tc]);
    }
  }
  // Sort each group by createdAt
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  return map;
}

function normalizeRole(role: string): string {
  if (role === 'human' || role === 'user') return 'User';
  if (role === 'assistant') return 'Assistant';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatExportDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
