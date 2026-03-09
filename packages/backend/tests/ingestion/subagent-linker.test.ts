import { describe, it, expect } from 'vitest';
import { extractAgentId, linkSubagents } from '../../src/ingestion/subagent-linker.js';
import { summarizeSubagent } from '../../src/ingestion/subagent-summarizer.js';
import type { ParseResult } from '../../src/ingestion/claude-code-parser.js';
import type { DiscoveredFile } from '../../src/ingestion/types.js';

// ── extractAgentId ──────────────────────────────────────────────────────

describe('extractAgentId', () => {
  it('extracts agentId from standard tool_result output', () => {
    const output = 'agentId: a9edf55ff52582e6c (for resuming to continue this agent\'s work if needed)';
    expect(extractAgentId(output)).toBe('a9edf55ff52582e6c');
  });

  it('returns null for non-matching text', () => {
    expect(extractAgentId('some random output')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(extractAgentId(null)).toBeNull();
    expect(extractAgentId(undefined)).toBeNull();
    expect(extractAgentId(42)).toBeNull();
    expect(extractAgentId({ key: 'value' })).toBeNull();
  });

  it('extracts agentId from multiline text', () => {
    const output = '## PLAN COMPLETE\n**Plan:** 11-01\n**Tasks:** 2/2\nagentId: abc123def456 (for resuming)\n<usage>total_tokens: 59652</usage>';
    expect(extractAgentId(output)).toBe('abc123def456');
  });

  it('extracts agentId with varying whitespace', () => {
    expect(extractAgentId('agentId:  a1b2c3d4')).toBe('a1b2c3d4');
    expect(extractAgentId('agentId:a1b2c3d4')).toBe('a1b2c3d4');
  });
});

// ── buildToolResultLookup concatenation ────────────────────────────────
// This is tested indirectly via normalizer - we test the normalizer behavior

describe('buildToolResultLookup concatenation', () => {
  // We import normalizeConversation to test that multiple tool_results
  // for the same toolUseId are concatenated
  it('is tested via normalizer integration', async () => {
    const { normalizeConversation } = await import('../../src/ingestion/normalizer.js');

    // Build a ParseResult with two tool_results for the same tool_use_id
    const parseResult: ParseResult = {
      sessionId: 'test-session',
      userMessages: [
        {
          uuid: 'user-1',
          timestamp: '2024-01-01T00:00:00Z',
          content: 'run a task',
          toolResults: [
            {
              toolUseId: 'tool-use-1',
              content: 'First result block',
              isError: false,
            },
            {
              toolUseId: 'tool-use-1',
              content: 'agentId: abc123 (for resuming)',
              isError: false,
            },
          ],
        },
      ],
      assistantMessages: [
        {
          firstUuid: 'asst-1',
          messageId: 'msg-asst-1',
          timestamp: '2024-01-01T00:00:01Z',
          model: 'claude-3-opus',
          contentBlocks: [],
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tool-use-1',
              name: 'Task',
              input: { description: 'Do something' },
            },
          ],
          usage: null,
          stopReason: 'end_turn',
        },
      ],
      compactionEvents: [],
      skippedLines: 0,
      timestamps: ['2024-01-01T00:00:00Z', '2024-01-01T00:00:01Z'],
    };

    const result = normalizeConversation(parseResult, 'test-project');
    expect(result).not.toBeNull();

    // The tool call output should contain BOTH results concatenated
    const taskToolCall = result!.toolCalls.find(tc => tc.name === 'Task');
    expect(taskToolCall).toBeDefined();
    expect(taskToolCall!.output).toContain('First result block');
    expect(taskToolCall!.output).toContain('agentId: abc123');
  });
});

// ── linkSubagents ──────────────────────────────────────────────────────

describe('linkSubagents', () => {
  const makeParentFile = (sessionId: string): DiscoveredFile => ({
    filePath: `/path/${sessionId}.jsonl`,
    projectDir: 'test-project',
    isSubagent: false,
    sessionId,
  });

  const makeSubagentFile = (agentId: string): DiscoveredFile => ({
    filePath: `/path/${agentId}.jsonl`,
    projectDir: 'test-project',
    isSubagent: true,
    sessionId: agentId,
  });

  it('matches by agentId (high confidence)', async () => {
    const parentFiles = [makeParentFile('parent-session-1')];
    const subagentFiles = [makeSubagentFile('abc123')];

    const getToolCalls = (convId: string) => {
      if (convId === 'conv-parent-session-1') {
        return [
          {
            id: 'tc-1',
            name: 'Task',
            input: { description: 'Do something' },
            output: 'Result text\nagentId: abc123 (for resuming)',
            createdAt: '2024-01-01T00:00:01Z',
          },
        ];
      }
      return [];
    };

    const getConversationId = (sessionId: string) => {
      return `conv-${sessionId}`;
    };

    const results = await linkSubagents({
      parentFiles,
      subagentFiles,
      getToolCalls,
      getConversationId,
    });

    expect(results).toHaveLength(1);
    expect(results[0].toolCallId).toBe('tc-1');
    expect(results[0].subagentConversationId).toBe('conv-abc123');
    expect(results[0].parentConversationId).toBe('conv-parent-session-1');
    expect(results[0].matchConfidence).toBe('high');
  });

  it('falls back to description matching (medium confidence)', async () => {
    const parentFiles = [makeParentFile('parent-session-2')];
    const subagentFiles = [makeSubagentFile('xyz789')];

    const getToolCalls = (convId: string) => {
      if (convId === 'conv-parent-session-2') {
        return [
          {
            id: 'tc-2',
            name: 'Agent',
            input: { description: 'Fix the login bug' },
            output: 'Some result without agentId',
            createdAt: '2024-01-01T00:00:01Z',
          },
        ];
      }
      return [];
    };

    const getConversationId = (sessionId: string) => `conv-${sessionId}`;

    const getFirstUserMessage = (conversationId: string) => {
      if (conversationId === 'conv-xyz789') {
        return 'Fix the login bug';
      }
      return null;
    };

    const results = await linkSubagents({
      parentFiles,
      subagentFiles,
      getToolCalls,
      getConversationId,
      getFirstUserMessage,
    });

    expect(results).toHaveLength(1);
    expect(results[0].toolCallId).toBe('tc-2');
    expect(results[0].matchConfidence).toBe('medium');
  });

  it('falls back to positional matching (low confidence)', async () => {
    const parentFiles = [makeParentFile('parent-session-3')];
    const subagentFiles = [makeSubagentFile('pos123')];

    const getToolCalls = (convId: string) => {
      if (convId === 'conv-parent-session-3') {
        return [
          {
            id: 'tc-3',
            name: 'Task',
            input: { description: 'Something completely different' },
            output: 'No agentId here',
            createdAt: '2024-01-01T00:00:01Z',
          },
        ];
      }
      return [];
    };

    const getConversationId = (sessionId: string) => `conv-${sessionId}`;

    const getFirstUserMessage = (conversationId: string) => {
      if (conversationId === 'conv-pos123') {
        return 'Totally unrelated text that does not match description at all';
      }
      return null;
    };

    const results = await linkSubagents({
      parentFiles,
      subagentFiles,
      getToolCalls,
      getConversationId,
      getFirstUserMessage,
    });

    expect(results).toHaveLength(1);
    expect(results[0].toolCallId).toBe('tc-3');
    expect(results[0].matchConfidence).toBe('low');
  });

  it('skips acompact- prefixed subagent files', async () => {
    const parentFiles = [makeParentFile('parent-session-4')];
    const subagentFiles = [makeSubagentFile('acompact-abc123')];

    const getToolCalls = () => [];
    const getConversationId = (sessionId: string) => `conv-${sessionId}`;

    const results = await linkSubagents({
      parentFiles,
      subagentFiles,
      getToolCalls,
      getConversationId,
    });

    expect(results).toHaveLength(0);
  });

  it('matches multiple subagents to different tool calls', async () => {
    const parentFiles = [makeParentFile('parent-multi')];
    const subagentFiles = [
      makeSubagentFile('agent1'),
      makeSubagentFile('agent2'),
    ];

    const getToolCalls = (convId: string) => {
      if (convId === 'conv-parent-multi') {
        return [
          {
            id: 'tc-a',
            name: 'Task',
            input: { description: 'First task' },
            output: 'agentId: agent1 (for resuming)',
            createdAt: '2024-01-01T00:00:01Z',
          },
          {
            id: 'tc-b',
            name: 'Agent',
            input: { description: 'Second task' },
            output: 'agentId: agent2 (for resuming)',
            createdAt: '2024-01-01T00:00:02Z',
          },
        ];
      }
      return [];
    };

    const getConversationId = (sessionId: string) => `conv-${sessionId}`;

    const results = await linkSubagents({
      parentFiles,
      subagentFiles,
      getToolCalls,
      getConversationId,
    });

    expect(results).toHaveLength(2);
    expect(results.find(r => r.toolCallId === 'tc-a')?.subagentConversationId).toBe('conv-agent1');
    expect(results.find(r => r.toolCallId === 'tc-b')?.subagentConversationId).toBe('conv-agent2');
  });
});

// ── summarizeSubagent ──────────────────────────────────────────────────

describe('summarizeSubagent', () => {
  it('extracts tool breakdown, files touched, status, duration, tokens, and errors', () => {
    const parseResult: ParseResult = {
      sessionId: 'subagent-session',
      userMessages: [
        {
          uuid: 'u1',
          timestamp: '2024-01-01T00:00:00Z',
          content: 'Do a task',
          toolResults: [
            { toolUseId: 'tu-1', content: 'file content here', isError: false },
            { toolUseId: 'tu-2', content: 'search results', isError: false },
            { toolUseId: 'tu-3', content: 'Error: file not found', isError: true },
          ],
        },
      ],
      assistantMessages: [
        {
          firstUuid: 'a1',
          messageId: 'msg-a1',
          timestamp: '2024-01-01T00:00:01Z',
          model: 'claude-3-opus',
          contentBlocks: [{ type: 'text', text: 'Let me read the file.' }],
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tu-1',
              name: 'Read',
              input: { file_path: '/src/index.ts' },
            },
            {
              type: 'tool_use',
              id: 'tu-2',
              name: 'Grep',
              input: { pattern: 'foo', path: '/src' },
            },
          ],
          usage: { input_tokens: 1000, output_tokens: 500 },
          stopReason: 'end_turn',
        },
        {
          firstUuid: 'a2',
          messageId: 'msg-a2',
          timestamp: '2024-01-01T00:00:10Z',
          model: 'claude-3-opus',
          contentBlocks: [{ type: 'text', text: 'Now writing.' }],
          toolUseBlocks: [
            {
              type: 'tool_use',
              id: 'tu-3',
              name: 'Write',
              input: { file_path: '/src/utils.ts', content: 'hello' },
            },
          ],
          usage: { input_tokens: 2000, output_tokens: 800 },
          stopReason: 'end_turn',
        },
      ],
      compactionEvents: [],
      skippedLines: 0,
      timestamps: ['2024-01-01T00:00:00Z', '2024-01-01T00:00:01Z', '2024-01-01T00:00:10Z'],
    };

    const summary = summarizeSubagent(parseResult);

    // Tool breakdown
    expect(summary.toolBreakdown).toEqual({ Read: 1, Grep: 1, Write: 1 });
    expect(summary.totalToolCalls).toBe(3);

    // Files touched
    expect(summary.filesTouched).toContain('/src/index.ts');
    expect(summary.filesTouched).toContain('/src/utils.ts');

    // Status: last tool_result has isError=true -> 'error'
    expect(summary.status).toBe('error');

    // Duration: 10 seconds = 10000ms
    expect(summary.durationMs).toBe(10000);

    // Tokens
    expect(summary.inputTokens).toBe(3000);
    expect(summary.outputTokens).toBe(1300);

    // Last error
    expect(summary.lastError).toBe('Error: file not found');
  });

  it('returns success status when no errors', () => {
    const parseResult: ParseResult = {
      sessionId: 'good-subagent',
      userMessages: [
        {
          uuid: 'u1',
          timestamp: '2024-01-01T00:00:00Z',
          content: 'Do a task',
          toolResults: [
            { toolUseId: 'tu-1', content: 'ok', isError: false },
          ],
        },
      ],
      assistantMessages: [
        {
          firstUuid: 'a1',
          messageId: 'msg-a1',
          timestamp: '2024-01-01T00:00:05Z',
          model: 'claude-3-opus',
          contentBlocks: [{ type: 'text', text: 'Done.' }],
          toolUseBlocks: [
            { type: 'tool_use', id: 'tu-1', name: 'Read', input: { file_path: '/a.ts' } },
          ],
          usage: { input_tokens: 500, output_tokens: 200 },
          stopReason: 'end_turn',
        },
      ],
      compactionEvents: [],
      skippedLines: 0,
      timestamps: ['2024-01-01T00:00:00Z', '2024-01-01T00:00:05Z'],
    };

    const summary = summarizeSubagent(parseResult);
    expect(summary.status).toBe('success');
    expect(summary.lastError).toBeNull();
  });

  it('returns interrupted status when conversation appears truncated', () => {
    const parseResult: ParseResult = {
      sessionId: 'truncated-subagent',
      userMessages: [
        {
          uuid: 'u1',
          timestamp: '2024-01-01T00:00:00Z',
          content: 'Do a task',
          toolResults: [],
        },
      ],
      assistantMessages: [],
      compactionEvents: [],
      skippedLines: 0,
      timestamps: ['2024-01-01T00:00:00Z'],
    };

    const summary = summarizeSubagent(parseResult);
    expect(summary.status).toBe('interrupted');
  });
});
