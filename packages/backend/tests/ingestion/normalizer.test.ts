import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { parseJsonlFile } from '../../src/ingestion/claude-code-parser.js';
import { normalizeConversation } from '../../src/ingestion/normalizer.js';
import type { NormalizedData } from '../../src/ingestion/normalizer.js';
import { generateId } from '../../src/ingestion/id-generator.js';
import type { ParseResult } from '../../src/ingestion/claude-code-parser.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('normalizeConversation', () => {
  let sampleResult: ParseResult;
  let streamResult: ParseResult;
  let toolResult: ParseResult;
  let emptyResult: ParseResult;

  beforeAll(async () => {
    sampleResult = await parseJsonlFile(join(FIXTURES, 'sample-conversation.jsonl'));
    streamResult = await parseJsonlFile(join(FIXTURES, 'streaming-assistant.jsonl'));
    toolResult = await parseJsonlFile(join(FIXTURES, 'tool-use-flow.jsonl'));
    emptyResult = await parseJsonlFile(join(FIXTURES, 'empty.jsonl'));
  });

  describe('conversation record', () => {
    it('produces a conversation with agent="claude-code"', () => {
      const data = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      expect(data).not.toBeNull();
      expect(data!.conversation.agent).toBe('claude-code');
    });

    it('derives project name from projectDir via deriveProjectName', () => {
      const data = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      expect(data!.conversation.project).toBe('cowboy');
    });

    it('sets title to first non-empty user message content, truncated to 100 chars', () => {
      const data = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      expect(data!.conversation.title).toBe('What is the meaning of life?');
    });

    it('truncates long titles to 100 characters', () => {
      // Create a mock parse result with a very long user message
      const longResult: ParseResult = {
        sessionId: 'session-long',
        userMessages: [{
          uuid: 'uuid-long-user',
          timestamp: '2026-01-15T10:00:00.000Z',
          content: 'A'.repeat(200),
          toolResults: [],
        }],
        assistantMessages: [{
          firstUuid: 'uuid-long-asst',
          messageId: 'msg_long',
          timestamp: '2026-01-15T10:00:01.000Z',
          model: 'claude-sonnet-4-6',
          contentBlocks: [{ type: 'text', text: 'Response' }],
          toolUseBlocks: [],
          usage: { input_tokens: 10, output_tokens: 5 },
          stopReason: 'end_turn',
        }],
        skippedLines: 0,
        timestamps: ['2026-01-15T10:00:00.000Z', '2026-01-15T10:00:01.000Z'],
      };
      const data = normalizeConversation(longResult, 'test-project');
      expect(data!.conversation.title).toHaveLength(100);
    });

    it('sets createdAt to earliest timestamp and updatedAt to latest', () => {
      const data = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      expect(data!.conversation.createdAt).toBe('2026-01-15T10:00:00.000Z');
      expect(data!.conversation.updatedAt).toBe('2026-01-15T10:00:01.500Z');
    });

    it('sets model to most common model across assistant messages', () => {
      const data = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      expect(data!.conversation.model).toBe('claude-sonnet-4-6');
    });

    it('generates deterministic conversation ID', () => {
      const data1 = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      const data2 = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      expect(data1!.conversation.id).toBe(data2!.conversation.id);
      expect(data1!.conversation.id).toBe(generateId('claude-code', 'session-abc-123'));
    });
  });

  describe('message records', () => {
    it('produces message records for each user and assistant message', () => {
      const data = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      expect(data!.messages).toHaveLength(2); // 1 user + 1 assistant
    });

    it('message IDs are deterministic via generateId(conversationId, uuid)', () => {
      const data = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      const convId = data!.conversation.id;
      const userMsg = data!.messages.find((m) => m.role === 'user');
      expect(userMsg!.id).toBe(generateId(convId, 'uuid-user-1'));
    });

    it('sets correct role, content, and timestamps on messages', () => {
      const data = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      const userMsg = data!.messages.find((m) => m.role === 'user')!;
      expect(userMsg.content).toBe('What is the meaning of life?');
      expect(userMsg.createdAt).toBe('2026-01-15T10:00:00.000Z');
      expect(userMsg.model).toBeNull();
    });

    it('separates text and thinking blocks for assistant messages', () => {
      const data = normalizeConversation(streamResult, '-Users-sachin-Desktop-learn-cowboy');
      const assistMsg = data!.messages.find((m) => m.role === 'assistant')!;
      // "Hello" + " world" text blocks go to content; thinking block goes to thinking
      expect(assistMsg.content).toContain('Hello world');
      expect(assistMsg.content).not.toContain('Let me think');
      expect(assistMsg.thinking).toBe('Let me think about what I just said.');
    });

    it('sets model on assistant messages', () => {
      const data = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      const assistMsg = data!.messages.find((m) => m.role === 'assistant')!;
      expect(assistMsg.model).toBe('claude-sonnet-4-6');
    });

    it('sets conversationId on all messages', () => {
      const data = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      const convId = data!.conversation.id;
      for (const msg of data!.messages) {
        expect(msg.conversationId).toBe(convId);
      }
    });
  });

  describe('tool call records', () => {
    it('produces tool_call records for each tool_use block in assistant messages', () => {
      const data = normalizeConversation(toolResult, '-Users-sachin-Desktop-learn-cowboy');
      expect(data!.toolCalls.length).toBeGreaterThan(0);
      const readCall = data!.toolCalls.find((tc) => tc.name === 'Read');
      expect(readCall).toBeDefined();
    });

    it('tool_call output is populated from matching tool_result in user messages', () => {
      const data = normalizeConversation(toolResult, '-Users-sachin-Desktop-learn-cowboy');
      const readCall = data!.toolCalls.find((tc) => tc.name === 'Read')!;
      expect(readCall.output).toBe('file contents here');
    });

    it('tool_call status is "success" when tool_result is not error', () => {
      const data = normalizeConversation(toolResult, '-Users-sachin-Desktop-learn-cowboy');
      const readCall = data!.toolCalls.find((tc) => tc.name === 'Read')!;
      expect(readCall.status).toBe('success');
    });

    it('tool_call ID is deterministic via generateId(conversationId, toolUseBlock.id)', () => {
      const data = normalizeConversation(toolResult, '-Users-sachin-Desktop-learn-cowboy');
      const convId = data!.conversation.id;
      const readCall = data!.toolCalls.find((tc) => tc.name === 'Read')!;
      expect(readCall.id).toBe(generateId(convId, 'toolu_01TestRead'));
    });

    it('tool_call has correct messageId and conversationId', () => {
      const data = normalizeConversation(toolResult, '-Users-sachin-Desktop-learn-cowboy');
      const convId = data!.conversation.id;
      const readCall = data!.toolCalls.find((tc) => tc.name === 'Read')!;
      expect(readCall.conversationId).toBe(convId);
      expect(readCall.messageId).toBeDefined();
    });
  });

  describe('token usage records', () => {
    it('produces token_usage records from assistant messages with usage data', () => {
      const data = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      expect(data!.tokenUsage.length).toBeGreaterThan(0);
    });

    it('token_usage uses ONLY final chunk usage (verified via parser)', () => {
      const data = normalizeConversation(streamResult, '-Users-sachin-Desktop-learn-cowboy');
      // Stream has 3 chunks, but only the last has stop_reason="end_turn"
      // Final chunk usage: output_tokens: 45
      expect(data!.tokenUsage).toHaveLength(1);
      expect(data!.tokenUsage[0].outputTokens).toBe(45);
    });

    it('token_usage ID is deterministic via generateId(conversationId, messageId)', () => {
      const data = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      const convId = data!.conversation.id;
      const tu = data!.tokenUsage[0];
      expect(tu.id).toBe(generateId(convId, 'msg_01Test'));
    });

    it('defaults cache tokens to 0 if undefined', () => {
      // streaming-assistant chunk 2 has no cache tokens, but we use final chunk
      // The malformed file's assistant has no cache tokens in usage
      const malformedResult = normalizeConversation(
        {
          sessionId: 'session-no-cache',
          userMessages: [{ uuid: 'u1', timestamp: '2026-01-01T00:00:00Z', content: 'hi', toolResults: [] }],
          assistantMessages: [{
            firstUuid: 'a1',
            messageId: 'msg_nc',
            timestamp: '2026-01-01T00:00:01Z',
            model: 'claude-sonnet-4-6',
            contentBlocks: [{ type: 'text', text: 'hello' }],
            toolUseBlocks: [],
            usage: { input_tokens: 10, output_tokens: 5 },
            stopReason: 'end_turn',
          }],
          skippedLines: 0,
          timestamps: ['2026-01-01T00:00:00Z', '2026-01-01T00:00:01Z'],
        },
        'test',
      );
      expect(malformedResult!.tokenUsage[0].cacheReadTokens).toBe(0);
      expect(malformedResult!.tokenUsage[0].cacheCreationTokens).toBe(0);
    });

    it('sets correct model, inputTokens, outputTokens on token_usage', () => {
      const data = normalizeConversation(sampleResult, '-Users-sachin-Desktop-learn-cowboy');
      const tu = data!.tokenUsage[0];
      expect(tu.model).toBe('claude-sonnet-4-6');
      expect(tu.inputTokens).toBe(50);
      expect(tu.outputTokens).toBe(25);
      expect(tu.cacheReadTokens).toBe(10);
      expect(tu.cacheCreationTokens).toBe(0);
    });
  });

  describe('empty input', () => {
    it('returns null on empty ParseResult', () => {
      const data = normalizeConversation(emptyResult, '-Users-sachin-Desktop-learn-cowboy');
      expect(data).toBeNull();
    });
  });

  describe('determinism', () => {
    it('same input always produces same output', () => {
      const data1 = normalizeConversation(toolResult, '-Users-sachin-Desktop-learn-cowboy');
      const data2 = normalizeConversation(toolResult, '-Users-sachin-Desktop-learn-cowboy');
      expect(data1).toEqual(data2);
    });
  });
});
