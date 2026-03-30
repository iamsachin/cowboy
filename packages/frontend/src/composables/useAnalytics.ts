import { ref, watch, onScopeDispose } from 'vue';
import { autoGranularity } from '../types';
import type { OverviewStats, TimeSeriesPoint, ModelDistributionEntry } from '../types';
import { useDateRange } from './useDateRange';
import { useWebSocket } from './useWebSocket';
import { API_BASE } from '../utils/api-base';

export function useAnalytics() {
  const { dateRange } = useDateRange();

  const overview = ref<OverviewStats | null>(null);
  const timeseries = ref<TimeSeriesPoint[]>([]);
  const modelDistribution = ref<ModelDistributionEntry[]>([]);
  const loading = ref(false);
  const refreshing = ref(false);
  const error = ref<string | null>(null);

  async function fetchOverview(): Promise<void> {
    const { from, to } = dateRange.value;
    const res = await fetch(`${API_BASE}/api/analytics/overview?from=${from}&to=${to}`);
    if (!res.ok) throw new Error(`Overview fetch failed: ${res.status}`);
    overview.value = await res.json();
  }

  async function fetchTimeSeries(): Promise<void> {
    const { from, to } = dateRange.value;
    const granularity = autoGranularity(from, to);
    const res = await fetch(
      `${API_BASE}/api/analytics/timeseries?from=${from}&to=${to}&granularity=${granularity}`
    );
    if (!res.ok) throw new Error(`Timeseries fetch failed: ${res.status}`);
    timeseries.value = await res.json();
  }

  async function fetchModelDistribution(): Promise<void> {
    const { from, to } = dateRange.value;
    const res = await fetch(`${API_BASE}/api/analytics/model-distribution?from=${from}&to=${to}`);
    if (!res.ok) throw new Error(`Model distribution fetch failed: ${res.status}`);
    modelDistribution.value = await res.json();
  }

  async function fetchAll(isLive = false): Promise<void> {
    if (isLive) {
      refreshing.value = true;
    } else {
      loading.value = true;
    }
    error.value = null;
    try {
      await Promise.all([fetchOverview(), fetchTimeSeries(), fetchModelDistribution()]);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
      refreshing.value = false;
    }
  }

  // Watch dateRange and re-fetch on change
  watch(
    () => dateRange.value,
    () => {
      fetchAll();
    },
    { deep: true, immediate: true }
  );

  // Debounced WS refetch — coalesces rapid events into one fetch
  let wsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  function debouncedWsRefetch(): void {
    if (wsDebounceTimer) clearTimeout(wsDebounceTimer);
    wsDebounceTimer = setTimeout(() => {
      wsDebounceTimer = null;
      fetchAll(true);
    }, 500);
  }

  const { on } = useWebSocket();
  on('conversation:changed', debouncedWsRefetch);
  on('conversation:created', debouncedWsRefetch);
  on('system:full-refresh', debouncedWsRefetch);

  onScopeDispose(() => {
    if (wsDebounceTimer) {
      clearTimeout(wsDebounceTimer);
      wsDebounceTimer = null;
    }
  });

  return {
    overview,
    timeseries,
    modelDistribution,
    loading,
    refreshing,
    error,
    fetchAll,
  };
}
