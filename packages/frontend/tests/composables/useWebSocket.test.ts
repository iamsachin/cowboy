import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Helper to create a mock WebSocket class
function createMockWebSocket() {
  const instances: MockWs[] = [];

  class MockWs {
    url: string;
    readyState = 0; // CONNECTING
    onopen: ((ev: Event) => void) | null = null;
    onclose: ((ev: CloseEvent) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;

    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url: string) {
      this.url = url;
      instances.push(this);
    }

    close = vi.fn(() => {
      this.readyState = 3;
    });

    send = vi.fn();

    // Test helpers
    simulateOpen() {
      this.readyState = 1;
      this.onopen?.({} as Event);
    }

    simulateClose() {
      this.readyState = 3;
      this.onclose?.({} as CloseEvent);
    }

    simulateMessage(data: unknown) {
      this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
    }

    simulateError() {
      this.onerror?.({} as Event);
    }
  }

  return { MockWs, instances };
}

describe('useWebSocket', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockWs = createMockWebSocket();
    // @ts-expect-error: mock WebSocket
    globalThis.WebSocket = mockWs.MockWs;

    // Mock document.visibilityState as visible by default
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, 'hidden', {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function simulateVisibilityChange(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {
      value: state,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, 'hidden', {
      value: state === 'hidden',
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  // Need to dynamically import to get a fresh module for each test
  async function getModule() {
    const mod = await import('../../src/composables/useWebSocket');
    mod._resetForTesting();
    return mod;
  }

  it('initial state is disconnected', async () => {
    const { useWebSocket, _resetForTesting } = await getModule();
    // Before calling useWebSocket, state should be disconnected
    const { state } = useWebSocket();
    // After calling useWebSocket, connect() is called, but ws hasn't opened yet
    // state should still be 'disconnected' until onopen fires
    // Actually, it could be 'disconnected' since we reset and connect is called but mock ws hasn't opened
    expect(state.value).toBe('disconnected');
  });

  it('transitions to connected on WebSocket open', async () => {
    const { useWebSocket } = await getModule();
    const { state, reconnectAttempt } = useWebSocket();

    // A WebSocket instance should have been created
    expect(mockWs.instances.length).toBe(1);
    const ws = mockWs.instances[0];

    // Simulate open
    ws.simulateOpen();

    expect(state.value).toBe('connected');
    expect(reconnectAttempt.value).toBe(0);
  });

  it('transitions to reconnecting on WebSocket close', async () => {
    const { useWebSocket } = await getModule();
    const { state, reconnectAttempt } = useWebSocket();

    const ws = mockWs.instances[0];
    ws.simulateOpen();
    expect(state.value).toBe('connected');

    // Simulate close (tab is visible)
    ws.simulateClose();

    expect(state.value).toBe('reconnecting');
    expect(reconnectAttempt.value).toBe(1);
  });

  it('exponential backoff delay calculations', async () => {
    const { getReconnectDelay } = await getModule();

    // Test with deterministic Math.random = 0 (lower bound)
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(getReconnectDelay(0)).toBe(1000); // 1000 * 2^0 = 1000, jitter = 0
    expect(getReconnectDelay(1)).toBe(2000); // 1000 * 2^1 = 2000, jitter = 0

    // Test with Math.random = 1 (upper bound)
    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect(getReconnectDelay(0)).toBe(1500); // 1000 + 1000*0.5 = 1500
    expect(getReconnectDelay(1)).toBe(3000); // 2000 + 2000*0.5 = 3000

    // Test cap: attempt 5 => 2^5 = 32000, but capped at 30000
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const delay5 = getReconnectDelay(5);
    expect(delay5).toBeLessThanOrEqual(45000); // 30000 + 30000*0.5 = 45000
  });

  it('schedules reconnect with correct delay after close', async () => {
    const { useWebSocket, getReconnectDelay } = await getModule();
    useWebSocket();

    const ws = mockWs.instances[0];
    ws.simulateOpen();

    // Mock Math.random for deterministic delay
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const expectedDelay = getReconnectDelay(0);

    ws.simulateClose();

    // Verify setTimeout was scheduled
    expect(mockWs.instances.length).toBe(1); // Only original ws so far

    // Advance timers by the expected delay
    vi.advanceTimersByTime(expectedDelay);

    // A new WebSocket should have been created
    expect(mockWs.instances.length).toBe(2);
  });

  it('does not reconnect when tab is hidden', async () => {
    const { useWebSocket } = await getModule();
    useWebSocket();

    const ws = mockWs.instances[0];
    ws.simulateOpen();

    // Set tab as hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, 'hidden', {
      value: true,
      writable: true,
      configurable: true,
    });

    ws.simulateClose();

    const { state } = useWebSocket();
    expect(state.value).toBe('disconnected');

    // Advance timers - no new WebSocket should be created
    vi.advanceTimersByTime(60000);
    expect(mockWs.instances.length).toBe(1);
  });

  it('visibilitychange to visible triggers reconnect', async () => {
    const { useWebSocket } = await getModule();
    const { state, reconnectAttempt } = useWebSocket();

    const ws = mockWs.instances[0];
    ws.simulateOpen();

    // Hide tab and close
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, 'hidden', {
      value: true,
      writable: true,
      configurable: true,
    });

    ws.simulateClose();
    expect(state.value).toBe('disconnected');

    // Now simulate tab becoming visible again
    simulateVisibilityChange('visible');

    expect(reconnectAttempt.value).toBe(0);
    // A new WebSocket should have been created
    expect(mockWs.instances.length).toBe(2);
  });

  it('visibilitychange to visible fires all listeners', async () => {
    const { useWebSocket } = await getModule();
    const { onDataChanged } = useWebSocket();

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    onDataChanged(cb1);
    onDataChanged(cb2);

    // Simulate tab becoming visible
    simulateVisibilityChange('visible');

    expect(cb1).toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  it('onDataChanged fires on data-changed message', async () => {
    const { useWebSocket } = await getModule();
    const { onDataChanged } = useWebSocket();

    const callback = vi.fn();
    onDataChanged(callback);

    const ws = mockWs.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: 'data-changed', timestamp: '2026-03-04T00:00:00Z' });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('onDataChanged unsubscribe removes listener', async () => {
    const { useWebSocket } = await getModule();
    const { onDataChanged } = useWebSocket();

    const callback = vi.fn();
    const unsubscribe = onDataChanged(callback);

    // Unsubscribe
    unsubscribe();

    const ws = mockWs.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({ type: 'data-changed' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('singleton returns same state across multiple calls', async () => {
    const { useWebSocket } = await getModule();

    const result1 = useWebSocket();
    const result2 = useWebSocket();

    expect(result1.state).toBe(result2.state);
    expect(result1.reconnectAttempt).toBe(result2.reconnectAttempt);
  });
});
