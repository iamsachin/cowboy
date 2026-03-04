import { describe, it, expect } from 'vitest';
import { groupTurns } from '../../src/composables/useGroupedTurns';
import type { MessageRow, ToolCallRow } from '@cowboy/shared';

// Factory helpers
function makeMessage(overrides: Partial<MessageRow> & { id: string; role: string; createdAt: string }): MessageRow {
  return {
    content: null,
    thinking: null,
    model: null,
    ...overrides,
  };
}

function makeToolCall(overrides: Partial<ToolCallRow> & { id: string; messageId: string; createdAt: string }): ToolCallRow {
  return {
    name: 'tool',
    input: null,
    output: null,
    status: null,
    duration: null,
    ...overrides,
  };
}

describe('groupTurns', () => {
  it('returns empty array for empty inputs', () => {
    const result = groupTurns([], []);
    expect(result).toEqual([]);
  });

  it('creates a user turn from a user message', () => {
    const msg = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:00:00Z', content: 'hello' });
    const result = groupTurns([msg], []);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'user', message: msg });
  });

  it('creates an assistant turn with matching tool calls', () => {
    const msg = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'response' });
    const tc = makeToolCall({ id: 'tc1', messageId: 'a1', createdAt: '2024-01-01T00:01:05Z', name: 'read_file' });
    const result = groupTurns([msg], [tc]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('assistant');
    if (result[0].type === 'assistant') {
      expect(result[0].message).toEqual(msg);
      expect(result[0].toolCalls).toEqual([tc]);
    }
  });

  it('groups multiple tool calls with their assistant message', () => {
    const user = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:00:00Z', content: 'hi' });
    const assistant = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'ok' });
    const tc1 = makeToolCall({ id: 'tc1', messageId: 'a1', createdAt: '2024-01-01T00:01:10Z', name: 'read_file' });
    const tc2 = makeToolCall({ id: 'tc2', messageId: 'a1', createdAt: '2024-01-01T00:01:05Z', name: 'write_file' });

    const result = groupTurns([user, assistant], [tc1, tc2]);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('user');
    expect(result[1].type).toBe('assistant');
    if (result[1].type === 'assistant') {
      expect(result[1].toolCalls).toHaveLength(2);
      // Sorted by createdAt ascending: tc2 (05s) before tc1 (10s)
      expect(result[1].toolCalls[0].id).toBe('tc2');
      expect(result[1].toolCalls[1].id).toBe('tc1');
    }
  });

  it('creates separate turns for consecutive assistant messages', () => {
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'first' });
    const a2 = makeMessage({ id: 'a2', role: 'assistant', createdAt: '2024-01-01T00:02:00Z', content: 'second' });

    const result = groupTurns([a1, a2], []);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('assistant');
    expect(result[1].type).toBe('assistant');
    if (result[0].type === 'assistant' && result[1].type === 'assistant') {
      expect(result[0].message.id).toBe('a1');
      expect(result[1].message.id).toBe('a2');
    }
  });

  it('attaches orphan tool calls to nearest preceding assistant turn', () => {
    const user = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:00:00Z', content: 'hi' });
    const assistant = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'ok' });
    const orphan = makeToolCall({
      id: 'tc-orphan',
      messageId: 'nonexistent-msg',
      createdAt: '2024-01-01T00:01:30Z',
      name: 'orphan_tool',
    });

    const result = groupTurns([user, assistant], [orphan]);
    expect(result).toHaveLength(2);
    if (result[1].type === 'assistant') {
      expect(result[1].toolCalls).toHaveLength(1);
      expect(result[1].toolCalls[0].id).toBe('tc-orphan');
    }
  });

  it('drops orphan tool calls with no preceding assistant turn', () => {
    const user = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:00:00Z', content: 'hi' });
    const assistant = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:02:00Z', content: 'ok' });
    const orphanBeforeAny = makeToolCall({
      id: 'tc-early',
      messageId: 'nonexistent',
      createdAt: '2024-01-01T00:00:30Z',
      name: 'early_tool',
    });

    const result = groupTurns([user, assistant], [orphanBeforeAny]);
    // The orphan is before the assistant turn timestamp, so no preceding assistant exists
    if (result[1].type === 'assistant') {
      expect(result[1].toolCalls).toHaveLength(0);
    }
  });

  it('creates a turn for assistant with null content but tool calls', () => {
    const msg = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: null });
    const tc = makeToolCall({ id: 'tc1', messageId: 'a1', createdAt: '2024-01-01T00:01:05Z', name: 'read_file' });

    const result = groupTurns([msg], [tc]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('assistant');
    if (result[0].type === 'assistant') {
      expect(result[0].message.content).toBeNull();
      expect(result[0].toolCalls).toHaveLength(1);
    }
  });

  it('sorts tool calls within a turn by createdAt ascending', () => {
    const msg = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'ok' });
    const tc1 = makeToolCall({ id: 'tc1', messageId: 'a1', createdAt: '2024-01-01T00:01:30Z', name: 'third' });
    const tc2 = makeToolCall({ id: 'tc2', messageId: 'a1', createdAt: '2024-01-01T00:01:10Z', name: 'first' });
    const tc3 = makeToolCall({ id: 'tc3', messageId: 'a1', createdAt: '2024-01-01T00:01:20Z', name: 'second' });

    const result = groupTurns([msg], [tc1, tc2, tc3]);
    if (result[0].type === 'assistant') {
      expect(result[0].toolCalls.map(tc => tc.id)).toEqual(['tc2', 'tc3', 'tc1']);
    }
  });

  it('sorts messages by createdAt regardless of input order', () => {
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:02:00Z', content: 'second' });
    const u1 = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:01:00Z', content: 'first' });

    // Intentionally pass in wrong order
    const result = groupTurns([a1, u1], []);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('user');
    expect(result[1].type).toBe('assistant');
  });
});
