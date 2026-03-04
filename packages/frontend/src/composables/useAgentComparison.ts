import { ref, watch, onScopeDispose } from 'vue';
import { autoGranularity } from '@cowboy/shared';
import type { OverviewStats, TimeSeriesPoint, ModelDistributionEntry } from '@cowboy/shared';
import { useDateRange } from './useDateRange';
import { useWebSocket } from './useWebSocket';

export interface AgentDataSet {
  overview: import('vue').Ref<OverviewStats | null>;
  timeseries: import('vue').Ref<TimeSeriesPoint[]>;
  modelDistribution: import('vue').Ref<ModelDistributionEntry[]>;
}

async function fetchAgentOverview(agent: string, from: string, to: string): Promise<OverviewStats> {
  const res = await fetch(`/api/analytics/overview?from=${from}&to=${to}&agent=${agent}`);
  if (!res.ok) throw new Error(`Overview fetch failed for ${agent}: ${res.status}`);
  return res.json();
}

async function fetchAgentTimeSeries(
  agent: string,
  from: string,
  to: string,
  granularity: string
): Promise<TimeSeriesPoint[]> {
  const res = await fetch(
    `/api/analytics/timeseries?from=${from}&to=${to}&granularity=${granularity}&agent=${agent}`
  );
  if (!res.ok) throw new Error(`Timeseries fetch failed for ${agent}: ${res.status}`);
  return res.json();
}

async function fetchAgentModelDistribution(
  agent: string,
  from: string,
  to: string
): Promise<ModelDistributionEntry[]> {
  const res = await fetch(
    `/api/analytics/model-distribution?from=${from}&to=${to}&agent=${agent}`
  );
  if (!res.ok) throw new Error(`Model distribution fetch failed for ${agent}: ${res.status}`);
  return res.json();
}

export function useAgentComparison() {
  const { dateRange } = useDateRange();

  const claudeCode: AgentDataSet = {
    overview: ref<OverviewStats | null>(null),
    timeseries: ref<TimeSeriesPoint[]>([]),
    modelDistribution: ref<ModelDistributionEntry[]>([]),
  };

  const cursor: AgentDataSet = {
    overview: ref<OverviewStats | null>(null),
    timeseries: ref<TimeSeriesPoint[]>([]),
    modelDistribution: ref<ModelDistributionEntry[]>([]),
  };

  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchAll(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const { from, to } = dateRange.value;
      const granularity = autoGranularity(from, to);

      const [ccOverview, ccTimeseries, ccModels, curOverview, curTimeseries, curModels] =
        await Promise.all([
          fetchAgentOverview('claude-code', from, to),
          fetchAgentTimeSeries('claude-code', from, to, granularity),
          fetchAgentModelDistribution('claude-code', from, to),
          fetchAgentOverview('cursor', from, to),
          fetchAgentTimeSeries('cursor', from, to, granularity),
          fetchAgentModelDistribution('cursor', from, to),
        ]);

      claudeCode.overview.value = ccOverview;
      claudeCode.timeseries.value = ccTimeseries;
      claudeCode.modelDistribution.value = ccModels;
      cursor.overview.value = curOverview;
      cursor.timeseries.value = curTimeseries;
      cursor.modelDistribution.value = curModels;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  // Watch dateRange for refetch
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
    claudeCode,
    cursor,
    loading,
    error,
    fetchAll,
  };
}
