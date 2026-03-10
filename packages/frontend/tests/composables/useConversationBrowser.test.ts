import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, effectScope } from 'vue';

// --- Mocks ---

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

describe('useConversationBrowser', () => {
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
    const mod = await import('../../src/composables/useConversationBrowser');
    const scope = effectScope();
    let result: ReturnType<typeof mod.useConversationBrowser>;
    scope.run(() => {
      result = mod.useConversationBrowser();
    });
    // Flush initial fetch
    await vi.runAllTimersAsync();
    fetchSpy.mockClear();
    return { result: result!, scope };
  }

  it('debounces WS refetch at 500ms', async () => {
    await createComposable();

    wsCallbacks.get('conversation:created')!({} as any);
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchSpy).not.toHaveBeenCalled();

    wsCallbacks.get('conversation:created')!({} as any);
    await vi.advanceTimersByTimeAsync(500);

    // Only one fetch: debounced
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

    fetchSpy.mockResolvedValue(makeResponse(['C', 'A', 'B']));
    wsCallbacks.get('conversation:created')!({} as any);
    await vi.advanceTimersByTimeAsync(500);

    expect(result.newIds.value.has('C')).toBe(true);
    expect(result.newIds.value.has('A')).toBe(false);
  });

  it('cleans up debounce timer on scope dispose', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { scope } = await createComposable();

    // Fire a WS event to create a pending debounce timer
    wsCallbacks.get('conversation:created')!({} as any);

    clearTimeoutSpy.mockClear();
    scope.stop();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
