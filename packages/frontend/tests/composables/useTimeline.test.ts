import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GroupedTurn, UserTurn, AssistantGroup, CompactionTurn, SystemGroup, SlashCommandTurn, ClearDividerTurn, AgentPromptTurn } from '../../src/composables/useGroupedTurns';
import { extractTimelineEvents, useTimeline, _resetTimelineState } from '../../src/composables/useTimeline';

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
