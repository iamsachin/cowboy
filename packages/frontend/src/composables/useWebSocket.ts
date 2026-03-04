import { ref, readonly } from 'vue';

// Types
export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export interface WsMessage {
  type: 'connected' | 'data-changed';
  timestamp?: string;
}

// Module-level singleton state (outside the exported function)
const state = ref<ConnectionState>('disconnected');
const reconnectAttempt = ref(0);
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
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

function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  ws = new WebSocket(getWsUrl());

  ws.onopen = () => {
    state.value = 'connected';
    reconnectAttempt.value = 0;
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const msg: WsMessage = JSON.parse(event.data);
      if (msg.type === 'data-changed') {
        listeners.forEach((cb) => cb());
      }
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
    // Always fire all listeners to catch up on missed changes
    listeners.forEach((cb) => cb());
  } else {
    // Cancel pending reconnect timer when tab is hidden
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }
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
    onDataChanged(callback: () => void): () => void {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
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
  state.value = 'disconnected';
  reconnectAttempt.value = 0;
  started = false;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}
