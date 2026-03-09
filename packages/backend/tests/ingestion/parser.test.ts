import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseJsonlFile } from '../../src/ingestion/claude-code-parser.js';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('parseJsonlFile', () => {
  describe('sample-conversation.jsonl', () => {
    it('returns parsed lines with correct types and fields', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'sample-conversation.jsonl'));
      expect(result.sessionId).toBe('session-abc-123');
      expect(result.userMessages).toHaveLength(1);
      expect(result.assistantMessages).toHaveLength(1);
      expect(result.skippedLines).toBe(0);
    });

    it('returns exactly 2 message lines (1 user, 1 assistant)', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'sample-conversation.jsonl'));
      expect(result.userMessages.length + result.assistantMessages.length).toBe(2);
      expect(result.userMessages[0].uuid).toBe('uuid-user-1');
      expect(result.assistantMessages[0].firstUuid).toBe('uuid-asst-1');
    });

    it('preserves string user content as-is', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'sample-conversation.jsonl'));
      expect(result.userMessages[0].content).toBe('What is the meaning of life?');
    });

    it('extracts token usage from single-chunk assistant', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'sample-conversation.jsonl'));
      expect(result.assistantMessages[0].usage).toEqual({
        input_tokens: 50,
        output_tokens: 25,
        cache_read_input_tokens: 10,
        cache_creation_input_tokens: 0,
      });
    });

    it('records all timestamps for createdAt/updatedAt derivation', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'sample-conversation.jsonl'));
      expect(result.timestamps).toHaveLength(2);
      expect(result.timestamps).toContain('2026-01-15T10:00:00.000Z');
      expect(result.timestamps).toContain('2026-01-15T10:00:01.500Z');
    });
  });

  describe('streaming-assistant.jsonl', () => {
    it('groups 3 assistant chunks into 1 reconstructed message with 3 content blocks', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'streaming-assistant.jsonl'));
      expect(result.assistantMessages).toHaveLength(1);
      expect(result.assistantMessages[0].contentBlocks).toHaveLength(3);
      expect(result.assistantMessages[0].messageId).toBe('msg_02Stream');
    });

    it('extracts token usage from the FINAL chunk only (output_tokens: 45)', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'streaming-assistant.jsonl'));
      expect(result.assistantMessages[0].usage).not.toBeNull();
      expect(result.assistantMessages[0].usage!.output_tokens).toBe(45);
      // NOT 8 (chunk 1) or 15 (chunk 2)
    });

    it('uses the uuid of the first chunk for ID derivation', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'streaming-assistant.jsonl'));
      expect(result.assistantMessages[0].firstUuid).toBe('uuid-stream-asst-1');
    });

    it('categorizes content blocks by type (text and thinking)', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'streaming-assistant.jsonl'));
      const blocks = result.assistantMessages[0].contentBlocks;
      expect(blocks[0]).toEqual({ type: 'text', text: 'Hello' });
      expect(blocks[1]).toEqual({ type: 'text', text: ' world' });
      expect(blocks[2]).toEqual({ type: 'thinking', thinking: 'Let me think about what I just said.' });
    });

    it('captures stop reason from the final chunk', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'streaming-assistant.jsonl'));
      expect(result.assistantMessages[0].stopReason).toBe('end_turn');
    });
  });

  describe('malformed-lines.jsonl', () => {
    it('skips invalid JSON lines and returns only valid message lines', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'malformed-lines.jsonl'));
      expect(result.userMessages).toHaveLength(1);
      expect(result.assistantMessages).toHaveLength(1);
    });

    it('counts skipped lines (invalid JSON + empty objects + empty lines)', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'malformed-lines.jsonl'));
      // Line 2: "not valid json {" -> skip (bad JSON)
      // Line 3: "{}" -> skip (valid JSON, no type/not user or assistant)
      // Line 5: empty line -> skip
      expect(result.skippedLines).toBe(3);
    });

    it('does not throw on invalid input', async () => {
      await expect(
        parseJsonlFile(join(FIXTURES, 'malformed-lines.jsonl')),
      ).resolves.toBeDefined();
    });
  });

  describe('empty.jsonl', () => {
    it('returns empty result with zero counts', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'empty.jsonl'));
      expect(result.sessionId).toBeNull();
      expect(result.userMessages).toHaveLength(0);
      expect(result.assistantMessages).toHaveLength(0);
      expect(result.skippedLines).toBe(0);
      expect(result.timestamps).toHaveLength(0);
    });
  });

  describe('tool-use-flow.jsonl', () => {
    it('extracts tool_use blocks from assistant messages', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'tool-use-flow.jsonl'));
      // First assistant message has a tool_use block
      const toolAssistant = result.assistantMessages.find(
        (m) => m.toolUseBlocks.length > 0,
      );
      expect(toolAssistant).toBeDefined();
      expect(toolAssistant!.toolUseBlocks[0].name).toBe('Read');
      expect(toolAssistant!.toolUseBlocks[0].id).toBe('toolu_01TestRead');
    });

    it('matches tool_result from user message to corresponding tool_use by tool_use_id', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'tool-use-flow.jsonl'));
      // Second user message has a tool_result
      const toolUser = result.userMessages.find(
        (m) => m.toolResults.length > 0,
      );
      expect(toolUser).toBeDefined();
      expect(toolUser!.toolResults[0].toolUseId).toBe('toolu_01TestRead');
      expect(toolUser!.toolResults[0].content).toBe('file contents here');
      expect(toolUser!.toolResults[0].isError).toBe(false);
    });

    it('parses all messages in tool use flow', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'tool-use-flow.jsonl'));
      expect(result.userMessages).toHaveLength(2);
      expect(result.assistantMessages).toHaveLength(2);
      expect(result.sessionId).toBe('session-tool-001');
    });
  });

  describe('subagent.jsonl', () => {
    it('parses subagent conversations the same as regular ones', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'subagent.jsonl'));
      expect(result.sessionId).toBe('session-sub-001');
      expect(result.userMessages).toHaveLength(1);
      expect(result.assistantMessages).toHaveLength(1);
    });
  });

  describe('streaming-conversation.jsonl', () => {
    it('produces exactly 1 assistant message from 3 streaming chunks sharing the same message.id', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'streaming-conversation.jsonl'));
      expect(result.assistantMessages).toHaveLength(1);
      expect(result.assistantMessages[0].messageId).toBe('msg_stream_dedup');
    });

    it('uses content blocks from the final chunk (not concatenated from all chunks)', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'streaming-conversation.jsonl'));
      const msg = result.assistantMessages[0];
      // Final chunk has 3 content blocks: text, tool_use, text
      // Without dedup fix, we'd get 1+2+3=6 content blocks (push from all chunks)
      expect(msg.contentBlocks).toHaveLength(3);
      expect(msg.contentBlocks[0]).toEqual({ type: 'text', text: 'Streaming is a technique for processing data' });
      expect(msg.contentBlocks[2]).toEqual({ type: 'text', text: ' incrementally as it arrives.' });
    });

    it('uses tool_use blocks from the final chunk (no duplicates)', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'streaming-conversation.jsonl'));
      const msg = result.assistantMessages[0];
      // Only 1 tool_use block (from the final chunk), not 2 (from chunks 2+3)
      expect(msg.toolUseBlocks).toHaveLength(1);
      expect(msg.toolUseBlocks[0].id).toBe('toolu_dedup_01');
      expect(msg.toolUseBlocks[0].name).toBe('Read');
    });

    it('uses token usage from the chunk with stop_reason only', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'streaming-conversation.jsonl'));
      const msg = result.assistantMessages[0];
      expect(msg.usage).not.toBeNull();
      // Final chunk: output_tokens=30, cache_read=50, cache_creation=10
      expect(msg.usage!.output_tokens).toBe(30);
      expect(msg.usage!.cache_read_input_tokens).toBe(50);
      expect(msg.usage!.cache_creation_input_tokens).toBe(10);
    });
  });

  describe('content handling', () => {
    it('handles user messages with array content (tool_result blocks)', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'tool-use-flow.jsonl'));
      // Second user message has array content with tool_result
      // Its text content should be null since there are no text blocks
      const toolResultUser = result.userMessages.find(
        (m) => m.toolResults.length > 0,
      );
      expect(toolResultUser).toBeDefined();
      expect(toolResultUser!.content).toBeNull();
    });

    it('extracts text from multiple text blocks in assistant content', async () => {
      const result = await parseJsonlFile(join(FIXTURES, 'streaming-assistant.jsonl'));
      // The reconstructed message has text blocks "Hello" and " world" plus a thinking block
      const blocks = result.assistantMessages[0].contentBlocks;
      const textBlocks = blocks.filter((b) => b.type === 'text');
      expect(textBlocks).toHaveLength(2);
    });
  });
});
