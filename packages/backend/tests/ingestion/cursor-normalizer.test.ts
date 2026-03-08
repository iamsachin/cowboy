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
    workspacePath: null,
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
    thinking: null,
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

    it('falls back to assistant text when no user bubbles exist', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 2, text: 'Only AI response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      // Now falls back to assistant text instead of returning null
      expect(result!.conversation.title).toBe('Only AI response');
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

  describe('tool-call bubble handling', () => {
    it('produces merged message with tool summary and response for capability + text bubbles', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: '', isCapabilityIteration: true, capabilityType: 1 }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'Here is the answer', isCapabilityIteration: false }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      // Consecutive assistant bubbles are merged into a single turn
      expect(result!.messages).toHaveLength(2); // user + merged assistant
      expect(result!.messages[0].role).toBe('user');
      expect(result!.messages[1].content).toContain('tool call');
      expect(result!.messages[1].content).toContain('Here is the answer');
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

    it('produces merged message with tool summary and response for toolFormerData + text bubbles', () => {
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
      // Consecutive assistant bubbles are merged into a single turn
      expect(result!.messages).toHaveLength(2); // user + merged assistant
      expect(result!.messages[1].content).toContain('tool call');
      expect(result!.messages[1].content).toContain('Actual response');
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

    it('falls back to assistant text when all user bubbles are XML with short stripped text', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: '<tag>Hi</tag>' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: 'Response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      // Now falls back to assistant text instead of returning null
      expect(result!.conversation.title).toBe('Response');
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

  describe('deriveTitle skip patterns', () => {
    it('skips "Caveat:" messages and picks next real message', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Caveat: The messages below were sent during a previous conversation.' }),
        makeBubble({ bubbleId: 'b2', type: 1, text: 'How do I use vitest?' }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'Response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.title).toBe('How do I use vitest?');
    });

    it('skips "[Request interrupted" messages and picks next real message', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: '[Request interrupted by user for tool use]' }),
        makeBubble({ bubbleId: 'b2', type: 1, text: 'Fix the login bug' }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'Response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.title).toBe('Fix the login bug');
    });

    it('skips "/clear" messages and picks next real message', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: '/clear' }),
        makeBubble({ bubbleId: 'b2', type: 1, text: 'What is TypeScript?' }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'Response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.title).toBe('What is TypeScript?');
    });

    it('falls back to assistant bubble text when all user bubbles are system content', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Caveat: some caveat text here' }),
        makeBubble({ bubbleId: 'b2', type: 1, text: '/gsd:plan-phase' }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'Here is my analysis of the code' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.title).toBe('Here is my analysis of the code');
    });
  });

  describe('model "default" handling', () => {
    it('returns "unknown" when modelConfig.modelName is "default" and no bubble has real model', () => {
      const conv = makeConversation({ modelConfig: { modelName: 'default' } });
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Hello' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: 'Response', modelInfo: null }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.model).toBe('unknown');
    });

    it('returns actual model from bubbles when modelConfig is "default" but bubbles have real models', () => {
      const conv = makeConversation({ modelConfig: { modelName: 'default' } });
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Hello' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: 'Response', modelInfo: { modelName: 'claude-4.5-sonnet' } }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'More', modelInfo: { modelName: 'claude-4.5-sonnet' } }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.model).toBe('claude-4.5-sonnet');
    });

    it('returns "unknown" when modelConfig is "default" and bubbles also have "default" model', () => {
      const conv = makeConversation({ modelConfig: { modelName: 'default' } });
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 2, text: 'Response', modelInfo: { modelName: 'default' } }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.model).toBe('unknown');
    });

    it('per-message model replaces "default" with "unknown"', () => {
      const conv = makeConversation({ modelConfig: { modelName: 'default' } });
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 2, text: 'Response', modelInfo: null }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      const assistantMsg = result!.messages.find(m => m.role === 'assistant');
      expect(assistantMsg!.model).toBe('unknown');
    });

    it('per-message model uses actual model from bubble when available', () => {
      const conv = makeConversation({ modelConfig: { modelName: 'default' } });
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 2, text: 'Response', modelInfo: { modelName: 'gpt-4o' } }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      const assistantMsg = result!.messages.find(m => m.role === 'assistant');
      expect(assistantMsg!.model).toBe('gpt-4o');
    });
  });

  describe('assistant content extraction', () => {
    it('produces message with text content (not null) for assistant bubble with text', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: 'Here is my detailed response about the code' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      const assistantMsg = result!.messages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg!.content).toBe('Here is my detailed response about the code');
      expect(assistantMsg!.content).not.toBeNull();
    });

    it('produces tool activity summary for empty assistant bubble with capability iteration', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: '', isCapabilityIteration: true, capabilityType: 1 }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      // Should NOT skip entirely -- should produce a message with tool activity summary
      const assistantMsgs = result!.messages.filter(m => m.role === 'assistant');
      expect(assistantMsgs).toHaveLength(1);
      expect(assistantMsgs[0].content).toContain('tool');
      expect(assistantMsgs[0].content).not.toBeNull();
    });

    it('produces tool activity summary for empty assistant bubble with toolFormerData', () => {
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
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      const assistantMsgs = result!.messages.filter(m => m.role === 'assistant');
      expect(assistantMsgs).toHaveLength(1);
      expect(assistantMsgs[0].content).toContain('tool');
      expect(assistantMsgs[0].content).not.toBeNull();
    });

    it('groups consecutive tool-only assistant bubbles into a single merged message with text', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: '', isCapabilityIteration: true, capabilityType: 1 }),
        makeBubble({ bubbleId: 'b3', type: 2, text: '', isCapabilityIteration: true, capabilityType: 2 }),
        makeBubble({ bubbleId: 'b4', type: 2, text: '', isCapabilityIteration: true, capabilityType: 1 }),
        makeBubble({ bubbleId: 'b5', type: 2, text: 'Here is the answer' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      // All consecutive assistant bubbles merge into a single turn
      const assistantMsgs = result!.messages.filter(m => m.role === 'assistant');
      expect(assistantMsgs).toHaveLength(1); // single merged message
      expect(assistantMsgs[0].content).toMatch(/3 tool/);
      expect(assistantMsgs[0].content).toContain('Here is the answer');
    });
  });

  describe('thinking extraction', () => {
    it('extracts thinking from capabilityType=30 bubble into message.thinking', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 30,
          thinking: { text: 'Let me reason about this carefully' },
        }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'Here is the answer' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      // After merging, the assistant turn should have thinking content
      const assistantMsgs = result!.messages.filter(m => m.role === 'assistant');
      const thinkingMsg = assistantMsgs.find(m => m.thinking !== null);
      expect(thinkingMsg).toBeDefined();
      expect(thinkingMsg!.thinking).toContain('Let me reason about this carefully');
    });

    it('extracts thinking alongside regular text when both present', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: 'Here is the response',
          thinking: { text: 'I need to think about this' },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      const assistantMsg = result!.messages.find(m => m.role === 'assistant');
      expect(assistantMsg!.content).toContain('Here is the response');
      expect(assistantMsg!.thinking).toBe('I need to think about this');
    });
  });

  describe('capabilityType-based tool detection', () => {
    it('classifies capabilityType=15 empty-text bubble as tool-only even when isCapabilityIteration=false', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          isCapabilityIteration: false,
          capabilityType: 15,
        }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'Actual response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      // The capabilityType=15 bubble should be treated as tool-only
      const assistantMsgs = result!.messages.filter(m => m.role === 'assistant');
      // Should have merged result with tool summary and actual response
      expect(assistantMsgs.length).toBeGreaterThanOrEqual(1);
      // The final content should contain the actual response, not just "Executed tool call"
      const hasActualResponse = assistantMsgs.some(m => m.content?.includes('Actual response'));
      expect(hasActualResponse).toBe(true);
    });

    it('does NOT treat capabilityType=30 thinking bubble with thinking.text as tool-only', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 30,
          isCapabilityIteration: false,
          thinking: { text: 'Deep reasoning here' },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      // The thinking bubble should NOT be classified as tool-only
      const assistantMsgs = result!.messages.filter(m => m.role === 'assistant');
      expect(assistantMsgs).toHaveLength(1);
      expect(assistantMsgs[0].thinking).toBe('Deep reasoning here');
    });

    it('final response bubble (type=2, no capabilityType, text="actual response") produces message with real content', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: 'Here is my detailed answer to your question' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      const assistantMsg = result!.messages.find(m => m.role === 'assistant');
      expect(assistantMsg!.content).toBe('Here is my detailed answer to your question');
    });
  });

  describe('consecutive assistant bubble merging', () => {
    it('merges thinking + tool calls + response into a single logical turn', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        // Thinking bubble
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 30,
          thinking: { text: 'Let me think...' },
        }),
        // Tool call bubbles
        makeBubble({
          bubbleId: 'b3',
          type: 2,
          text: '',
          capabilityType: 15,
          isCapabilityIteration: false,
        }),
        makeBubble({
          bubbleId: 'b4',
          type: 2,
          text: '',
          capabilityType: 15,
          isCapabilityIteration: false,
        }),
        // Final response
        makeBubble({ bubbleId: 'b5', type: 2, text: 'Here is the answer' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      // Should produce: 1 user message + 1 merged assistant message
      expect(result!.messages).toHaveLength(2);
      expect(result!.messages[0].role).toBe('user');
      expect(result!.messages[1].role).toBe('assistant');
      expect(result!.messages[1].content).toContain('Here is the answer');
      expect(result!.messages[1].thinking).toContain('Let me think...');
    });

    it('produces tool summary when all assistant bubbles are tool-only (no text response)', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 15,
          isCapabilityIteration: false,
        }),
        makeBubble({
          bubbleId: 'b3',
          type: 2,
          text: '',
          capabilityType: 15,
          isCapabilityIteration: false,
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      const assistantMsgs = result!.messages.filter(m => m.role === 'assistant');
      expect(assistantMsgs).toHaveLength(1);
      expect(assistantMsgs[0].content).toContain('tool');
      expect(assistantMsgs[0].content).toContain('2');
    });

    it('empty conversations (all bubbles empty-text capability) still produce a conversation (not null)', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({
          bubbleId: 'b1',
          type: 2,
          text: '',
          capabilityType: 15,
          isCapabilityIteration: false,
        }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 15,
          isCapabilityIteration: false,
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result).not.toBeNull();
      expect(result!.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('keeps intermediary assistant bubbles with text in the merged turn', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: 'Running compiler...' }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'Build successful. Here is the result.' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      // Consecutive assistant bubbles should be merged
      expect(result!.messages).toHaveLength(2); // user + merged assistant
      expect(result!.messages[1].content).toContain('Running compiler...');
      expect(result!.messages[1].content).toContain('Build successful');
    });

    it('accumulates thinking from multiple thinking bubbles in same turn', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 30,
          thinking: { text: 'First thought' },
        }),
        makeBubble({
          bubbleId: 'b3',
          type: 2,
          text: '',
          capabilityType: 30,
          thinking: { text: 'Second thought' },
        }),
        makeBubble({ bubbleId: 'b4', type: 2, text: 'Final answer' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.messages).toHaveLength(2);
      expect(result!.messages[1].thinking).toContain('First thought');
      expect(result!.messages[1].thinking).toContain('Second thought');
      expect(result!.messages[1].content).toContain('Final answer');
    });
  });

  describe('tool call extraction', () => {
    it('extracts tool call from toolFormerData with name/params/result/status', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'User question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          isCapabilityIteration: true,
          capabilityType: 1,
          toolFormerData: {
            name: 'read_file_v2',
            status: 'completed',
            params: '{"path":"/src/index.ts"}',
            result: '{"content":"file contents here"}',
            toolCallId: 'tool_abc123',
          },
        }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'Here is the file content' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.toolCalls).toHaveLength(1);
      expect(result!.toolCalls[0].name).toBe('read_file_v2');
      expect(result!.toolCalls[0].status).toBe('success');
      expect(result!.toolCalls[0].input).toEqual({ path: '/src/index.ts' });
      expect(result!.toolCalls[0].output).toEqual({ content: 'file contents here' });
      expect(result!.toolCalls[0].duration).toBeNull();
    });

    it('parses params and result JSON strings into objects for input/output', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 1,
          toolFormerData: {
            name: 'edit_file_v2',
            status: 'completed',
            params: '{"file":"test.ts","changes":[1,2,3]}',
            result: '{"success":true}',
          },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.toolCalls[0].input).toEqual({ file: 'test.ts', changes: [1, 2, 3] });
      expect(result!.toolCalls[0].output).toEqual({ success: true });
    });

    it('tool call messageId matches the merged assistant message ID', () => {
      const conv = makeConversation({ composerId: 'comp-1' });
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 1,
          toolFormerData: { name: 'read_file_v2', status: 'completed', params: '{}', result: '{}' },
        }),
        makeBubble({ bubbleId: 'b3', type: 2, text: 'Response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      const convId = result!.conversation.id;
      // The merged message uses the first bubble in the assistant group (b2)
      const expectedMsgId = generateId(convId, 'b2');
      expect(result!.toolCalls[0].messageId).toBe(expectedMsgId);
      // Verify it matches the actual message
      const assistantMsg = result!.messages.find(m => m.role === 'assistant');
      expect(result!.toolCalls[0].messageId).toBe(assistantMsg!.id);
    });

    it('multiple tool-only bubbles in one turn each produce separate tool call records', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 1,
          toolFormerData: { name: 'read_file_v2', status: 'completed', params: '{"path":"a.ts"}', result: '"ok"' },
        }),
        makeBubble({
          bubbleId: 'b3',
          type: 2,
          text: '',
          capabilityType: 1,
          toolFormerData: { name: 'edit_file_v2', status: 'completed', params: '{"path":"b.ts"}', result: '"done"' },
        }),
        makeBubble({
          bubbleId: 'b4',
          type: 2,
          text: '',
          capabilityType: 1,
          toolFormerData: { name: 'glob_file_search', status: 'completed', params: '{"pattern":"*.ts"}', result: '["a.ts","b.ts"]' },
        }),
        makeBubble({ bubbleId: 'b5', type: 2, text: 'Done editing' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.toolCalls).toHaveLength(3);
      expect(result!.toolCalls.map(tc => tc.name)).toEqual(['read_file_v2', 'edit_file_v2', 'glob_file_search']);
    });

    it('toolFormerData with null/missing fields gracefully produces tool call with nulls', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 1,
          toolFormerData: { name: 'run_terminal_command_v2' },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.toolCalls).toHaveLength(1);
      expect(result!.toolCalls[0].name).toBe('run_terminal_command_v2');
      expect(result!.toolCalls[0].input).toBeNull();
      expect(result!.toolCalls[0].output).toBeNull();
      expect(result!.toolCalls[0].status).toBeNull();
    });

    it('bubbles without toolFormerData produce no tool calls', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Question' }),
        makeBubble({ bubbleId: 'b2', type: 2, text: 'Just a regular response' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.toolCalls).toHaveLength(0);
    });

    it('uses rawArgs as fallback when params is missing/null', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 1,
          toolFormerData: {
            name: 'web_search',
            status: 'completed',
            rawArgs: '{"query":"typescript generics"}',
            result: '{"results":[]}',
          },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.toolCalls).toHaveLength(1);
      expect(result!.toolCalls[0].input).toEqual({ query: 'typescript generics' });
    });

    it('maps status "completed" to "success" and "error" to "error"', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 1,
          toolFormerData: { name: 'read_file_v2', status: 'completed', params: '{}', result: '{}' },
        }),
        makeBubble({
          bubbleId: 'b3',
          type: 2,
          text: '',
          capabilityType: 1,
          toolFormerData: { name: 'edit_file_v2', status: 'error', params: '{}', result: '"failed"' },
        }),
        makeBubble({ bubbleId: 'b4', type: 2, text: 'Done' }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.toolCalls[0].status).toBe('success');
      expect(result!.toolCalls[1].status).toBe('error');
    });

    it('falls back to raw string when result is not valid JSON', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 1,
          toolFormerData: {
            name: 'run_terminal_command_v2',
            status: 'completed',
            params: '{"cmd":"ls"}',
            result: 'not valid json output',
          },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.toolCalls[0].output).toBe('not valid json output');
    });

    it('sets conversationId on all tool calls', () => {
      const conv = makeConversation();
      const bubbles = [
        makeBubble({ bubbleId: 'b1', type: 1, text: 'Question' }),
        makeBubble({
          bubbleId: 'b2',
          type: 2,
          text: '',
          capabilityType: 1,
          toolFormerData: { name: 'read_file_v2', status: 'completed', params: '{}', result: '{}' },
        }),
      ];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.toolCalls[0].conversationId).toBe(result!.conversation.id);
    });
  });

  describe('workspace path derivation', () => {
    it('extracts workspace path from conversation and uses last segment as project', () => {
      const conv = makeConversation({ workspacePath: '/Users/sachin/Desktop/myapp' } as any);
      const bubbles = [makeBubble()];
      const result = normalizeCursorConversation(conv, bubbles, 'myapp');
      expect(result!.conversation.project).toBe('myapp');
    });

    it('falls back to Cursor when workspacePath is null', () => {
      const conv = makeConversation({ workspacePath: null } as any);
      const bubbles = [makeBubble()];
      const result = normalizeCursorConversation(conv, bubbles, 'Cursor');
      expect(result!.conversation.project).toBe('Cursor');
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
