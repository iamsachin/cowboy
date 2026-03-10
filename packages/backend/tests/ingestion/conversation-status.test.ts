import { describe, it, expect } from 'vitest';
import { isConversationOngoing } from '../../src/ingestion/index.js';
import type { NormalizedData } from '../../src/ingestion/normalizer.js';

/**
 * Build a minimal NormalizedData fixture for testing isConversationOngoing.
 */
function makeFixture(
  overrides: Partial<Pick<NormalizedData, 'messages' | 'toolCalls'>> = {},
): NormalizedData {
  return {
    conversation: {
      id: 'conv-1',
      agent: 'claude-code',
      project: 'test',
      title: 'Test conversation',
      createdAt: '2026-03-10T00:00:00Z',
      updatedAt: '2026-03-10T00:05:00Z',
      model: 'claude-sonnet-4-20250514',
    },
    messages: overrides.messages ?? [],
    toolCalls: overrides.toolCalls ?? [],
    tokenUsage: [],
    compactionEvents: [],
  };
}

describe('isConversationOngoing', () => {
  it('returns false for a conversation with no messages', () => {
    const data = makeFixture({ messages: [], toolCalls: [] });
    expect(isConversationOngoing(data)).toBe(false);
  });

  it('returns false when last assistant message is text-only (no tool calls)', () => {
    const data = makeFixture({
      messages: [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: 'Hello',
          thinking: null,
          createdAt: '2026-03-10T00:00:00Z',
          model: null,
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'Hi there! How can I help?',
          thinking: null,
          createdAt: '2026-03-10T00:01:00Z',
          model: 'claude-sonnet-4-20250514',
        },
      ],
      toolCalls: [],
    });
    expect(isConversationOngoing(data)).toBe(false);
  });

  it('returns true when last assistant message has tool calls (waiting for tool results)', () => {
    const data = makeFixture({
      messages: [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: 'Read my file',
          thinking: null,
          createdAt: '2026-03-10T00:00:00Z',
          model: null,
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'Let me read that file.',
          thinking: null,
          createdAt: '2026-03-10T00:01:00Z',
          model: 'claude-sonnet-4-20250514',
        },
      ],
      toolCalls: [
        {
          id: 'tc-1',
          messageId: 'msg-2',
          conversationId: 'conv-1',
          name: 'Read',
          input: { file_path: '/tmp/test.ts' },
          output: null,
          status: null,
          duration: null,
          createdAt: '2026-03-10T00:01:00Z',
        },
      ],
    });
    expect(isConversationOngoing(data)).toBe(true);
  });

  it('returns true when last user message contains tool results (tool results flowing back)', () => {
    const data = makeFixture({
      messages: [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: 'Read my file',
          thinking: null,
          createdAt: '2026-03-10T00:00:00Z',
          model: null,
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'Let me read that file.',
          thinking: null,
          createdAt: '2026-03-10T00:01:00Z',
          model: 'claude-sonnet-4-20250514',
        },
        {
          id: 'msg-3',
          conversationId: 'conv-1',
          role: 'user',
          content: '[tool_result content]',
          thinking: null,
          createdAt: '2026-03-10T00:01:05Z',
          model: null,
        },
      ],
      toolCalls: [
        {
          id: 'tc-1',
          messageId: 'msg-2',
          conversationId: 'conv-1',
          name: 'Read',
          input: { file_path: '/tmp/test.ts' },
          output: 'file contents',
          status: 'success',
          duration: null,
          createdAt: '2026-03-10T00:01:00Z',
        },
      ],
    });
    expect(isConversationOngoing(data)).toBe(true);
  });

  it('returns false when last message is a plain user message (new prompt, not running)', () => {
    const data = makeFixture({
      messages: [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: 'Hello',
          thinking: null,
          createdAt: '2026-03-10T00:00:00Z',
          model: null,
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'Hi! How can I help?',
          thinking: null,
          createdAt: '2026-03-10T00:01:00Z',
          model: 'claude-sonnet-4-20250514',
        },
        {
          id: 'msg-3',
          conversationId: 'conv-1',
          role: 'user',
          content: 'Can you also fix the bug?',
          thinking: null,
          createdAt: '2026-03-10T00:05:00Z',
          model: null,
        },
      ],
      toolCalls: [],
    });
    expect(isConversationOngoing(data)).toBe(false);
  });

  it('returns false for conversation with only user messages', () => {
    const data = makeFixture({
      messages: [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: 'Hello',
          thinking: null,
          createdAt: '2026-03-10T00:00:00Z',
          model: null,
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          role: 'user',
          content: 'Anyone there?',
          thinking: null,
          createdAt: '2026-03-10T00:01:00Z',
          model: null,
        },
      ],
      toolCalls: [],
    });
    expect(isConversationOngoing(data)).toBe(false);
  });

  it('returns false when assistant used tools earlier but final message is text-only', () => {
    const data = makeFixture({
      messages: [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: 'Read and fix my file',
          thinking: null,
          createdAt: '2026-03-10T00:00:00Z',
          model: null,
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'Let me read that.',
          thinking: null,
          createdAt: '2026-03-10T00:01:00Z',
          model: 'claude-sonnet-4-20250514',
        },
        {
          id: 'msg-3',
          conversationId: 'conv-1',
          role: 'user',
          content: '[tool result]',
          thinking: null,
          createdAt: '2026-03-10T00:01:05Z',
          model: null,
        },
        {
          id: 'msg-4',
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'I have fixed the file. Here is what I changed.',
          thinking: null,
          createdAt: '2026-03-10T00:02:00Z',
          model: 'claude-sonnet-4-20250514',
        },
      ],
      toolCalls: [
        {
          id: 'tc-1',
          messageId: 'msg-2',
          conversationId: 'conv-1',
          name: 'Read',
          input: { file_path: '/tmp/test.ts' },
          output: 'file contents',
          status: 'success',
          duration: null,
          createdAt: '2026-03-10T00:01:00Z',
        },
      ],
    });
    expect(isConversationOngoing(data)).toBe(false);
  });
});
