import { describe, it, expect } from 'vitest';
import { ref, nextTick } from 'vue';
import { useSubagentList } from '../../src/composables/useSubagentList';
import type { SubagentSummary, ToolCallRow } from '../../src/types';

// ── Fixture helpers ─────────────────────────────────────────────────

function fakeSummary(overrides: Partial<SubagentSummary> = {}): SubagentSummary {
  return {
    toolBreakdown: { Read: 1 },
    filesTouched: [],
    totalToolCalls: 1,
    status: 'success',
    durationMs: 100,
    inputTokens: 0,
    outputTokens: 0,
    lastError: null,
    matchConfidence: 'high',
    ...overrides,
  };
}

function makeToolCall(overrides: Partial<ToolCallRow> & { id: string; name: string }): ToolCallRow {
  return {
    messageId: 'msg-1',
    input: null,
    output: null,
    status: null,
    duration: null,
    createdAt: '2024-01-01T00:00:00Z',
    subagentConversationId: null,
    subagentSummary: null,
    subagentLinkAttempted: false,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('useSubagentList', () => {
  it('empty toolCalls array -> subagents = [], aggregate.total = 0', () => {
    const toolCalls = ref<ToolCallRow[] | undefined>([]);
    const isActive = ref(false);
    const { subagents, aggregate } = useSubagentList(toolCalls, isActive);
    expect(subagents.value).toEqual([]);
    expect(aggregate.value.total).toBe(0);
    expect(aggregate.value.success).toBe(0);
    expect(aggregate.value.error).toBe(0);
    expect(aggregate.value.running).toBe(0);
    expect(aggregate.value.unmatched).toBe(0);
    expect(aggregate.value.missing).toBe(0);
  });

  it('undefined toolCalls ref -> subagents = [], aggregate.total = 0', () => {
    const toolCalls = ref<ToolCallRow[] | undefined>(undefined);
    const isActive = ref(false);
    const { subagents, aggregate } = useSubagentList(toolCalls, isActive);
    expect(subagents.value).toEqual([]);
    expect(aggregate.value.total).toBe(0);
  });

  it('filters out non-Task/Agent entries (Read/Edit/Bash excluded)', () => {
    const toolCalls = ref<ToolCallRow[] | undefined>([
      makeToolCall({ id: 'tc-read', name: 'Read' }),
      makeToolCall({ id: 'tc-edit', name: 'Edit' }),
      makeToolCall({ id: 'tc-bash', name: 'Bash' }),
    ]);
    const isActive = ref(false);
    const { subagents, aggregate } = useSubagentList(toolCalls, isActive);
    expect(subagents.value).toEqual([]);
    expect(aggregate.value.total).toBe(0);
  });

  it('Task tool call with summary.status=success -> ghostState=summary, summaryStatus=success', () => {
    const toolCalls = ref<ToolCallRow[] | undefined>([
      makeToolCall({
        id: 'tc-1',
        name: 'Task',
        subagentSummary: fakeSummary({ status: 'success' }),
      }),
    ]);
    const isActive = ref(false);
    const { subagents, aggregate } = useSubagentList(toolCalls, isActive);
    expect(subagents.value).toHaveLength(1);
    expect(subagents.value[0].ghostState).toBe('summary');
    expect(subagents.value[0].summaryStatus).toBe('success');
    expect(subagents.value[0].toolCallId).toBe('tc-1');
    expect(aggregate.value.total).toBe(1);
    expect(aggregate.value.success).toBe(1);
    expect(aggregate.value.error).toBe(0);
  });

  it('Task tool call with summary.status=error -> summaryStatus=error, aggregate.error=1', () => {
    const toolCalls = ref<ToolCallRow[] | undefined>([
      makeToolCall({
        id: 'tc-2',
        name: 'Task',
        subagentSummary: fakeSummary({ status: 'error' }),
      }),
    ]);
    const isActive = ref(false);
    const { aggregate, subagents } = useSubagentList(toolCalls, isActive);
    expect(subagents.value[0].ghostState).toBe('summary');
    expect(subagents.value[0].summaryStatus).toBe('error');
    expect(aggregate.value.error).toBe(1);
    expect(aggregate.value.success).toBe(0);
  });

  it('Agent tool call with summary.status=interrupted -> aggregate.error=1 (merged)', () => {
    const toolCalls = ref<ToolCallRow[] | undefined>([
      makeToolCall({
        id: 'tc-3',
        name: 'Agent',
        subagentSummary: fakeSummary({ status: 'interrupted' }),
      }),
    ]);
    const isActive = ref(false);
    const { aggregate, subagents } = useSubagentList(toolCalls, isActive);
    expect(subagents.value[0].summaryStatus).toBe('interrupted');
    expect(aggregate.value.error).toBe(1);
  });

  it('running: no summary, no link, flag false -> ghostState=running, summaryStatus undefined', () => {
    const toolCalls = ref<ToolCallRow[] | undefined>([
      makeToolCall({
        id: 'tc-r',
        name: 'Task',
        subagentSummary: null,
        subagentConversationId: null,
        subagentLinkAttempted: false,
      }),
    ]);
    const isActive = ref(true);
    const { subagents, aggregate } = useSubagentList(toolCalls, isActive);
    expect(subagents.value[0].ghostState).toBe('running');
    expect(subagents.value[0].summaryStatus).toBeUndefined();
    expect(aggregate.value.running).toBe(1);
  });

  it('unmatched: flag true, no summary, no link -> ghostState=unmatched', () => {
    const toolCalls = ref<ToolCallRow[] | undefined>([
      makeToolCall({
        id: 'tc-u',
        name: 'Task',
        subagentSummary: null,
        subagentConversationId: null,
        subagentLinkAttempted: true,
      }),
    ]);
    const isActive = ref(false);
    const { subagents, aggregate } = useSubagentList(toolCalls, isActive);
    expect(subagents.value[0].ghostState).toBe('unmatched');
    expect(subagents.value[0].summaryStatus).toBeUndefined();
    expect(aggregate.value.unmatched).toBe(1);
  });

  it('missing: link present, no summary -> ghostState=missing', () => {
    const toolCalls = ref<ToolCallRow[] | undefined>([
      makeToolCall({
        id: 'tc-m',
        name: 'Task',
        subagentSummary: null,
        subagentConversationId: 'conv-x',
        subagentLinkAttempted: true,
      }),
    ]);
    const isActive = ref(false);
    const { subagents, aggregate } = useSubagentList(toolCalls, isActive);
    expect(subagents.value[0].ghostState).toBe('missing');
    expect(subagents.value[0].summaryStatus).toBeUndefined();
    expect(aggregate.value.missing).toBe(1);
  });

  it('description priority: input.description > input.prompt > fallback, with 40-char truncation', () => {
    const longPrompt = 'A'.repeat(41); // 41 chars triggers truncation
    const prompt40 = 'B'.repeat(40); // exactly 40 chars -> no ellipsis
    const toolCalls = ref<ToolCallRow[] | undefined>([
      // 1. description present (string) -> used as-is
      makeToolCall({
        id: 'd1',
        name: 'Task',
        input: { description: 'Use research', prompt: 'ignored' },
      }),
      // 2. description not a string -> falls through to prompt
      makeToolCall({
        id: 'd2',
        name: 'Task',
        input: { description: 123, prompt: 'fallback-prompt' },
      }),
      // 3. no description, prompt > 40 chars -> truncated with '...'
      makeToolCall({
        id: 'd3',
        name: 'Task',
        input: { prompt: longPrompt },
      }),
      // 4. no description, prompt == 40 chars -> no ellipsis (matches useTimeline logic)
      makeToolCall({
        id: 'd4',
        name: 'Task',
        input: { prompt: prompt40 },
      }),
      // 5. no description, no prompt -> 'Subagent'
      makeToolCall({
        id: 'd5',
        name: 'Task',
        input: {},
      }),
      // 6. null input -> 'Subagent'
      makeToolCall({
        id: 'd6',
        name: 'Task',
        input: null,
      }),
    ]);
    const isActive = ref(false);
    const { subagents } = useSubagentList(toolCalls, isActive);
    expect(subagents.value[0].description).toBe('Use research');
    expect(subagents.value[1].description).toBe('fallback-prompt');
    expect(subagents.value[2].description).toBe('A'.repeat(40) + '...');
    expect(subagents.value[3].description).toBe('B'.repeat(40));
    expect(subagents.value[4].description).toBe('Subagent');
    expect(subagents.value[5].description).toBe('Subagent');
  });

  it('mixed bag: 2 success + 1 error + 1 running + 1 Read excluded -> total=4', () => {
    const toolCalls = ref<ToolCallRow[] | undefined>([
      makeToolCall({
        id: 's1',
        name: 'Task',
        subagentSummary: fakeSummary({ status: 'success' }),
      }),
      makeToolCall({
        id: 's2',
        name: 'Agent',
        subagentSummary: fakeSummary({ status: 'success' }),
      }),
      makeToolCall({
        id: 'e1',
        name: 'Task',
        subagentSummary: fakeSummary({ status: 'error' }),
      }),
      makeToolCall({
        id: 'r1',
        name: 'Task',
        subagentSummary: null,
      }),
      makeToolCall({ id: 'read-1', name: 'Read' }),
    ]);
    const isActive = ref(false);
    const { subagents, aggregate } = useSubagentList(toolCalls, isActive);
    expect(subagents.value).toHaveLength(4);
    expect(aggregate.value.total).toBe(4);
    expect(aggregate.value.success).toBe(2);
    expect(aggregate.value.error).toBe(1);
    expect(aggregate.value.running).toBe(1);
    // Order preserved (filter-only, no sort)
    expect(subagents.value.map((s) => s.toolCallId)).toEqual(['s1', 's2', 'e1', 'r1']);
  });

  it('reactivity: toolCalls ref mutation -> computed updates', async () => {
    const toolCalls = ref<ToolCallRow[] | undefined>([]);
    const isActive = ref(false);
    const { subagents, aggregate } = useSubagentList(toolCalls, isActive);
    expect(aggregate.value.total).toBe(0);

    toolCalls.value = [
      makeToolCall({
        id: 'tc-new',
        name: 'Task',
        subagentSummary: fakeSummary({ status: 'success' }),
      }),
    ];
    await nextTick();
    expect(subagents.value).toHaveLength(1);
    expect(aggregate.value.total).toBe(1);
    expect(aggregate.value.success).toBe(1);
  });
});
