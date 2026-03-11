import { ref, computed } from 'vue';
import type { TokenRatePoint } from '../types';
import { useWebSocket } from './useWebSocket';

// Module-level singleton state
const tokenRate = ref<TokenRatePoint[]>([]);
const loading = ref(false);
const dismissed = ref(localStorage.getItem('token-widget-dismissed') === 'true');
let started = false;
let wsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

async function fetchTokenRate(): Promise<void> {
  try {
    const res = await fetch('/api/analytics/token-rate');
    if (!res.ok) throw new Error(`Token rate fetch failed: ${res.status}`);
    tokenRate.value = await res.json();
  } catch (e) {
    console.warn('[useTokenRate] fetch error:', e);
  }
}

function debouncedWsRefetch(): void {
  if (wsDebounceTimer) clearTimeout(wsDebounceTimer);
  wsDebounceTimer = setTimeout(() => {
    wsDebounceTimer = null;
    fetchTokenRate();
  }, 500);
}

// Current minute rates from the last element
const currentInput = computed(() => {
  const arr = tokenRate.value;
  return arr.length > 0 ? arr[arr.length - 1].inputTokens : 0;
});

const currentOutput = computed(() => {
  const arr = tokenRate.value;
  return arr.length > 0 ? arr[arr.length - 1].outputTokens : 0;
});

// Fill missing minutes: generate all 60 minute slots with zeros for gaps
const filledTokenRate = computed<TokenRatePoint[]>(() => {
  const now = new Date();
  // Truncate to current minute
  now.setSeconds(0, 0);
  const slots: TokenRatePoint[] = [];
  const lookup = new Map<string, TokenRatePoint>();

  for (const point of tokenRate.value) {
    lookup.set(point.minute, point);
  }

  for (let i = 59; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60_000);
    // Use UTC to match backend strftime which returns UTC timestamps
    const minute = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    const existing = lookup.get(minute);
    slots.push(existing ?? { minute, inputTokens: 0, outputTokens: 0 });
  }

  return slots;
});

function dismiss(): void {
  dismissed.value = true;
  localStorage.setItem('token-widget-dismissed', 'true');
}

function restore(): void {
  dismissed.value = false;
  localStorage.removeItem('token-widget-dismissed');
}

export function useTokenRate() {
  if (!started) {
    started = true;

    // Register WS listeners once
    const { on } = useWebSocket();
    on('conversation:changed', debouncedWsRefetch);
    on('conversation:created', debouncedWsRefetch);
    on('system:full-refresh', debouncedWsRefetch);

    // Initial fetch
    loading.value = true;
    fetchTokenRate().finally(() => {
      loading.value = false;
    });
  }

  return {
    tokenRate,
    loading,
    currentInput,
    currentOutput,
    filledTokenRate,
    dismissed,
    dismiss,
    restore,
    fetchTokenRate,
  };
}
