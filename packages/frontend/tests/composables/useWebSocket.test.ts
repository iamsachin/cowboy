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
    const { useWebSocket } = await getModule();
    const { state } = useWebSocket();
    expect(state.value).toBe('disconnected');
  });

  it('transitions to connected on WebSocket open', async () => {
    const { useWebSocket } = await getModule();
    const { state, reconnectAttempt } = useWebSocket();

    expect(mockWs.instances.length).toBe(1);
    const ws = mockWs.instances[0];
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

    ws.simulateClose();
    expect(state.value).toBe('reconnecting');
    expect(reconnectAttempt.value).toBe(1);
  });

  it('exponential backoff delay calculations', async () => {
    const { getReconnectDelay } = await getModule();

    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(getReconnectDelay(0)).toBe(1000);
    expect(getReconnectDelay(1)).toBe(2000);

    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect(getReconnectDelay(0)).toBe(1500);
    expect(getReconnectDelay(1)).toBe(3000);

    vi.spyOn(Math, 'random').mockReturnValue(1);
    const delay5 = getReconnectDelay(5);
    expect(delay5).toBeLessThanOrEqual(45000);
  });

  it('schedules reconnect with correct delay after close', async () => {
    const { useWebSocket, getReconnectDelay } = await getModule();
    useWebSocket();

    const ws = mockWs.instances[0];
    ws.simulateOpen();

    vi.spyOn(Math, 'random').mockReturnValue(0);
    const expectedDelay = getReconnectDelay(0);

    ws.simulateClose();

    expect(mockWs.instances.length).toBe(1);
    vi.advanceTimersByTime(expectedDelay);
    expect(mockWs.instances.length).toBe(2);
  });

  it('does not reconnect when tab is hidden', async () => {
    const { useWebSocket } = await getModule();
    useWebSocket();

    const ws = mockWs.instances[0];
    ws.simulateOpen();

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

    vi.advanceTimersByTime(60000);
    expect(mockWs.instances.length).toBe(1);
  });

  it('visibilitychange to visible triggers reconnect', async () => {
    const { useWebSocket } = await getModule();
    const { state, reconnectAttempt } = useWebSocket();

    const ws = mockWs.instances[0];
    ws.simulateOpen();

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

    simulateVisibilityChange('visible');

    expect(reconnectAttempt.value).toBe(0);
    expect(mockWs.instances.length).toBe(2);
  });

  it('on(conversation:changed) fires callback with event payload', async () => {
    const { useWebSocket } = await getModule();
    const { on } = useWebSocket();

    const callback = vi.fn();
    on('conversation:changed', callback);

    const ws = mockWs.instances[0];
    ws.simulateOpen();
    const event = {
      type: 'conversation:changed',
      seq: 1,
      conversationId: 'abc-123',
      changes: ['messages-added'],
      timestamp: '2026-03-10T00:00:00Z',
    };
    ws.simulateMessage(event);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(event);
  });

  it('on(conversation:created) fires callback with event payload', async () => {
    const { useWebSocket } = await getModule();
    const { on } = useWebSocket();

    const callback = vi.fn();
    on('conversation:created', callback);

    const ws = mockWs.instances[0];
    ws.simulateOpen();
    const event = {
      type: 'conversation:created',
      seq: 1,
      conversationId: 'abc-456',
      summary: { title: 'Test', agent: 'claude-code', project: null, createdAt: '2026-03-10T00:00:00Z' },
      timestamp: '2026-03-10T00:00:00Z',
    };
    ws.simulateMessage(event);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(event);
  });

  it('on(system:full-refresh) fires callback with event payload', async () => {
    const { useWebSocket } = await getModule();
    const { on } = useWebSocket();

    const callback = vi.fn();
    on('system:full-refresh', callback);

    const ws = mockWs.instances[0];
    ws.simulateOpen();
    const event = {
      type: 'system:full-refresh',
      seq: 1,
      timestamp: '2026-03-10T00:00:00Z',
    };
    ws.simulateMessage(event);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(event);
  });

  it('gap detection fires system:full-refresh when seq jumps', async () => {
    const { useWebSocket } = await getModule();
    const { on } = useWebSocket();

    const refreshCallback = vi.fn();
    const changedCallback = vi.fn();
    on('system:full-refresh', refreshCallback);
    on('conversation:changed', changedCallback);

    const ws = mockWs.instances[0];
    ws.simulateOpen();

    // Send seq 1 — normal
    ws.simulateMessage({
      type: 'conversation:changed',
      seq: 1,
      conversationId: 'abc',
      changes: ['messages-added'],
      timestamp: '2026-03-10T00:00:00Z',
    });
    expect(refreshCallback).not.toHaveBeenCalled();
    expect(changedCallback).toHaveBeenCalledTimes(1);

    // Send seq 5 — gap detected (skipped 2, 3, 4)
    ws.simulateMessage({
      type: 'conversation:changed',
      seq: 5,
      conversationId: 'abc',
      changes: ['tokens-updated'],
      timestamp: '2026-03-10T00:00:01Z',
    });

    // Gap fires system:full-refresh before routing the actual event
    expect(refreshCallback).toHaveBeenCalledTimes(1);
    // The actual event still routes to conversation:changed listeners
    expect(changedCallback).toHaveBeenCalledTimes(2);
  });

  it('reconnect resets lastSeq so first event does not trigger gap', async () => {
    const { useWebSocket } = await getModule();
    const { on } = useWebSocket();

    const refreshCallback = vi.fn();
    on('system:full-refresh', refreshCallback);

    const ws1 = mockWs.instances[0];
    ws1.simulateOpen();

    // Send seq 10 to set lastSeq high
    ws1.simulateMessage({
      type: 'conversation:changed',
      seq: 10,
      conversationId: 'abc',
      changes: ['messages-added'],
      timestamp: '2026-03-10T00:00:00Z',
    });

    // Simulate reconnect
    vi.spyOn(Math, 'random').mockReturnValue(0);
    ws1.simulateClose();
    vi.advanceTimersByTime(1500); // base delay 1000 + jitter margin

    const ws2 = mockWs.instances[1];
    ws2.simulateOpen(); // resets lastSeq to 0

    // Send seq 1 after reconnect — should NOT trigger gap
    ws2.simulateMessage({
      type: 'conversation:changed',
      seq: 1,
      conversationId: 'abc',
      changes: ['messages-added'],
      timestamp: '2026-03-10T00:00:01Z',
    });

    // The full-refresh callback was fired once during reconnect visibility
    // but NOT for a gap detection
    expect(refreshCallback).not.toHaveBeenCalled();
  });

  it('unsubscribe stops callback from firing', async () => {
    const { useWebSocket } = await getModule();
    const { on } = useWebSocket();

    const callback = vi.fn();
    const unsubscribe = on('conversation:changed', callback);

    unsubscribe();

    const ws = mockWs.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({
      type: 'conversation:changed',
      seq: 1,
      conversationId: 'abc',
      changes: ['messages-added'],
      timestamp: '2026-03-10T00:00:00Z',
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('multiple listeners on same type all fire', async () => {
    const { useWebSocket } = await getModule();
    const { on } = useWebSocket();

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    on('conversation:changed', cb1);
    on('conversation:changed', cb2);

    const ws = mockWs.instances[0];
    ws.simulateOpen();
    ws.simulateMessage({
      type: 'conversation:changed',
      seq: 1,
      conversationId: 'abc',
      changes: ['messages-added'],
      timestamp: '2026-03-10T00:00:00Z',
    });

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('listeners on different types only receive their type', async () => {
    const { useWebSocket } = await getModule();
    const { on } = useWebSocket();

    const changedCb = vi.fn();
    const createdCb = vi.fn();
    on('conversation:changed', changedCb);
    on('conversation:created', createdCb);

    const ws = mockWs.instances[0];
    ws.simulateOpen();

    // Send conversation:changed
    ws.simulateMessage({
      type: 'conversation:changed',
      seq: 1,
      conversationId: 'abc',
      changes: ['messages-added'],
      timestamp: '2026-03-10T00:00:00Z',
    });

    expect(changedCb).toHaveBeenCalledTimes(1);
    expect(createdCb).not.toHaveBeenCalled();

    // Send conversation:created
    ws.simulateMessage({
      type: 'conversation:created',
      seq: 2,
      conversationId: 'def',
      summary: { title: 'New', agent: 'claude-code', project: null, createdAt: '2026-03-10T00:00:00Z' },
      timestamp: '2026-03-10T00:00:01Z',
    });

    expect(changedCb).toHaveBeenCalledTimes(1);
    expect(createdCb).toHaveBeenCalledTimes(1);
  });

  it('visibilitychange to visible fires system:full-refresh', async () => {
    const { useWebSocket } = await getModule();
    const { on } = useWebSocket();

    const refreshCb = vi.fn();
    on('system:full-refresh', refreshCb);

    simulateVisibilityChange('visible');

    expect(refreshCb).toHaveBeenCalledTimes(1);
    expect(refreshCb.mock.calls[0][0]).toHaveProperty('type', 'system:full-refresh');
  });

  it('skips messages without seq field (e.g. connected handshake)', async () => {
    const { useWebSocket } = await getModule();
    const { on } = useWebSocket();

    const callback = vi.fn();
    on('conversation:changed', callback);

    const ws = mockWs.instances[0];
    ws.simulateOpen();

    // Send handshake message without seq
    ws.simulateMessage({ type: 'connected', timestamp: '2026-03-10T00:00:00Z' });

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
