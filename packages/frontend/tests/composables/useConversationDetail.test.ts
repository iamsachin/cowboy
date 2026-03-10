import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ConversationDetailResponse } from '@cowboy/shared';

// Mock useWebSocket before importing the composable
const mockListeners = new Map<string, Set<(event: any) => void>>();

function mockOn(type: string, callback: (event: any) => void): () => void {
  if (!mockListeners.has(type)) mockListeners.set(type, new Set());
  mockListeners.get(type)!.add(callback);
  return () => { mockListeners.get(type)?.delete(callback); };
}

function fireEvent(type: string, payload: any) {
  mockListeners.get(type)?.forEach(cb => cb(payload));
}

vi.mock('../../src/composables/useWebSocket', () => ({
  useWebSocket: () => ({
    on: mockOn,
    state: { value: 'connected' },
    reconnectAttempt: { value: 0 },
  }),
}));

function createMockResponse(overrides?: Partial<ConversationDetailResponse>): ConversationDetailResponse {
  return {
    conversation: {
      id: 'conv-1',
      agent: 'claude-code',
      project: null,
      title: 'Test Conversation',
      createdAt: '2026-03-10T00:00:00Z',
      updatedAt: '2026-03-10T00:00:00Z',
      model: 'claude-sonnet-4-20250514',
      isActive: false,
    },
    messages: [
      { id: 'msg-1', role: 'user', content: 'Hello', thinking: null, createdAt: '2026-03-10T00:00:01Z', model: null },
      { id: 'msg-2', role: 'assistant', content: 'Hi there', thinking: null, createdAt: '2026-03-10T00:00:02Z', model: 'claude-sonnet-4-20250514' },
    ],
    toolCalls: [],
    tokenSummary: {
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      cost: 0.01,
      savings: 0,
    },
    tokenUsageByMessage: {},
    compactionEvents: [],
    ...overrides,
  };
}

describe('useConversationDetail', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockListeners.clear();

    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(createMockResponse()),
    });
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function getComposable(conversationId = 'conv-1') {
    // Dynamic import to get fresh module state each test
    const mod = await import('../../src/composables/useConversationDetail');
    return mod.useConversationDetail(conversationId);
  }

  it('fetches detail immediately on creation', async () => {
    const result = await getComposable();
    // Wait for the initial fetch to resolve
    await vi.runAllTimersAsync();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/api/analytics/conversations/conv-1');
    expect(result.data.value).not.toBeNull();
    expect(result.loading.value).toBe(false);
  });

  it('debounces conversation:changed events by 500ms', async () => {
    await getComposable('conv-1');
    await vi.runAllTimersAsync();

    // Reset fetch count after initial load
    fetchSpy.mockClear();

    // Fire 5 rapid conversation:changed events
    for (let i = 0; i < 5; i++) {
      fireEvent('conversation:changed', {
        type: 'conversation:changed',
        conversationId: 'conv-1',
        changes: ['messages-added'],
        timestamp: '2026-03-10T00:00:10Z',
        seq: i + 1,
      });
    }

    // Before 500ms, no fetch should have fired
    await vi.advanceTimersByTimeAsync(400);
    expect(fetchSpy).not.toHaveBeenCalled();

    // After 500ms debounce completes, exactly 1 fetch
    await vi.advanceTimersByTimeAsync(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('in-flight queue: at most 1 fetch in-flight + 1 queued', async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;

    const firstFetchPromise = new Promise<void>(resolve => { resolveFirst = resolve; });
    const secondFetchPromise = new Promise<void>(resolve => { resolveSecond = resolve; });

    let callCount = 0;
    fetchSpy.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Initial load
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(createMockResponse()),
        });
      } else if (callCount === 2) {
        // First refetch - hold it in-flight
        return firstFetchPromise.then(() => ({
          ok: true,
          status: 200,
          json: () => Promise.resolve(createMockResponse()),
        }));
      } else {
        // Queued refetch
        return secondFetchPromise.then(() => ({
          ok: true,
          status: 200,
          json: () => Promise.resolve(createMockResponse()),
        }));
      }
    });

    await getComposable('conv-1');
    await vi.runAllTimersAsync();
    expect(callCount).toBe(1); // initial fetch

    // Fire event, wait for debounce
    fireEvent('conversation:changed', {
      type: 'conversation:changed',
      conversationId: 'conv-1',
      changes: ['messages-added'],
      timestamp: '2026-03-10T00:00:10Z',
      seq: 1,
    });
    await vi.advanceTimersByTimeAsync(600);
    expect(callCount).toBe(2); // first refetch in-flight

    // Fire another event while first is in-flight
    fireEvent('conversation:changed', {
      type: 'conversation:changed',
      conversationId: 'conv-1',
      changes: ['tokens-updated'],
      timestamp: '2026-03-10T00:00:11Z',
      seq: 2,
    });
    await vi.advanceTimersByTimeAsync(600);

    // Should NOT have started another fetch yet (first is still in-flight)
    expect(callCount).toBe(2);

    // Resolve first fetch
    resolveFirst();
    await vi.runAllTimersAsync();

    // Now the queued fetch should fire
    expect(callCount).toBe(3);

    resolveSecond();
    await vi.runAllTimersAsync();
  });

  it('10 rapid events produce at most 2 fetches (1 debounced + 1 queued)', async () => {
    let resolveRefetch!: () => void;

    let callCount = 0;
    fetchSpy.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Initial load
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(createMockResponse()),
        });
      } else if (callCount === 2) {
        // First refetch - hold in-flight
        return new Promise<void>(resolve => { resolveRefetch = resolve; }).then(() => ({
          ok: true,
          status: 200,
          json: () => Promise.resolve(createMockResponse()),
        }));
      } else {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(createMockResponse()),
        });
      }
    });

    await getComposable('conv-1');
    await vi.runAllTimersAsync();
    expect(callCount).toBe(1);

    // Fire 10 rapid events
    for (let i = 0; i < 10; i++) {
      fireEvent('conversation:changed', {
        type: 'conversation:changed',
        conversationId: 'conv-1',
        changes: ['messages-added'],
        timestamp: '2026-03-10T00:00:10Z',
        seq: i + 1,
      });
    }

    // Debounce fires
    await vi.advanceTimersByTimeAsync(600);
    expect(callCount).toBe(2); // first refetch in-flight

    // Fire more events while in-flight
    for (let i = 0; i < 5; i++) {
      fireEvent('conversation:changed', {
        type: 'conversation:changed',
        conversationId: 'conv-1',
        changes: ['messages-added'],
        timestamp: '2026-03-10T00:00:20Z',
        seq: 11 + i,
      });
    }

    // Resolve first refetch
    resolveRefetch();
    await vi.runAllTimersAsync();

    // At most 1 more fetch (queued)
    expect(callCount).toBeLessThanOrEqual(3);
  });

  it('system:full-refresh bypasses debounce and fetches immediately', async () => {
    await getComposable('conv-1');
    await vi.runAllTimersAsync();
    fetchSpy.mockClear();

    fireEvent('system:full-refresh', {
      type: 'system:full-refresh',
      seq: 0,
      timestamp: '2026-03-10T00:00:05Z',
    });

    // Should fetch immediately, no 500ms wait
    await vi.advanceTimersByTimeAsync(0);
    await vi.runAllTimersAsync();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('tracks previousGroupKeys and newGroupKeys across refetches', async () => {
    const response1 = createMockResponse({
      messages: [
        { id: 'msg-1', role: 'user', content: 'Hello', thinking: null, createdAt: '2026-03-10T00:00:01Z', model: null },
        { id: 'msg-2', role: 'assistant', content: 'Hi', thinking: null, createdAt: '2026-03-10T00:00:02Z', model: 'claude-sonnet-4-20250514' },
      ],
    });

    const response2 = createMockResponse({
      messages: [
        { id: 'msg-1', role: 'user', content: 'Hello', thinking: null, createdAt: '2026-03-10T00:00:01Z', model: null },
        { id: 'msg-2', role: 'assistant', content: 'Hi', thinking: null, createdAt: '2026-03-10T00:00:02Z', model: 'claude-sonnet-4-20250514' },
        { id: 'msg-3', role: 'user', content: 'More', thinking: null, createdAt: '2026-03-10T00:00:03Z', model: null },
        { id: 'msg-4', role: 'assistant', content: 'Sure', thinking: null, createdAt: '2026-03-10T00:00:04Z', model: 'claude-sonnet-4-20250514' },
      ],
    });

    let callCount = 0;
    fetchSpy.mockImplementation(() => {
      callCount++;
      const resp = callCount === 1 ? response1 : response2;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(resp),
      });
    });

    const result = await getComposable('conv-1');
    await vi.runAllTimersAsync();

    // After initial load, no previous keys
    expect(result.previousGroupKeys.value.size).toBe(0);

    // Trigger refetch via conversation:changed
    fireEvent('conversation:changed', {
      type: 'conversation:changed',
      conversationId: 'conv-1',
      changes: ['messages-added'],
      timestamp: '2026-03-10T00:00:10Z',
      seq: 1,
    });

    await vi.advanceTimersByTimeAsync(600);
    await vi.runAllTimersAsync();

    // After refetch, previousGroupKeys should have the old groups
    expect(result.previousGroupKeys.value.size).toBeGreaterThan(0);
    // newGroupKeys should contain the genuinely new group(s)
    expect(result.newGroupKeys.value.size).toBeGreaterThan(0);
    // msg-4 is a new assistant message, its group key should be in newGroupKeys
    expect(result.newGroupKeys.value.has('msg-4')).toBe(true);
  });

  it('ignores conversation:changed events for other conversations', async () => {
    await getComposable('conv-1');
    await vi.runAllTimersAsync();
    fetchSpy.mockClear();

    fireEvent('conversation:changed', {
      type: 'conversation:changed',
      conversationId: 'conv-OTHER',
      changes: ['messages-added'],
      timestamp: '2026-03-10T00:00:10Z',
      seq: 1,
    });

    await vi.advanceTimersByTimeAsync(600);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('loading is only true on initial fetch, refreshing used for live updates', async () => {
    let resolveRefetch!: () => void;
    let callCount = 0;

    fetchSpy.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(createMockResponse()),
        });
      }
      // Second call: hold in-flight so we can observe refreshing
      return new Promise<void>(resolve => { resolveRefetch = resolve; }).then(() => ({
        ok: true,
        status: 200,
        json: () => Promise.resolve(createMockResponse()),
      }));
    });

    const result = await getComposable('conv-1');

    // loading starts true for initial fetch
    expect(result.loading.value).toBe(true);

    await vi.runAllTimersAsync();
    expect(result.loading.value).toBe(false);

    // Trigger a live refetch
    fireEvent('conversation:changed', {
      type: 'conversation:changed',
      conversationId: 'conv-1',
      changes: ['messages-added'],
      timestamp: '2026-03-10T00:00:10Z',
      seq: 1,
    });

    await vi.advanceTimersByTimeAsync(600);

    // loading should NOT be true during live refetch
    expect(result.loading.value).toBe(false);
    // refreshing should be true (fetch is still in-flight)
    expect(result.refreshing.value).toBe(true);

    // Resolve the refetch
    resolveRefetch();
    await vi.runAllTimersAsync();
    expect(result.refreshing.value).toBe(false);
  });
});
