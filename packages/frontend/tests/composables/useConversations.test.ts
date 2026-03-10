import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, effectScope } from 'vue';

// --- Mocks ---

// Capture WS on() subscriptions
const wsCallbacks = new Map<string, Function>();
vi.mock('../../src/composables/useWebSocket', () => ({
  useWebSocket: () => ({
    state: ref('connected'),
    reconnectAttempt: ref(0),
    on: vi.fn((type: string, cb: Function) => {
      wsCallbacks.set(type, cb);
      return () => wsCallbacks.delete(type);
    }),
  }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('../../src/composables/useDateRange', () => ({
  useDateRange: () => ({
    dateRange: ref({ from: '2026-03-01', to: '2026-03-10' }),
  }),
}));

function makeResponse(ids: string[]) {
  return {
    ok: true,
    json: async () => ({
      rows: ids.map((id) => ({
        id,
        date: '2026-03-10',
        agent: 'claude',
        title: null,
        project: null,
        model: null,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        cost: 0,
        savings: 0,
      })),
      total: ids.length,
      page: 1,
      limit: 20,
    }),
  };
}

describe('useConversations', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    wsCallbacks.clear();
    fetchSpy = vi.fn().mockResolvedValue(makeResponse(['A', 'B']));
    globalThis.fetch = fetchSpy as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function createComposable() {
    const mod = await import('../../src/composables/useConversations');
    const scope = effectScope();
    let result: ReturnType<typeof mod.useConversations>;
    scope.run(() => {
      result = mod.useConversations();
    });
    // Flush initial fetch from the immediate watcher
    await vi.runAllTimersAsync();
    fetchSpy.mockClear();
    return { result: result!, scope };
  }

  it('subscribes to conversation:created, conversation:changed, system:full-refresh', async () => {
    await createComposable();
    expect(wsCallbacks.has('conversation:created')).toBe(true);
    expect(wsCallbacks.has('conversation:changed')).toBe(true);
    expect(wsCallbacks.has('system:full-refresh')).toBe(true);
  });

  it('debounces WS refetch at 500ms', async () => {
    await createComposable();

    // Fire first event
    wsCallbacks.get('conversation:created')!({} as any);
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Fire second event before debounce resolves
    wsCallbacks.get('conversation:created')!({} as any);
    await vi.advanceTimersByTimeAsync(500);

    // Should have been called only once (debounced)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reset page on WS refetch', async () => {
    const { result } = await createComposable();

    result.page.value = 3;
    wsCallbacks.get('conversation:created')!({} as any);
    await vi.advanceTimersByTimeAsync(500);

    expect(result.page.value).toBe(3);
  });

  it('tracks newIds after WS refetch', async () => {
    const { result } = await createComposable();

    // Now mock fetch to return a new row C plus existing A, B
    fetchSpy.mockResolvedValue(makeResponse(['C', 'A', 'B']));
    wsCallbacks.get('conversation:created')!({} as any);
    await vi.advanceTimersByTimeAsync(500);

    expect(result.newIds.value.has('C')).toBe(true);
    expect(result.newIds.value.has('A')).toBe(false);
    expect(result.newIds.value.has('B')).toBe(false);
  });

  it('does not mark rows as new on initial load', async () => {
    const { result } = await createComposable();
    expect(result.newIds.value.size).toBe(0);
  });

  it('uses refreshing ref for WS-triggered fetch', async () => {
    const { result } = await createComposable();

    let refreshingDuringFetch = false;
    fetchSpy.mockImplementation(async () => {
      refreshingDuringFetch = result.refreshing.value;
      return makeResponse(['A', 'B']);
    });

    wsCallbacks.get('conversation:created')!({} as any);
    await vi.advanceTimersByTimeAsync(500);

    expect(refreshingDuringFetch).toBe(true);
    expect(result.loading.value).toBe(false);
    expect(result.refreshing.value).toBe(false);
  });

  it('auto-clears newIds after 2000ms', async () => {
    const { result } = await createComposable();

    fetchSpy.mockResolvedValue(makeResponse(['C', 'A', 'B']));
    wsCallbacks.get('conversation:created')!({} as any);
    await vi.advanceTimersByTimeAsync(500);

    expect(result.newIds.value.size).toBe(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(result.newIds.value.size).toBe(0);
  });
});
