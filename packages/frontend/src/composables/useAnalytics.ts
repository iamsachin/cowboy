import { ref, watch, onScopeDispose } from 'vue';
import { autoGranularity } from '@cowboy/shared';
import type { OverviewStats, TimeSeriesPoint, ModelDistributionEntry } from '@cowboy/shared';
import { useDateRange } from './useDateRange';
import { useWebSocket } from './useWebSocket';

export function useAnalytics() {
  const { dateRange } = useDateRange();

  const overview = ref<OverviewStats | null>(null);
  const timeseries = ref<TimeSeriesPoint[]>([]);
  const modelDistribution = ref<ModelDistributionEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchOverview(): Promise<void> {
    const { from, to } = dateRange.value;
    const res = await fetch(`/api/analytics/overview?from=${from}&to=${to}`);
    if (!res.ok) throw new Error(`Overview fetch failed: ${res.status}`);
    overview.value = await res.json();
  }

  async function fetchTimeSeries(): Promise<void> {
    const { from, to } = dateRange.value;
    const granularity = autoGranularity(from, to);
    const res = await fetch(
      `/api/analytics/timeseries?from=${from}&to=${to}&granularity=${granularity}`
    );
    if (!res.ok) throw new Error(`Timeseries fetch failed: ${res.status}`);
    timeseries.value = await res.json();
  }

  async function fetchModelDistribution(): Promise<void> {
    const { from, to } = dateRange.value;
    const res = await fetch(`/api/analytics/model-distribution?from=${from}&to=${to}`);
    if (!res.ok) throw new Error(`Model distribution fetch failed: ${res.status}`);
    modelDistribution.value = await res.json();
  }

  async function fetchAll(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await Promise.all([fetchOverview(), fetchTimeSeries(), fetchModelDistribution()]);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
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

  // Live refetch on WebSocket data-changed signal
  const { onDataChanged } = useWebSocket();
  const unsubscribe = onDataChanged(() => {
    fetchAll();
  });
  onScopeDispose(unsubscribe);

  return {
    overview,
    timeseries,
    modelDistribution,
    loading,
    error,
    fetchAll,
  };
}
