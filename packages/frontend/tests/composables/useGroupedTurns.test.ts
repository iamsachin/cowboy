import { describe, it, expect } from 'vitest';
import { groupTurns, classifySystemMessage } from '../../src/composables/useGroupedTurns';
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

  it('creates an assistant-group from a single assistant message', () => {
    const msg = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'response' });
    const tc = makeToolCall({ id: 'tc1', messageId: 'a1', createdAt: '2024-01-01T00:01:05Z', name: 'read_file' });
    const result = groupTurns([msg], [tc]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('assistant-group');
    if (result[0].type === 'assistant-group') {
      expect(result[0].messageCount).toBe(1);
      expect(result[0].toolCallCount).toBe(1);
      expect(result[0].turns[0].message).toEqual(msg);
      expect(result[0].turns[0].toolCalls).toEqual([tc]);
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
    expect(result[1].type).toBe('assistant-group');
    if (result[1].type === 'assistant-group') {
      expect(result[1].turns[0].toolCalls).toHaveLength(2);
      // Sorted by createdAt ascending: tc2 (05s) before tc1 (10s)
      expect(result[1].turns[0].toolCalls[0].id).toBe('tc2');
      expect(result[1].turns[0].toolCalls[1].id).toBe('tc1');
    }
  });

  it('groups consecutive assistant messages into a single assistant-group', () => {
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'first' });
    const a2 = makeMessage({ id: 'a2', role: 'assistant', createdAt: '2024-01-01T00:02:00Z', content: 'second' });

    const result = groupTurns([a1, a2], []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('assistant-group');
    if (result[0].type === 'assistant-group') {
      expect(result[0].messageCount).toBe(2);
      expect(result[0].turns[0].message.id).toBe('a1');
      expect(result[0].turns[1].message.id).toBe('a2');
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
    if (result[1].type === 'assistant-group') {
      expect(result[1].turns[0].toolCalls).toHaveLength(1);
      expect(result[1].turns[0].toolCalls[0].id).toBe('tc-orphan');
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
    if (result[1].type === 'assistant-group') {
      expect(result[1].turns[0].toolCalls).toHaveLength(0);
    }
  });

  it('creates a group for assistant with null content but tool calls', () => {
    const msg = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: null });
    const tc = makeToolCall({ id: 'tc1', messageId: 'a1', createdAt: '2024-01-01T00:01:05Z', name: 'read_file' });

    const result = groupTurns([msg], [tc]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('assistant-group');
    if (result[0].type === 'assistant-group') {
      expect(result[0].turns[0].message.content).toBeNull();
      expect(result[0].turns[0].toolCalls).toHaveLength(1);
    }
  });

  it('sorts tool calls within a turn by createdAt ascending', () => {
    const msg = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'ok' });
    const tc1 = makeToolCall({ id: 'tc1', messageId: 'a1', createdAt: '2024-01-01T00:01:30Z', name: 'third' });
    const tc2 = makeToolCall({ id: 'tc2', messageId: 'a1', createdAt: '2024-01-01T00:01:10Z', name: 'first' });
    const tc3 = makeToolCall({ id: 'tc3', messageId: 'a1', createdAt: '2024-01-01T00:01:20Z', name: 'second' });

    const result = groupTurns([msg], [tc1, tc2, tc3]);
    if (result[0].type === 'assistant-group') {
      expect(result[0].turns[0].toolCalls.map(tc => tc.id)).toEqual(['tc2', 'tc3', 'tc1']);
    }
  });

  it('sorts messages by createdAt regardless of input order', () => {
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:02:00Z', content: 'second' });
    const u1 = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:01:00Z', content: 'first' });

    // Intentionally pass in wrong order
    const result = groupTurns([a1, u1], []);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('user');
    expect(result[1].type).toBe('assistant-group');
  });
});

// ─── classifySystemMessage ────────────────────────────────────────────────────

describe('classifySystemMessage', () => {
  it('returns system-reminder for content containing <system-reminder tag', () => {
    const content = '<system-reminder>Remember to follow rules.</system-reminder>';
    expect(classifySystemMessage(content)).toBe('system-reminder');
  });

  it('returns objective for content containing <objective> tag', () => {
    const content = '<objective>Complete the task</objective>';
    expect(classifySystemMessage(content)).toBe('objective');
  });

  it('returns objective for content containing <execution_context> tag', () => {
    const content = '<execution_context>Some context here</execution_context>';
    expect(classifySystemMessage(content)).toBe('objective');
  });

  it('returns skill-instruction for content with <context> and <files_to_read>', () => {
    const content = '<context><files_to_read>PLAN.md</files_to_read></context>';
    expect(classifySystemMessage(content)).toBe('skill-instruction');
  });

  it('returns skill-instruction for content with <context> and <process>', () => {
    const content = '<context><process>Step 1: Do this</process></context>';
    expect(classifySystemMessage(content)).toBe('skill-instruction');
  });

  it('returns system-caveat for content containing Caveat:', () => {
    const content = 'Caveat: This is an important note about behavior.';
    expect(classifySystemMessage(content)).toBe('system-caveat');
  });

  it('returns other for unrecognized content', () => {
    const content = '<local-command>some command stuff</local-command>';
    expect(classifySystemMessage(content)).toBe('other');
  });
});

// ─── groupTurns — new turn types ─────────────────────────────────────────────

describe('groupTurns — system messages and slash commands', () => {
  it('produces ClearDividerTurn for /clear command', () => {
    const msg = makeMessage({
      id: 'u1',
      role: 'user',
      createdAt: '2024-01-01T00:00:00Z',
      content: '<command-name>/clear</command-name>',
    });
    const result = groupTurns([msg], []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('clear-divider');
  });

  it('produces SlashCommandTurn with extracted commandText for slash commands', () => {
    const msg = makeMessage({
      id: 'u1',
      role: 'user',
      createdAt: '2024-01-01T00:00:00Z',
      content: '<command-name>/gsd:execute-phase</command-name><command-args>11</command-args>',
    });
    const result = groupTurns([msg], []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('slash-command');
    if (result[0].type === 'slash-command') {
      expect(result[0].commandText).toBe('/gsd:execute-phase 11');
      expect(result[0].message.id).toBe('u1');
    }
  });

  it('produces SystemGroup for a single system-injected message', () => {
    const msg = makeMessage({
      id: 'u1',
      role: 'user',
      createdAt: '2024-01-01T00:00:00Z',
      content: '<system-reminder>You are Claude.</system-reminder>',
    });
    const result = groupTurns([msg], []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('system-group');
    if (result[0].type === 'system-group') {
      expect(result[0].count).toBe(1);
      expect(result[0].messages).toHaveLength(1);
      expect(result[0].categories).toEqual(['system-reminder']);
    }
  });

  it('groups three consecutive system-injected messages into one SystemGroup', () => {
    const s1 = makeMessage({
      id: 's1',
      role: 'user',
      createdAt: '2024-01-01T00:00:00Z',
      content: '<system-reminder>Rule 1</system-reminder>',
    });
    const s2 = makeMessage({
      id: 's2',
      role: 'user',
      createdAt: '2024-01-01T00:00:01Z',
      content: '<objective>Goal here</objective>',
    });
    const s3 = makeMessage({
      id: 's3',
      role: 'user',
      createdAt: '2024-01-01T00:00:02Z',
      content: '<context><files_to_read>PLAN.md</files_to_read></context>',
    });
    const result = groupTurns([s1, s2, s3], []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('system-group');
    if (result[0].type === 'system-group') {
      expect(result[0].count).toBe(3);
      expect(result[0].categories).toEqual(['system-reminder', 'objective', 'skill-instruction']);
    }
  });

  it('flushes pending system group before a regular user message', () => {
    const sys = makeMessage({
      id: 's1',
      role: 'user',
      createdAt: '2024-01-01T00:00:00Z',
      content: '<system-reminder>Some reminder</system-reminder>',
    });
    const user = makeMessage({
      id: 'u1',
      role: 'user',
      createdAt: '2024-01-01T00:00:01Z',
      content: 'Hello!',
    });
    const result = groupTurns([sys, user], []);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('system-group');
    expect(result[1].type).toBe('user');
  });

  it('handles mixed sequence: system + system + user + assistant', () => {
    const s1 = makeMessage({
      id: 's1',
      role: 'user',
      createdAt: '2024-01-01T00:00:00Z',
      content: '<system-reminder>Rule A</system-reminder>',
    });
    const s2 = makeMessage({
      id: 's2',
      role: 'user',
      createdAt: '2024-01-01T00:00:01Z',
      content: '<objective>Do the thing</objective>',
    });
    const user = makeMessage({
      id: 'u1',
      role: 'user',
      createdAt: '2024-01-01T00:00:02Z',
      content: 'Help me',
    });
    const asst = makeMessage({
      id: 'a1',
      role: 'assistant',
      createdAt: '2024-01-01T00:00:03Z',
      content: 'Sure!',
    });
    const result = groupTurns([s1, s2, user, asst], []);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('system-group');
    expect(result[1].type).toBe('user');
    expect(result[2].type).toBe('assistant-group');
    if (result[0].type === 'system-group') {
      expect(result[0].count).toBe(2);
    }
  });

  it('regular user messages still produce UserTurn (no regression)', () => {
    const msg = makeMessage({
      id: 'u1',
      role: 'user',
      createdAt: '2024-01-01T00:00:00Z',
      content: 'What is the meaning of life?',
    });
    const result = groupTurns([msg], []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('user');
  });
});
