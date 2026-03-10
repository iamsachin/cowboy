import { ref, watch, type Ref } from 'vue';
import { autoGranularity } from '@cowboy/shared';
import type { OverviewStats, TimeSeriesPoint, ModelDistributionEntry } from '@cowboy/shared';
import { useDateRange } from './useDateRange';
import { useWebSocket } from './useWebSocket';

export function useAgentAnalytics(agent: Ref<string>) {
  const { dateRange } = useDateRange();

  const overview = ref<OverviewStats | null>(null);
  const timeseries = ref<TimeSeriesPoint[]>([]);
  const modelDistribution = ref<ModelDistributionEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchOverview(): Promise<void> {
    const { from, to } = dateRange.value;
    const res = await fetch(
      `/api/analytics/overview?from=${from}&to=${to}&agent=${agent.value}`
    );
    if (!res.ok) throw new Error(`Overview fetch failed: ${res.status}`);
    overview.value = await res.json();
  }

  async function fetchTimeSeries(): Promise<void> {
    const { from, to } = dateRange.value;
    const granularity = autoGranularity(from, to);
    const res = await fetch(
      `/api/analytics/timeseries?from=${from}&to=${to}&granularity=${granularity}&agent=${agent.value}`
    );
    if (!res.ok) throw new Error(`Timeseries fetch failed: ${res.status}`);
    timeseries.value = await res.json();
  }

  async function fetchModelDistribution(): Promise<void> {
    const { from, to } = dateRange.value;
    const res = await fetch(
      `/api/analytics/model-distribution?from=${from}&to=${to}&agent=${agent.value}`
    );
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

  // Watch both dateRange and agent -- refetch on either change
  watch(
    [() => dateRange.value, agent],
    () => {
      fetchAll();
    },
    { deep: true, immediate: true }
  );

  // Live refetch on typed WebSocket events
  const { on } = useWebSocket();
  on('conversation:changed', () => fetchAll());
  on('conversation:created', () => fetchAll());
  on('system:full-refresh', () => fetchAll());

  return {
    overview,
    timeseries,
    modelDistribution,
    loading,
    error,
    fetchAll,
  };
}
