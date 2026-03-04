import { describe, it, expect } from 'vitest';
import { normalizeCursorConversation } from '../../src/ingestion/cursor-normalizer.js';
import { generateId } from '../../src/ingestion/id-generator.js';
import type { CursorConversation, CursorBubble } from '../../src/ingestion/cursor-parser.js';

function makeConversation(overrides?: Partial<CursorConversation>): CursorConversation {
  return {
    composerId: 'test-composer-id',
    name: 'Test Conversation',
    createdAt: 1700000000000,
    lastUpdatedAt: 1700000100000,
    status: 'completed',
    isAgentic: false,
    usageData: null,
    modelConfig: { modelName: 'claude-4.5-sonnet' },
    fullConversationHeadersOnly: [],
    ...overrides,
  };
}

function makeBubble(overrides?: Partial<CursorBubble>): CursorBubble {
  return {
    bubbleId: 'bubble-1',
    type: 1,
    text: 'Hello, help me with code',
    createdAt: '2026-01-15T10:00:00Z',
    tokenCount: null,
    modelInfo: null,
    timingInfo: null,
    toolFormerData: null,
    isCapabilityIteration: false,
    capabilityType: null,
    tokenCountUpUntilHere: null,
    ...overrides,
  };
}

describe('normalizeCursorConversation', () => {
  describe('conversation record', () => {
    it('generates deterministic conversation ID from composerId', () => {
      const conv = makeConversation({ composerId: 'abc-123' });
      const bubbles = [makeBubble()];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result).not.toBeNull();
      expect(result!.conversation.id).toBe(generateId('cursor', 'abc-123'));
    });

    it('same input always produces same conversation ID', () => {
      const conv = makeConversation({ composerId: 'deterministic-test' });
      const bubbles = [makeBubble()];
      const r1 = normalizeCursorConversation(conv, bubbles, 'Cursor');
      const r2 = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(r1!.conversation.id).toBe(r2!.conversation.id);
    });

    it('sets agent to "cursor"', () => {
      const conv = makeConversation();
      const bubbles = [makeBubble()];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.agent).toBe('cursor');
    });

    it('sets project from parameter', () => {
      const conv = makeConversation();
      const bubbles = [makeBubble()];
      const result = normalizeCursorConversation(conv, bubbles, 'MyProject');
      expect(result!.conversation.project).toBe('MyProject');
    });

    it('derives title from first user bubble text, truncated to 100 chars', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'A'.repeat(200) }),
        makeBubble({ bubbleId: 'b2', type: 2, text: 'Response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.title).toHaveLength(100);
    });

    it('derives title from first user bubble when shorter than 100', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Short question' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.title).toBe('Short question');
    });

    it('returns null title when no user bubbles exist', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 2, text: 'Only AI response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.title).toBeNull();
    });

    it('normalizes createdAt from ms timestamp', () => {
      const conv = makeConversation({ createdAt: 1700000000000 });
      const bubbles = [makeBubble()];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.createdAt).toBe(new Date(1700000000000).toISOString());
    });

    it('normalizes createdAt from seconds timestamp', () => {
      const conv = makeConversation({ createdAt: 1700000000 });
      const bubbles = [makeBubble()];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.createdAt).toBe(new Date(1700000000000).toISOString());
    });

    it('uses modelConfig.modelName as model', () => {
      const conv = makeConversation({ modelConfig: { modelName: 'gpt-4o' } });
      const bubbles = [makeBubble()];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.model).toBe('gpt-4o');
    });

    it('falls back to most common bubble model when modelConfig is null', () => {
      const conv = makeConversation({ modelConfig: null });
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 2, modelInfo: { modelName: 'claude-4.5-sonnet' } }),
        makeBubble({ bubbleId: 'b2', type: 2, modelInfo: { modelName: 'claude-4.5-sonnet' } }),
        makeBubble({ bubbleId: 'b3', type: 2, modelInfo: { modelName: 'gpt-4o' } }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.model).toBe('claude-4.5-sonnet');
    });
  });

  describe('message records', () => {
    it('maps bubble type 1 to role "user"', () => {
      const conv = makeConversation();
      const bubbles = [makeBubble({ bubbleId: 'b1', type: 1, text: 'User msg' })];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.messages[0].role).toBe('user');
    });

    it('maps bubble type 2 to role "assistant"', () => {
      const conv = makeConversation();
      const bubbles = [makeBubble({ bubbleId: 'b1', type: 2, text: 'AI msg' })];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.messages[0].role).toBe('assistant');
    });

    it('generates deterministic message IDs', () => {
      const conv = makeConversation({ composerId: 'c1' });
      const bubbles = [makeBubble({ bubbleId: 'b1', type: 1 })];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      const expectedConvId = generateId('cursor', 'c1');
      expect(result!.messages[0].id).toBe(generateId(expectedConvId, 'b1'));
    });

    it('sets conversationId on all messages', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1 }),
        makeBubble({ bubbleId: 'b2', type: 2 }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      const convId = result!.conversation.id;
      for (const msg of result!.messages) {
        expect(msg.conversationId).toBe(convId);
      }
    });

    it('sets model only on assistant messages', () => {
      const conv = makeConversation({ modelConfig: { modelName: 'gpt-4o' } });
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: 'AI', modelInfo: { modelName: 'gpt-4o' } }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      const userMsg = result!.messages.find(m => m.role === 'user')!;
      const assistantMsg = result!.messages.find(m => m.role === 'assistant')!;
      expect(userMsg.model).toBeNull();
      expect(assistantMsg.model).toBe('gpt-4o');
    });

    it('handles missing bubble createdAt by falling back to timingInfo.clientStartTime', () => {
      const conv = makeConversation({ createdAt: 1700000000000 });
      const bubbles = [
        makeBubble({
          bubbleId: 'b1',
          type: 2,
          createdAt: null,
          timingInfo: { clientStartTime: 1700000050000 },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.messages[0].createdAt).toBe(new Date(1700000050000).toISOString());
    });

    it('falls back to conversation createdAt when bubble has no timestamps', () => {
      const conv = makeConversation({ createdAt: 1700000000000 });
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, createdAt: null, timingInfo: null }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.messages[0].createdAt).toBe(new Date(1700000000000).toISOString());
    });
  });

  describe('token usage', () => {
    it('extracts token usage from assistant bubbles with non-zero counts', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1 }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          tokenCount: { inputTokens: 500, outputTokens: 200 },
          modelInfo: { modelName: 'claude-4.5-sonnet' },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.tokenUsage).toHaveLength(1);
      expect(result!.tokenUsage[0].inputTokens).toBe(500);
      expect(result!.tokenUsage[0].outputTokens).toBe(200);
      expect(result!.tokenUsage[0].model).toBe('claude-4.5-sonnet');
    });

    it('skips token usage when both inputTokens and outputTokens are 0', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({
          bubbleId: 'b1',
          type: 2,
          tokenCount: { inputTokens: 0, outputTokens: 0 },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.tokenUsage).toHaveLength(0);
    });

    it('skips token usage when tokenCount is null', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 2, tokenCount: null }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.tokenUsage).toHaveLength(0);
    });

    it('does not extract token usage from user bubbles', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({
          bubbleId: 'b1',
          type: 1,
          tokenCount: { inputTokens: 100, outputTokens: 50 },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.tokenUsage).toHaveLength(0);
    });

    it('sets cacheReadTokens and cacheCreationTokens to 0', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({
          bubbleId: 'b1',
          type: 2,
          tokenCount: { inputTokens: 500, outputTokens: 200 },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.tokenUsage[0].cacheReadTokens).toBe(0);
      expect(result!.tokenUsage[0].cacheCreationTokens).toBe(0);
    });

    it('falls back to conv.modelConfig.modelName when bubble modelInfo is null', () => {
      const conv = makeConversation({ modelConfig: { modelName: 'gpt-4o' } });
      const bubbles = [
        makeBubble({
          bubbleId: 'b1',
          type: 2,
          tokenCount: { inputTokens: 100, outputTokens: 50 },
          modelInfo: null,
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.tokenUsage[0].model).toBe('gpt-4o');
    });
  });

  describe('tool-call bubble filtering', () => {
    it('skips type 2 bubbles with isCapabilityIteration=true and no text', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: '', isCapabilityIteration: true, capabilityType: 1 }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'Here is the answer', isCapabilityIteration: false }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.messages).toHaveLength(2); // user + assistant with text
      expect(result!.messages[0].role).toBe('user');
      expect(result!.messages[1].role).toBe('assistant');
      expect(result!.messages[1].content).toBe('Here is the answer');
    });

    it('keeps type 2 bubbles with isCapabilityIteration=true but WITH text', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: 'I read the file and found...', isCapabilityIteration: true }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.messages).toHaveLength(2);
      expect(result!.messages[1].content).toBe('I read the file and found...');
    });

    it('keeps type 2 bubbles with no capability flag and no toolFormerData even with empty text', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: '', isCapabilityIteration: false }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.messages).toHaveLength(2); // both kept (backward compat)
    });

    it('skips type 2 bubbles with toolFormerData and no text even when isCapabilityIteration is false', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          isCapabilityIteration: false,
          toolFormerData: { additionalData: { tool: 5 } },
        }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'Actual response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.messages).toHaveLength(2); // user + assistant with text
      expect(result!.messages[1].content).toBe('Actual response');
    });

    it('does not filter type 1 (user) bubbles regardless of content', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: '' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.messages).toHaveLength(1);
      expect(result!.messages[0].role).toBe('user');
    });
  });

  describe('tokenCountUpUntilHere fallback', () => {
    it('uses tokenCountUpUntilHere delta when tokenCount is zero', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({
          bubbleId: 'b1',
          type: 2,
          text: 'First response',
          tokenCount: { inputTokens: 0, outputTokens: 0 },
          tokenCountUpUntilHere: 500,
          modelInfo: { modelName: 'claude-4.5-sonnet' },
        }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: 'Second response',
          tokenCount: { inputTokens: 0, outputTokens: 0 },
          tokenCountUpUntilHere: 1200,
          modelInfo: { modelName: 'claude-4.5-sonnet' },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.tokenUsage).toHaveLength(2);
      expect(result!.tokenUsage[0].outputTokens).toBe(500);
      expect(result!.tokenUsage[1].outputTokens).toBe(700);
      // Input tokens are 0 for cumulative fallback
      expect(result!.tokenUsage[0].inputTokens).toBe(0);
      expect(result!.tokenUsage[1].inputTokens).toBe(0);
    });

    it('prefers per-bubble tokenCount over tokenCountUpUntilHere', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({
          bubbleId: 'b1',
          type: 2,
          text: 'Response',
          tokenCount: { inputTokens: 100, outputTokens: 50 },
          tokenCountUpUntilHere: 1000,
          modelInfo: { modelName: 'claude-4.5-sonnet' },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.tokenUsage).toHaveLength(1);
      expect(result!.tokenUsage[0].inputTokens).toBe(100);
      expect(result!.tokenUsage[0].outputTokens).toBe(50);
    });
  });

  describe('empty input', () => {
    it('returns null when bubbles array is empty', () => {
      const conv = makeConversation();
      const result = normalizeCursorConversation(conv, [], 'Cursor');
      expect(result).toBeNull();
    });
  });

  describe('deriveTitle XML handling', () => {
    it('skips user bubbles whose text starts with "<"', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: '<system-reminder>Today is March 5</system-reminder>' }),
        makeBubble({ bubbleId: 'b2', type: 1, text: 'How do I set up Vitest?' }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'Response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.title).toBe('How do I set up Vitest?');
    });

    it('picks first plain-text user bubble when mix of XML and plain', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: '<local-command-caveat>Caveat text</local-command-caveat>' }),
        makeBubble({ bubbleId: 'b2', type: 1, text: '<objective>Build a thing</objective>' }),
        makeBubble({ bubbleId: 'b3', type: 1, text: 'What is the best database for this?' }),
        makeBubble({ bubbleId: 'b4', type: 2, text: 'I recommend SQLite' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.title).toBe('What is the best database for this?');
    });

    it('falls back to XML-stripped text when all user bubbles start with "<"', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: '<local-command-caveat>Important warning about commands in the system</local-command-caveat>' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: 'Response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.title).toBe('Important warning about commands in the system');
    });

    it('returns null when all user bubbles are XML and stripped text is <= 10 chars', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: '<tag>Hi</tag>' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: 'Response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.title).toBeNull();
    });

    it('plain-text user bubbles still produce titles as before (no regression)', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Help me refactor this function' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: 'Sure, here is the refactored version' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.title).toBe('Help me refactor this function');
    });
  });

  describe('determinism', () => {
    it('same input always produces same output', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User msg' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: 'AI msg',
          tokenCount: { inputTokens: 100, outputTokens: 50 },
          modelInfo: { modelName: 'claude-4.5-sonnet' },
        }),
      ];
      const r1 = normalizeCursorConversation(conv, bubbles, 'Cursor');
      const r2 = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(r1).toEqual(r2);
    });
  });
});
