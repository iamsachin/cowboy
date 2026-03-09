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

  it('skips user messages with null content (tool-result-only messages)', () => {
    const toolResultOnly = makeMessage({ id: 'u-tr', role: 'user', createdAt: '2024-01-01T00:00:30Z', content: null });
    const assistant = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'response' });
    const result = groupTurns([toolResultOnly, assistant], []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('assistant-group');
  });

  it('skips user messages with empty string content (tool-result-only messages)', () => {
    const emptyUser = makeMessage({ id: 'u-empty', role: 'user', createdAt: '2024-01-01T00:00:30Z', content: '  ' });
    const assistant = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'response' });
    const result = groupTurns([emptyUser, assistant], []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('assistant-group');
  });

  it('does not flush assistant group when encountering empty user messages', () => {
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'first' });
    const toolResult = makeMessage({ id: 'u-tr', role: 'user', createdAt: '2024-01-01T00:01:30Z', content: null });
    const a2 = makeMessage({ id: 'a2', role: 'assistant', createdAt: '2024-01-01T00:02:00Z', content: 'second' });
    const result = groupTurns([a1, toolResult, a2], []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('assistant-group');
    if (result[0].type === 'assistant-group') {
      expect(result[0].messageCount).toBe(2);
    }
  });

  it('detects agent prompts from Agent tool call input and produces AgentPromptTurn', () => {
    // Sequence: [assistant (spawns agent), agent-prompt, subagent-assistant, user]
    // Agent prompt should be deferred and appear after the assistant group
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'Let me research.' });
    const agentPrompt = makeMessage({
      id: 'u-agent',
      role: 'user',
      createdAt: '2024-01-01T00:01:01Z',
      content: 'Research the Sparkle framework for macOS.',
    });
    const a2 = makeMessage({ id: 'a2', role: 'assistant', createdAt: '2024-01-01T00:01:02Z', content: 'I will research.' });
    const user = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:02:00Z', content: 'Thanks' });
    const tc = makeToolCall({
      id: 'tc-agent',
      messageId: 'a1',
      createdAt: '2024-01-01T00:01:00Z',
      name: 'Agent',
      input: { description: 'Research Sparkle', prompt: 'Research the Sparkle framework for macOS.' },
    });
    const result = groupTurns([a1, agentPrompt, a2, user], [tc]);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('assistant-group');
    expect(result[1].type).toBe('agent-prompt');
    expect(result[2].type).toBe('user');
    if (result[1].type === 'agent-prompt') {
      expect(result[1].description).toBe('Research Sparkle');
      expect(result[1].message.id).toBe('u-agent');
    }
  });

  it('does not flag regular user messages as agent prompts', () => {
    const user = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:00:00Z', content: 'hello' });
    const assistant = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'hi' });
    const tc = makeToolCall({
      id: 'tc-agent',
      messageId: 'a1',
      createdAt: '2024-01-01T00:01:00Z',
      name: 'Agent',
      input: { prompt: 'Some different prompt text' },
    });
    const result = groupTurns([user, assistant], [tc]);
    expect(result[0].type).toBe('user');
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

// ─── CONV-01: system messages between assistant turns ────────────────────────

describe('CONV-01: system messages between assistant turns', () => {
  it('does not break assistant group when system-injected message appears between assistant turns', () => {
    // Sequence: [assistant, system-injected-user, assistant, user]
    // Expected: [assistant-group(2 turns), system-group, user]
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'First response' });
    const sys = makeMessage({
      id: 's1',
      role: 'user',
      createdAt: '2024-01-01T00:01:30Z',
      content: '<system-reminder>Some injected reminder</system-reminder>',
    });
    const a2 = makeMessage({ id: 'a2', role: 'assistant', createdAt: '2024-01-01T00:02:00Z', content: 'Second response' });
    const user = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:03:00Z', content: 'Thanks!' });

    const result = groupTurns([a1, sys, a2, user], []);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('assistant-group');
    if (result[0].type === 'assistant-group') {
      expect(result[0].messageCount).toBe(2);
      expect(result[0].turns[0].message.id).toBe('a1');
      expect(result[0].turns[1].message.id).toBe('a2');
    }
    expect(result[1].type).toBe('system-group');
    expect(result[2].type).toBe('user');
  });

  it('handles multiple system messages between assistant turns without splitting', () => {
    // Sequence: [assistant, sys, sys, assistant, user]
    // Expected: [assistant-group(2 turns), system-group(2 msgs), user]
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'First' });
    const sys1 = makeMessage({
      id: 's1',
      role: 'user',
      createdAt: '2024-01-01T00:01:30Z',
      content: '<system-reminder>Reminder 1</system-reminder>',
    });
    const sys2 = makeMessage({
      id: 's2',
      role: 'user',
      createdAt: '2024-01-01T00:01:45Z',
      content: '<objective>Some objective</objective>',
    });
    const a2 = makeMessage({ id: 'a2', role: 'assistant', createdAt: '2024-01-01T00:02:00Z', content: 'Second' });
    const user = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:03:00Z', content: 'Done' });

    const result = groupTurns([a1, sys1, sys2, a2, user], []);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('assistant-group');
    if (result[0].type === 'assistant-group') {
      expect(result[0].messageCount).toBe(2);
    }
    expect(result[1].type).toBe('system-group');
    if (result[1].type === 'system-group') {
      expect(result[1].count).toBe(2);
    }
    expect(result[2].type).toBe('user');
  });

  it('still produces separate system-group when system messages appear before assistant turns', () => {
    // Sequence: [system-user, assistant, user]
    // Expected: [system-group, assistant-group, user]
    const sys = makeMessage({
      id: 's1',
      role: 'user',
      createdAt: '2024-01-01T00:00:00Z',
      content: '<system-reminder>Initial reminder</system-reminder>',
    });
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'Response' });
    const user = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:02:00Z', content: 'Thanks' });

    const result = groupTurns([sys, a1, user], []);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('system-group');
    expect(result[1].type).toBe('assistant-group');
    expect(result[2].type).toBe('user');
  });

  it('no regression: [user, assistant, user] still works correctly', () => {
    const u1 = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:00:00Z', content: 'Hello' });
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'Hi there' });
    const u2 = makeMessage({ id: 'u2', role: 'user', createdAt: '2024-01-01T00:02:00Z', content: 'Bye' });

    const result = groupTurns([u1, a1, u2], []);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('user');
    expect(result[1].type).toBe('assistant-group');
    expect(result[2].type).toBe('user');
  });
});

// ─── Compaction events ───────────────────────────────────────────────────────

describe('groupTurns — compaction events', () => {
  function makeCompactionEvent(overrides: { id: string; timestamp: string; summary?: string | null; tokensBefore?: number | null; tokensAfter?: number | null }) {
    return {
      id: overrides.id,
      timestamp: overrides.timestamp,
      summary: overrides.summary ?? null,
      tokensBefore: overrides.tokensBefore ?? null,
      tokensAfter: overrides.tokensAfter ?? null,
    };
  }

  it('injects a CompactionTurn at correct chronological position between messages', () => {
    const u1 = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:00:00Z', content: 'Hello' });
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'Hi' });
    const u2 = makeMessage({ id: 'u2', role: 'user', createdAt: '2024-01-01T00:03:00Z', content: 'More' });
    const a2 = makeMessage({ id: 'a2', role: 'assistant', createdAt: '2024-01-01T00:04:00Z', content: 'Response' });

    const compaction = makeCompactionEvent({
      id: 'c1',
      timestamp: '2024-01-01T00:02:00Z',
      summary: 'Compaction summary',
      tokensBefore: 167000,
      tokensAfter: 37000,
    });

    const result = groupTurns([u1, a1, u2, a2], [], [compaction]);
    // Expected: [user, assistant-group, compaction, user, assistant-group]
    expect(result).toHaveLength(5);
    expect(result[0].type).toBe('user');
    expect(result[1].type).toBe('assistant-group');
    expect(result[2].type).toBe('compaction');
    if (result[2].type === 'compaction') {
      expect(result[2].id).toBe('c1');
      expect(result[2].tokensBefore).toBe(167000);
      expect(result[2].tokensAfter).toBe(37000);
      expect(result[2].summary).toBe('Compaction summary');
    }
    expect(result[3].type).toBe('user');
    expect(result[4].type).toBe('assistant-group');
  });

  it('returns same output with empty compactionEvents (backward compatible)', () => {
    const u1 = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:00:00Z', content: 'Hello' });
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'Hi' });

    const withEmpty = groupTurns([u1, a1], [], []);
    const withoutArg = groupTurns([u1, a1], []);
    expect(withEmpty).toEqual(withoutArg);
  });

  it('injects multiple CompactionTurn entries at correct positions', () => {
    const u1 = makeMessage({ id: 'u1', role: 'user', createdAt: '2024-01-01T00:00:00Z', content: 'Hello' });
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'Hi' });
    const u2 = makeMessage({ id: 'u2', role: 'user', createdAt: '2024-01-01T00:04:00Z', content: 'More' });
    const a2 = makeMessage({ id: 'a2', role: 'assistant', createdAt: '2024-01-01T00:05:00Z', content: 'Response' });
    const u3 = makeMessage({ id: 'u3', role: 'user', createdAt: '2024-01-01T00:08:00Z', content: 'Again' });

    const c1 = makeCompactionEvent({ id: 'c1', timestamp: '2024-01-01T00:02:00Z' });
    const c2 = makeCompactionEvent({ id: 'c2', timestamp: '2024-01-01T00:06:00Z' });

    const result = groupTurns([u1, a1, u2, a2, u3], [], [c1, c2]);
    // Expected: [user, assistant-group, compaction(c1), user, assistant-group, compaction(c2), user]
    expect(result).toHaveLength(7);
    expect(result[2].type).toBe('compaction');
    expect(result[5].type).toBe('compaction');
    if (result[2].type === 'compaction') expect(result[2].id).toBe('c1');
    if (result[5].type === 'compaction') expect(result[5].id).toBe('c2');
  });

  it('inserts compaction even when surrounded by assistant groups', () => {
    const a1 = makeMessage({ id: 'a1', role: 'assistant', createdAt: '2024-01-01T00:01:00Z', content: 'First' });
    const a2 = makeMessage({ id: 'a2', role: 'assistant', createdAt: '2024-01-01T00:02:00Z', content: 'Second' });
    const a3 = makeMessage({ id: 'a3', role: 'assistant', createdAt: '2024-01-01T00:04:00Z', content: 'Third' });

    const c1 = makeCompactionEvent({ id: 'c1', timestamp: '2024-01-01T00:03:00Z' });

    // a1+a2 are grouped, then compaction, then a3 in its own group
    // Actually a1+a2+a3 would all be one assistant-group since no user message breaks them.
    // The compaction should split them or appear within them.
    // Actually the compaction should be injected between grouped turns.
    // Since a1, a2, a3 are all consecutive assistants, they form ONE assistant-group.
    // The compaction at 00:03 is between a2 (00:02) and a3 (00:04).
    // It should be injected there.
    const result = groupTurns([a1, a2, a3], [], [c1]);
    // With all 3 assistants as consecutive, they'd form one group without compaction.
    // With compaction, the post-processing should split or inject.
    // The simplest approach: insert compaction between grouped turns based on timestamps.
    // Since all 3 form one group (first=00:01, last=00:04), compaction at 00:03 falls within.
    // We should still inject it -- the implementation will place it after the group whose last timestamp <= compaction timestamp.
    // One group covers 00:01-00:04, so compaction at 00:03 falls inside. Placed after it.
    // Let's verify compaction appears somewhere in the result.
    const compactionTurns = result.filter(t => t.type === 'compaction');
    expect(compactionTurns).toHaveLength(1);
    if (compactionTurns[0].type === 'compaction') {
      expect(compactionTurns[0].id).toBe('c1');
    }
  });
});
