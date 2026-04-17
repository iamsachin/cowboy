import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GroupedTurn, UserTurn, AssistantGroup, CompactionTurn, SystemGroup, SlashCommandTurn, ClearDividerTurn, AgentPromptTurn } from '../../src/composables/useGroupedTurns';
import { extractTimelineEvents, useTimeline, _resetTimelineState } from '../../src/composables/useTimeline';
import type { ToolCallRow, SubagentSummary } from '../../src/types/api';

// Factory helpers
function makeUserTurn(id: string, content: string): UserTurn {
  return {
    type: 'user',
    message: {
      id,
      role: 'user',
      content,
      thinking: null,
      model: null,
      createdAt: '2024-01-01T00:00:00Z',
    },
  };
}

function makeAssistantGroup(
  firstMsgId: string,
  model: string | null,
  toolCallCount: number,
): AssistantGroup {
  return {
    type: 'assistant-group',
    turns: [
      {
        type: 'assistant',
        message: {
          id: firstMsgId,
          role: 'assistant',
          content: 'response',
          thinking: null,
          model,
          createdAt: '2024-01-01T00:01:00Z',
        },
        toolCalls: [],
      },
    ],
    model,
    messageCount: 1,
    toolCallCount,
    firstTimestamp: '2024-01-01T00:01:00Z',
    lastTimestamp: '2024-01-01T00:01:30Z',
  };
}

function makeCompactionTurn(
  id: string,
  tokensBefore: number | null,
  tokensAfter: number | null,
): CompactionTurn {
  return {
    type: 'compaction',
    id,
    timestamp: '2024-01-01T00:02:00Z',
    summary: 'Summarized context',
    tokensBefore,
    tokensAfter,
  };
}

function makeSystemGroup(): SystemGroup {
  return {
    type: 'system-group',
    messages: [{ id: 's1', role: 'user', content: '<system-reminder>test</system-reminder>', thinking: null, model: null, createdAt: '2024-01-01T00:00:30Z' }],
    categories: ['system-reminder'],
    count: 1,
  };
}

function makeSlashCommand(): SlashCommandTurn {
  return {
    type: 'slash-command',
    message: { id: 'sc1', role: 'user', content: '/gsd:execute', thinking: null, model: null, createdAt: '2024-01-01T00:00:30Z' },
    commandText: '/gsd:execute',
  };
}

function makeClearDivider(): ClearDividerTurn {
  return {
    type: 'clear-divider',
    message: { id: 'cd1', role: 'user', content: '/clear', thinking: null, model: null, createdAt: '2024-01-01T00:00:30Z' },
  };
}

function makeAgentPrompt(): AgentPromptTurn {
  return {
    type: 'agent-prompt',
    message: { id: 'ap1', role: 'user', content: 'agent prompt', thinking: null, model: null, createdAt: '2024-01-01T00:00:30Z' },
    description: 'test agent',
  };
}

function makeAssistantGroupWithSubagent(
  msgId: string,
  tcId: string,
  toolName: 'Task' | 'Agent',
  overrides: Partial<ToolCallRow> & { description?: string } = {},
): AssistantGroup {
  const { description, ...tcOverrides } = overrides;
  const tc: ToolCallRow = {
    id: tcId,
    messageId: msgId,
    name: toolName,
    input: { description: description ?? 'Fix login bug' },
    output: null,
    status: null,
    duration: null,
    createdAt: '2024-01-01T00:01:00Z',
    subagentConversationId: null,
    subagentSummary: null,
    subagentLinkAttempted: false,
    ...tcOverrides,
  };
  return {
    type: 'assistant-group',
    turns: [
      {
        type: 'assistant',
        message: {
          id: msgId,
          role: 'assistant',
          content: '',
          thinking: null,
          model: 'Opus 4',
          createdAt: '2024-01-01T00:01:00Z',
        },
        toolCalls: [tc],
      },
    ],
    model: 'Opus 4',
    messageCount: 1,
    toolCallCount: 1,
    firstTimestamp: '2024-01-01T00:01:00Z',
    lastTimestamp: '2024-01-01T00:01:00Z',
  };
}

function makeSubagentSummary(status: 'success' | 'error' | 'interrupted'): SubagentSummary {
  return {
    toolBreakdown: {},
    filesTouched: [],
    totalToolCalls: 0,
    status,
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    lastError: null,
    matchConfidence: 'high',
  };
}

describe('extractTimelineEvents', () => {
  it('returns only user, assistant-group, and compaction events from mixed input', () => {
    const turns: GroupedTurn[] = [
      makeUserTurn('u1', 'Hello world'),
      makeSystemGroup(),
      makeAssistantGroup('a1', 'Opus 4', 3),
      makeSlashCommand(),
      makeClearDivider(),
      makeAgentPrompt(),
      makeCompactionTurn('c1', 20000, 8000),
    ];

    const events = extractTimelineEvents(turns);
    expect(events).toHaveLength(3);
    expect(events.map(e => e.type)).toEqual(['user', 'assistant-group', 'compaction']);
  });

  it('user event label truncates at 30 chars with ellipsis', () => {
    const longContent = 'This is a very long message that should be truncated';
    const turns: GroupedTurn[] = [makeUserTurn('u1', longContent)];
    const events = extractTimelineEvents(turns);
    expect(events[0].label).toBe('This is a very long message th...');
    expect(events[0].label.length).toBe(33); // 30 chars + '...'
  });

  it('user event label is not truncated when <= 30 chars', () => {
    const shortContent = 'Hello';
    const turns: GroupedTurn[] = [makeUserTurn('u1', shortContent)];
    const events = extractTimelineEvents(turns);
    expect(events[0].label).toBe('Hello');
  });

  it('assistant-group label shows model and tool count', () => {
    const turns: GroupedTurn[] = [makeAssistantGroup('a1', 'Opus 4', 3)];
    const events = extractTimelineEvents(turns);
    expect(events[0].label).toBe('Opus 4 \u00b7 3 tools');
  });

  it('assistant-group label shows singular "tool" for count of 1', () => {
    const turns: GroupedTurn[] = [makeAssistantGroup('a1', 'Opus 4', 1)];
    const events = extractTimelineEvents(turns);
    expect(events[0].label).toBe('Opus 4 \u00b7 1 tool');
  });

  it('assistant-group label omits tools when count is 0', () => {
    const turns: GroupedTurn[] = [makeAssistantGroup('a1', 'Sonnet 4', 0)];
    const events = extractTimelineEvents(turns);
    expect(events[0].label).toBe('Sonnet 4');
  });

  it('assistant-group label falls back to "Assistant" when model is null', () => {
    const turns: GroupedTurn[] = [makeAssistantGroup('a1', null, 2)];
    const events = extractTimelineEvents(turns);
    expect(events[0].label).toBe('Assistant \u00b7 2 tools');
  });

  it('compaction label shows token delta in k format', () => {
    const turns: GroupedTurn[] = [makeCompactionTurn('c1', 20000, 8000)];
    const events = extractTimelineEvents(turns);
    expect(events[0].label).toBe('-12k tokens');
  });

  it('compaction label falls back to "Compaction" when no delta', () => {
    const turns: GroupedTurn[] = [makeCompactionTurn('c1', null, null)];
    const events = extractTimelineEvents(turns);
    expect(events[0].label).toBe('Compaction');
  });

  it('compaction label falls back to "Compaction" when delta is 0', () => {
    const turns: GroupedTurn[] = [makeCompactionTurn('c1', 5000, 5000)];
    const events = extractTimelineEvents(turns);
    expect(events[0].label).toBe('Compaction');
  });

  it('turnIndex matches the index in the input array', () => {
    const turns: GroupedTurn[] = [
      makeSystemGroup(),          // index 0 -- skipped
      makeUserTurn('u1', 'hi'),   // index 1
      makeAssistantGroup('a1', 'Opus 4', 0), // index 2
      makeClearDivider(),         // index 3 -- skipped
      makeCompactionTurn('c1', 10000, 5000), // index 4
    ];

    const events = extractTimelineEvents(turns);
    expect(events).toHaveLength(3);
    expect(events[0].turnIndex).toBe(1);
    expect(events[1].turnIndex).toBe(2);
    expect(events[2].turnIndex).toBe(4);
  });

  it('uses correct keys for each event type', () => {
    const turns: GroupedTurn[] = [
      makeUserTurn('user-id-1', 'hello'),
      makeAssistantGroup('asst-msg-1', 'Opus 4', 1),
      makeCompactionTurn('compaction-id-1', 15000, 3000),
    ];

    const events = extractTimelineEvents(turns);
    expect(events[0].key).toBe('user-id-1');
    expect(events[1].key).toBe('asst-msg-1');
    expect(events[2].key).toBe('compaction-id-1');
  });
});

describe('extractTimelineEvents -- subagent status', () => {
  it("Task tool call with subagentSummary.status === 'success' yields event.status === 'success'", () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithSubagent('a1', 'tc1', 'Task', {
        subagentSummary: makeSubagentSummary('success'),
        subagentLinkAttempted: true,
        subagentConversationId: 'conv-ok',
      }),
    ];
    const events = extractTimelineEvents(turns);
    const subagent = events.find(e => e.type === 'subagent');
    expect(subagent).toBeDefined();
    expect(subagent!.status).toBe('success');
  });

  it("Task tool call with subagentSummary.status === 'error' yields event.status === 'error'", () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithSubagent('a1', 'tc1', 'Task', {
        subagentSummary: makeSubagentSummary('error'),
        subagentLinkAttempted: true,
        subagentConversationId: 'conv-err',
      }),
    ];
    const events = extractTimelineEvents(turns);
    const subagent = events.find(e => e.type === 'subagent');
    expect(subagent!.status).toBe('error');
  });

  it("Task tool call with subagentSummary.status === 'interrupted' yields event.status === 'interrupted'", () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithSubagent('a1', 'tc1', 'Task', {
        subagentSummary: makeSubagentSummary('interrupted'),
        subagentLinkAttempted: true,
        subagentConversationId: 'conv-int',
      }),
    ];
    const events = extractTimelineEvents(turns);
    const subagent = events.find(e => e.type === 'subagent');
    expect(subagent!.status).toBe('interrupted');
  });

  it("Task tool call with no summary and subagentLinkAttempted === false yields event.status === 'running'", () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithSubagent('a1', 'tc1', 'Task', {
        subagentSummary: null,
        subagentLinkAttempted: false,
        subagentConversationId: null,
      }),
    ];
    const events = extractTimelineEvents(turns);
    const subagent = events.find(e => e.type === 'subagent');
    expect(subagent!.status).toBe('running');
  });

  it("Task tool call with no summary and subagentLinkAttempted === true yields event.status === 'unmatched'", () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithSubagent('a1', 'tc1', 'Task', {
        subagentSummary: null,
        subagentLinkAttempted: true,
        subagentConversationId: null,
      }),
    ];
    const events = extractTimelineEvents(turns);
    const subagent = events.find(e => e.type === 'subagent');
    expect(subagent!.status).toBe('unmatched');
  });

  it("Task tool call with no summary but subagentConversationId present and subagentLinkAttempted === true yields event.status === 'missing'", () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithSubagent('a1', 'tc1', 'Task', {
        subagentSummary: null,
        subagentLinkAttempted: true,
        subagentConversationId: 'conv-x',
      }),
    ];
    const events = extractTimelineEvents(turns);
    const subagent = events.find(e => e.type === 'subagent');
    expect(subagent!.status).toBe('missing');
  });

  it("Task tool call with no summary but subagentConversationId present and subagentLinkAttempted === false still yields event.status === 'missing' (link beats flag)", () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithSubagent('a1', 'tc1', 'Task', {
        subagentSummary: null,
        subagentLinkAttempted: false,
        subagentConversationId: 'conv-x',
      }),
    ];
    const events = extractTimelineEvents(turns);
    const subagent = events.find(e => e.type === 'subagent');
    expect(subagent!.status).toBe('missing');
  });

  it('Agent tool name behaves identically to Task (parity check)', () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithSubagent('a1', 'tc1', 'Agent', {
        subagentSummary: makeSubagentSummary('success'),
        subagentLinkAttempted: true,
        subagentConversationId: 'conv-ok',
      }),
    ];
    const events = extractTimelineEvents(turns);
    const subagent = events.find(e => e.type === 'subagent');
    expect(subagent).toBeDefined();
    expect(subagent!.status).toBe('success');
  });

  it('non-subagent events (user / assistant-group / compaction) have status === undefined', () => {
    const turns: GroupedTurn[] = [
      makeUserTurn('u1', 'hello'),
      makeAssistantGroup('a1', 'Opus 4', 0),
      makeCompactionTurn('c1', 20000, 8000),
    ];
    const events = extractTimelineEvents(turns);
    const user = events.find(e => e.type === 'user');
    const asst = events.find(e => e.type === 'assistant-group');
    const comp = events.find(e => e.type === 'compaction');
    expect(user!.status).toBeUndefined();
    expect(asst!.status).toBeUndefined();
    expect(comp!.status).toBeUndefined();
  });
});

// Factory: build an assistant-group with N custom tool_calls on a single turn.
// All tool_calls share the same messageId (groupTurns invariant).
function makeAssistantGroupWithToolCalls(
  msgId: string,
  toolCalls: Partial<ToolCallRow>[],
): AssistantGroup {
  const tcs: ToolCallRow[] = toolCalls.map((partial, idx) => ({
    id: partial.id ?? `tc-${idx}`,
    messageId: msgId,
    name: partial.name ?? 'Task',
    input: partial.input ?? { description: `sub-${idx}` },
    output: partial.output ?? null,
    status: partial.status ?? null,
    duration: partial.duration ?? null,
    createdAt: partial.createdAt ?? '2024-01-01T00:01:00Z',
    subagentConversationId: partial.subagentConversationId ?? null,
    subagentSummary: partial.subagentSummary ?? null,
    subagentLinkAttempted: partial.subagentLinkAttempted ?? false,
  }));
  return {
    type: 'assistant-group',
    turns: [
      {
        type: 'assistant',
        message: {
          id: msgId,
          role: 'assistant',
          content: '',
          thinking: null,
          model: 'Opus 4',
          createdAt: '2024-01-01T00:01:00Z',
        },
        toolCalls: tcs,
      },
    ],
    model: 'Opus 4',
    messageCount: 1,
    toolCallCount: tcs.length,
    firstTimestamp: '2024-01-01T00:01:00Z',
    lastTimestamp: '2024-01-01T00:01:00Z',
  };
}

describe('extractTimelineEvents -- parallel subagent batching (IMPR-8)', () => {
  it('turn with 1 Task call emits one subagent event and zero subagent-batch events', () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithToolCalls('a1', [
        { id: 'tc-0', name: 'Task', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true },
      ]),
    ];
    const events = extractTimelineEvents(turns);
    const subs = events.filter(e => e.type === 'subagent');
    const batches = events.filter(e => e.type === 'subagent-batch');
    expect(subs).toHaveLength(1);
    expect(batches).toHaveLength(0);
  });

  it('turn with 2 Task calls (both success) emits one subagent-batch event and zero subagent events', () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithToolCalls('a1', [
        { id: 'tc-0', name: 'Task', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true },
        { id: 'tc-1', name: 'Task', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true },
      ]),
    ];
    const events = extractTimelineEvents(turns);
    const subs = events.filter(e => e.type === 'subagent');
    const batches = events.filter(e => e.type === 'subagent-batch');
    expect(subs).toHaveLength(0);
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('2 sub-agents \u00b7 2\u2713');
    expect(batches[0].batchAggregate).toEqual({
      total: 2, success: 2, error: 0, running: 0, unmatched: 0, missing: 0,
    });
    expect(batches[0].batchToolCallIds).toEqual(['tc-0', 'tc-1']);
    expect(batches[0].key).toBe('tc-0');
  });

  it('turn with 3 Task calls (success + error + running) emits one batch event with full aggregate', () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithToolCalls('a1', [
        { id: 'tc-0', name: 'Task', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true },
        { id: 'tc-1', name: 'Task', subagentSummary: makeSubagentSummary('error'), subagentLinkAttempted: true },
        { id: 'tc-2', name: 'Task', subagentSummary: null, subagentLinkAttempted: false, subagentConversationId: null },
      ]),
    ];
    const events = extractTimelineEvents(turns);
    const batches = events.filter(e => e.type === 'subagent-batch');
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('3 sub-agents \u00b7 1\u2713 1\u2717 1\u27F3');
    expect(batches[0].batchAggregate).toEqual({
      total: 3, success: 1, error: 1, running: 1, unmatched: 0, missing: 0,
    });
  });

  it('turn with 2 Agent + 1 Read + 2 Task emits two batch events and zero subagent events (Read is not a sub-agent)', () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithToolCalls('a1', [
        { id: 'tc-0', name: 'Agent', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true },
        { id: 'tc-1', name: 'Agent', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true },
        { id: 'tc-2', name: 'Read' },
        { id: 'tc-3', name: 'Task', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true },
        { id: 'tc-4', name: 'Task', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true },
      ]),
    ];
    const events = extractTimelineEvents(turns);
    const batches = events.filter(e => e.type === 'subagent-batch');
    const subs = events.filter(e => e.type === 'subagent');
    expect(batches).toHaveLength(2);
    expect(subs).toHaveLength(0);
    // Order: Agent batch first, then Task batch (source order preserved).
    expect(batches[0].batchToolCallIds).toEqual(['tc-0', 'tc-1']);
    expect(batches[1].batchToolCallIds).toEqual(['tc-3', 'tc-4']);
  });

  it('turn with 1 Task + 2 Read + 1 Agent emits two solo subagent events (run lengths of 1) and zero batches', () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithToolCalls('a1', [
        { id: 'tc-0', name: 'Task', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true },
        { id: 'tc-1', name: 'Read' },
        { id: 'tc-2', name: 'Read' },
        { id: 'tc-3', name: 'Agent', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true },
      ]),
    ];
    const events = extractTimelineEvents(turns);
    const batches = events.filter(e => e.type === 'subagent-batch');
    const subs = events.filter(e => e.type === 'subagent');
    expect(batches).toHaveLength(0);
    expect(subs).toHaveLength(2);
  });

  it('interrupted status merges into aggregate.error (matches useSubagentList)', () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithToolCalls('a1', [
        { id: 'tc-0', name: 'Task', subagentSummary: makeSubagentSummary('interrupted'), subagentLinkAttempted: true },
        { id: 'tc-1', name: 'Task', subagentSummary: makeSubagentSummary('error'), subagentLinkAttempted: true },
      ]),
    ];
    const events = extractTimelineEvents(turns);
    const batches = events.filter(e => e.type === 'subagent-batch');
    expect(batches).toHaveLength(1);
    expect(batches[0].batchAggregate).toEqual({
      total: 2, success: 0, error: 2, running: 0, unmatched: 0, missing: 0,
    });
    expect(batches[0].label).toBe('2 sub-agents \u00b7 2\u2717');
  });

  it('solo subagent event shape is unchanged (regression guard: status/subagentConversationId/subagentLinkAttempted still populated)', () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithToolCalls('a1', [
        { id: 'tc-0', name: 'Task', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true, subagentConversationId: 'conv-solo' },
      ]),
    ];
    const events = extractTimelineEvents(turns);
    const solo = events.find(e => e.type === 'subagent');
    expect(solo).toBeDefined();
    expect(solo!.status).toBe('success');
    expect(solo!.subagentConversationId).toBe('conv-solo');
    expect(solo!.subagentLinkAttempted).toBe(true);
    // Batch-only fields must NOT be set on solo events.
    expect(solo!.batchAggregate).toBeUndefined();
    expect(solo!.batchToolCallIds).toBeUndefined();
  });

  it('batchToolCallIds preserves the source order of siblings inside the run', () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithToolCalls('a1', [
        { id: 'first', name: 'Task', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true },
        { id: 'second', name: 'Task', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true },
        { id: 'third', name: 'Task', subagentSummary: makeSubagentSummary('success'), subagentLinkAttempted: true },
      ]),
    ];
    const events = extractTimelineEvents(turns);
    const batches = events.filter(e => e.type === 'subagent-batch');
    expect(batches).toHaveLength(1);
    expect(batches[0].batchToolCallIds).toEqual(['first', 'second', 'third']);
    expect(batches[0].key).toBe('first');
    expect(batches[0].turnIndex).toBe(0);
  });

  it('unmatched and missing ghost states flow into their own aggregate buckets', () => {
    const turns: GroupedTurn[] = [
      makeAssistantGroupWithToolCalls('a1', [
        // unmatched: linker attempted, no conversation id, no summary
        { id: 'tc-0', name: 'Task', subagentSummary: null, subagentLinkAttempted: true, subagentConversationId: null },
        // missing: conversation id present but no summary
        { id: 'tc-1', name: 'Task', subagentSummary: null, subagentLinkAttempted: true, subagentConversationId: 'conv-x' },
      ]),
    ];
    const events = extractTimelineEvents(turns);
    const batches = events.filter(e => e.type === 'subagent-batch');
    expect(batches).toHaveLength(1);
    expect(batches[0].batchAggregate).toEqual({
      total: 2, success: 0, error: 0, running: 0, unmatched: 1, missing: 1,
    });
    expect(batches[0].label).toBe('2 sub-agents \u00b7 1? 1\u26A0');
  });
});

describe('useTimeline panel state', () => {
  beforeEach(() => {
    localStorage.removeItem('timeline-panel-open');
    _resetTimelineState();
  });

  it('isOpen defaults to true when no localStorage key exists', () => {
    const { isOpen } = useTimeline();
    expect(isOpen.value).toBe(true);
  });

  it('isOpen is false when localStorage has "false"', () => {
    localStorage.setItem('timeline-panel-open', 'false');
    const { isOpen } = useTimeline();
    expect(isOpen.value).toBe(false);
  });

  it('toggle() flips isOpen and writes to localStorage', () => {
    const { isOpen, toggle } = useTimeline();
    expect(isOpen.value).toBe(true);

    toggle();
    expect(isOpen.value).toBe(false);
    expect(localStorage.getItem('timeline-panel-open')).toBe('false');

    toggle();
    expect(isOpen.value).toBe(true);
    expect(localStorage.getItem('timeline-panel-open')).toBe('true');
  });
});
