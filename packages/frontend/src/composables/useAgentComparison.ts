import { ref, watch } from 'vue';
import { autoGranularity } from '../types';
import type { OverviewStats, TimeSeriesPoint } from '../types';
import { useDateRange } from './useDateRange';
import { useWebSocket } from './useWebSocket';

export interface AgentDataSet {
  overview: import('vue').Ref<OverviewStats | null>;
  timeseries: import('vue').Ref<TimeSeriesPoint[]>;
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

export function useAgentComparison() {
  const { dateRange } = useDateRange();

  const claudeCode: AgentDataSet = {
    overview: ref<OverviewStats | null>(null),
    timeseries: ref<TimeSeriesPoint[]>([]),
  };

  const cursor: AgentDataSet = {
    overview: ref<OverviewStats | null>(null),
    timeseries: ref<TimeSeriesPoint[]>([]),
  };

  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchAll(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const { from, to } = dateRange.value;
      const granularity = autoGranularity(from, to);

      const [ccOverview, ccTimeseries, curOverview, curTimeseries] =
        await Promise.all([
          fetchAgentOverview('claude-code', from, to),
          fetchAgentTimeSeries('claude-code', from, to, granularity),
          fetchAgentOverview('cursor', from, to),
          fetchAgentTimeSeries('cursor', from, to, granularity),
        ]);

      claudeCode.overview.value = ccOverview;
      claudeCode.timeseries.value = ccTimeseries;
      cursor.overview.value = curOverview;
      cursor.timeseries.value = curTimeseries;
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

  // Live refetch on typed WebSocket events
  const { on } = useWebSocket();
  on('conversation:changed', () => fetchAll());
  on('conversation:created', () => fetchAll());
  on('system:full-refresh', () => fetchAll());

  return {
    claudeCode,
    cursor,
    loading,
    error,
    fetchAll,
  };
}
