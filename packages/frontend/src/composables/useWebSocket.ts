import { ref, readonly, getCurrentScope, onScopeDispose } from 'vue';
import type { WebSocketEvent, WebSocketEventType, SystemFullRefreshEvent } from '@cowboy/shared';

// Types
export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

// Typed callback helper
type EventCallback<T extends WebSocketEventType> = (
  event: Extract<WebSocketEvent, { type: T }>
) => void;

// Module-level singleton state (outside the exported function)
const state = ref<ConnectionState>('disconnected');
const reconnectAttempt = ref(0);
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Map<string, Set<(event: any) => void>>();
let lastSeq = 0;
let started = false;

// Exported for testability
export function getReconnectDelay(attempt: number): number {
  const baseDelay = 1000;
  const maxDelay = 30000;
  const exponential = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
  const jitter = Math.random() * exponential * 0.5;
  return exponential + jitter;
}

function getWsUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/api/ws`;
}

function fireFullRefresh(): void {
  const refreshEvent: SystemFullRefreshEvent = {
    type: 'system:full-refresh',
    seq: 0,
    timestamp: new Date().toISOString(),
  };
  listeners.get('system:full-refresh')?.forEach((cb) => cb(refreshEvent));
}

function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  ws = new WebSocket(getWsUrl());

  ws.onopen = () => {
    state.value = 'connected';
    reconnectAttempt.value = 0;
    lastSeq = 0; // Reset on reconnect so first event sets new baseline
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data) as WebSocketEvent;
      // Skip messages without seq field (e.g. the 'connected' handshake)
      if (typeof msg.seq !== 'number') return;

      // Gap detection: if seq jumps, fire system:full-refresh
      if (msg.seq > lastSeq + 1 && lastSeq > 0) {
        fireFullRefresh();
      }

      lastSeq = msg.seq;

      // Route to type-specific listeners
      listeners.get(msg.type)?.forEach((cb) => cb(msg));
    } catch {
      // Ignore non-JSON messages
    }
  };

  ws.onclose = () => {
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = () => {
    // WebSocket will fire onclose after onerror, so no extra handling needed
    console.warn('[useWebSocket] connection error');
  };
}

function scheduleReconnect(): void {
  if (document.hidden) {
    // Don't schedule reconnect when tab is hidden; will reconnect on visibilitychange
    state.value = 'disconnected';
    return;
  }

  state.value = 'reconnecting';
  reconnectAttempt.value++;
  const delay = getReconnectDelay(reconnectAttempt.value - 1);
  reconnectTimer = setTimeout(connect, delay);
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    // Reconnect if not connected
    if (state.value !== 'connected') {
      reconnectAttempt.value = 0;
      connect();
    }
    // Fire system:full-refresh to catch up on missed changes
    fireFullRefresh();
  } else {
    // Cancel pending reconnect timer when tab is hidden
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }
}

function on<T extends WebSocketEventType>(type: T, callback: EventCallback<T>): () => void {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type)!.add(callback as any);
  const unsubscribe = () => {
    listeners.get(type)?.delete(callback as any);
  };
  if (getCurrentScope()) {
    onScopeDispose(unsubscribe);
  }
  return unsubscribe;
}

export function useWebSocket() {
  if (!started) {
    started = true;
    connect();
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  return {
    state: readonly(state),
    reconnectAttempt: readonly(reconnectAttempt),
    on,
  };
}

// Only for test isolation -- resets all module-level state
export function _resetForTesting(): void {
  if (ws) {
    ws.close();
    ws = null;
  }
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  listeners.clear();
  lastSeq = 0;
  state.value = 'disconnected';
  reconnectAttempt.value = 0;
  started = false;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}
