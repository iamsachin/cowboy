import { describe, it, expect } from 'vitest';
import { getPreviewSnippet, calculateDuration, formatMs, truncateOutput } from '../../src/utils/turn-helpers';
import type { AssistantTurn, Turn } from '../../src/composables/useGroupedTurns';
import type { MessageRow, ToolCallRow } from '@cowboy/shared';

function makeMessage(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: null,
    thinking: null,
    createdAt: '2026-01-01T00:00:00Z',
    model: 'claude-3',
    ...overrides,
  };
}

function makeToolCall(overrides: Partial<ToolCallRow> = {}): ToolCallRow {
  return {
    id: 'tc-1',
    messageId: 'msg-1',
    name: 'Read',
    input: {},
    output: 'file contents',
    status: 'success',
    duration: 500,
    createdAt: '2026-01-01T00:00:01Z',
    ...overrides,
  };
}

function makeAssistantTurn(
  messageOverrides: Partial<MessageRow> = {},
  toolCalls: ToolCallRow[] = [],
): AssistantTurn {
  return {
    type: 'assistant',
    message: makeMessage(messageOverrides),
    toolCalls,
  };
}

// ── getPreviewSnippet ─────────────────────────────────────────

describe('getPreviewSnippet', () => {
  it('returns first line of assistant text truncated to 80 chars', () => {
    const longText = 'A'.repeat(100);
    const turn = makeAssistantTurn({ content: longText });
    const snippet = getPreviewSnippet(turn);
    expect(snippet.length).toBeLessThanOrEqual(83); // 80 + '...'
    expect(snippet.endsWith('...')).toBe(true);
  });

  it('returns full first line if under 80 chars', () => {
    const turn = makeAssistantTurn({ content: 'Hello world' });
    expect(getPreviewSnippet(turn)).toBe('Hello world');
  });

  it('strips XML tags from content before extracting snippet', () => {
    const turn = makeAssistantTurn({ content: '<antThinking>plan</antThinking>Here is the result' });
    const snippet = getPreviewSnippet(turn);
    expect(snippet).not.toContain('<antThinking>');
    expect(snippet).toContain('Here is the result');
  });

  it('falls back to tool summary when text is null', () => {
    const turn = makeAssistantTurn({ content: null }, [
      makeToolCall({ name: 'Read' }),
      makeToolCall({ id: 'tc-2', name: 'Edit' }),
      makeToolCall({ id: 'tc-3', name: 'Bash' }),
    ]);
    expect(getPreviewSnippet(turn)).toBe('Used Read, Edit, Bash (3 tool calls)');
  });

  it('falls back to tool summary when text is empty string', () => {
    const turn = makeAssistantTurn({ content: '' }, [
      makeToolCall({ name: 'Read' }),
    ]);
    expect(getPreviewSnippet(turn)).toBe('Used Read (1 tool call)');
  });

  it('returns "Empty response" when no text and no tool calls', () => {
    const turn = makeAssistantTurn({ content: null }, []);
    expect(getPreviewSnippet(turn)).toBe('Empty response');
  });

  it('handles content with only XML tags (empty after stripping)', () => {
    const turn = makeAssistantTurn(
      { content: '<antThinking/><result/>' },
      [makeToolCall({ name: 'Bash' })],
    );
    expect(getPreviewSnippet(turn)).toBe('Used Bash (1 tool call)');
  });

  it('takes only first line of multi-line content', () => {
    const turn = makeAssistantTurn({ content: 'First line\nSecond line\nThird line' });
    expect(getPreviewSnippet(turn)).toBe('First line');
  });
});

// ── calculateDuration ─────────────────────────────────────────

describe('calculateDuration', () => {
  it('returns formatted duration when tool calls exist', () => {
    const turn = makeAssistantTurn(
      { createdAt: '2026-01-01T00:00:00Z' },
      [makeToolCall({ createdAt: '2026-01-01T00:00:02Z', duration: 500 })],
    );
    // Duration = (TC createdAt + TC duration) - assistant createdAt
    // = (2000 + 500) - 0 = 2500ms = "2s"
    const result = calculateDuration(turn);
    expect(result).toBe('2s');
  });

  it('uses last tool call when multiple exist', () => {
    const turn = makeAssistantTurn(
      { createdAt: '2026-01-01T00:00:00Z' },
      [
        makeToolCall({ id: 'tc-1', createdAt: '2026-01-01T00:00:01Z', duration: 100 }),
        makeToolCall({ id: 'tc-2', createdAt: '2026-01-01T00:00:05Z', duration: 1000 }),
      ],
    );
    // Duration = (5000 + 1000) - 0 = 6000ms = "6s"
    const result = calculateDuration(turn);
    expect(result).toBe('6s');
  });

  it('returns formatted duration from next turn timestamp when no tool calls', () => {
    const turn = makeAssistantTurn({ createdAt: '2026-01-01T00:00:00Z' }, []);
    const nextTurn: Turn = {
      type: 'user',
      message: makeMessage({ id: 'msg-2', role: 'user', createdAt: '2026-01-01T00:00:03Z' }),
    };
    const result = calculateDuration(turn, nextTurn);
    expect(result).toBe('3s');
  });

  it('returns null when no tool calls and no next turn', () => {
    const turn = makeAssistantTurn({ createdAt: '2026-01-01T00:00:00Z' }, []);
    expect(calculateDuration(turn)).toBeNull();
  });

  it('returns "--" for negative durations', () => {
    const turn = makeAssistantTurn({ createdAt: '2026-01-01T00:00:10Z' }, []);
    const nextTurn: Turn = {
      type: 'user',
      message: makeMessage({ id: 'msg-2', role: 'user', createdAt: '2026-01-01T00:00:05Z' }),
    };
    expect(calculateDuration(turn, nextTurn)).toBe('--');
  });

  it('handles tool call with null duration', () => {
    const turn = makeAssistantTurn(
      { createdAt: '2026-01-01T00:00:00Z' },
      [makeToolCall({ createdAt: '2026-01-01T00:00:03Z', duration: null })],
    );
    // Duration = (3000 + 0) - 0 = 3000ms = "3s"
    expect(calculateDuration(turn)).toBe('3s');
  });
});

// ── formatMs ──────────────────────────────────────────────────

describe('formatMs', () => {
  it('formats <1000ms as "Xms"', () => {
    expect(formatMs(500)).toBe('500ms');
    expect(formatMs(0)).toBe('0ms');
    expect(formatMs(999)).toBe('999ms');
  });

  it('formats 1000-59999ms as "Xs"', () => {
    expect(formatMs(1000)).toBe('1s');
    expect(formatMs(2500)).toBe('2s');
    expect(formatMs(59999)).toBe('59s');
  });

  it('formats 60000+ as "Xm Ys"', () => {
    expect(formatMs(60000)).toBe('1m 0s');
    expect(formatMs(90000)).toBe('1m 30s');
    expect(formatMs(125000)).toBe('2m 5s');
  });
});

// ── truncateOutput ────────────────────────────────────────────

describe('truncateOutput', () => {
  it('returns full text with truncated=false when <= 20 lines', () => {
    const text = 'line1\nline2\nline3';
    const result = truncateOutput(text);
    expect(result.text).toBe(text);
    expect(result.truncated).toBe(false);
  });

  it('returns first 20 lines with truncated=true when > 20 lines', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
    const text = lines.join('\n');
    const result = truncateOutput(text);
    expect(result.truncated).toBe(true);
    expect(result.text.split('\n')).toHaveLength(20);
    expect(result.text).toBe(lines.slice(0, 20).join('\n'));
  });

  it('handles null input gracefully', () => {
    const result = truncateOutput(null);
    expect(result.text).toBe('');
    expect(result.truncated).toBe(false);
  });

  it('handles undefined input gracefully', () => {
    const result = truncateOutput(undefined);
    expect(result.text).toBe('');
    expect(result.truncated).toBe(false);
  });

  it('uses JSON.stringify for non-string values', () => {
    const obj = { key: 'value' };
    const result = truncateOutput(obj);
    expect(result.text).toBe(JSON.stringify(obj, null, 2));
    expect(result.truncated).toBe(false);
  });

  it('respects custom maxLines parameter', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
    const text = lines.join('\n');
    const result = truncateOutput(text, 5);
    expect(result.truncated).toBe(true);
    expect(result.text.split('\n')).toHaveLength(5);
  });
});
