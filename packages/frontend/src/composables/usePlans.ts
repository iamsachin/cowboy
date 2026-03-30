import { ref, watch } from 'vue';
import type { PlanListResponse, PlanStatsResponse, PlanTimeSeriesPoint } from '../types';
import { useDateRange } from './useDateRange';
import { useWebSocket } from './useWebSocket';
import { API_BASE } from '../utils/api-base';

export function usePlans() {
  const { dateRange } = useDateRange();

  const plans = ref<PlanListResponse | null>(null);
  const stats = ref<PlanStatsResponse | null>(null);
  const timeseries = ref<PlanTimeSeriesPoint[] | null>(null);
  const loading = ref(false);

  // Filter refs
  const selectedAgent = ref<string>('');
  const completionFilter = ref<string>('');
  const selectedProject = ref<string>('');
  const page = ref<number>(1);
  const sort = ref<string>('date');
  const order = ref<string>('desc');

  async function fetchPlans(): Promise<void> {
    const { from, to } = dateRange.value;
    let url = `${API_BASE}/api/plans?from=${from}&to=${to}&page=${page.value}&limit=20&sort=${sort.value}&order=${order.value}`;
    if (selectedAgent.value) url += `&agent=${encodeURIComponent(selectedAgent.value)}`;
    if (selectedProject.value) url += `&project=${encodeURIComponent(selectedProject.value)}`;
    if (completionFilter.value) url += `&status=${encodeURIComponent(completionFilter.value)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Plans fetch failed: ${res.status}`);
    plans.value = await res.json();
  }

  async function fetchStats(): Promise<void> {
    const { from, to } = dateRange.value;
    let url = `${API_BASE}/api/plans/stats?from=${from}&to=${to}`;
    if (selectedAgent.value) url += `&agent=${encodeURIComponent(selectedAgent.value)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Plan stats fetch failed: ${res.status}`);
    stats.value = await res.json();
  }

  async function fetchTimeSeries(): Promise<void> {
    const { from, to } = dateRange.value;
    let url = `${API_BASE}/api/plans/timeseries?from=${from}&to=${to}&granularity=daily`;
    if (selectedAgent.value) url += `&agent=${encodeURIComponent(selectedAgent.value)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Plan timeseries fetch failed: ${res.status}`);
    timeseries.value = await res.json();
  }

  async function fetchAll(): Promise<void> {
    loading.value = true;
    try {
      await Promise.all([fetchPlans(), fetchStats(), fetchTimeSeries()]);
    } catch (e) {
      console.error('Plans fetch error:', e);
    } finally {
      loading.value = false;
    }
  }

  function setSort(column: string): void {
    if (sort.value === column) {
      order.value = order.value === 'desc' ? 'asc' : 'desc';
    } else {
      sort.value = column;
      order.value = 'desc';
    }
    page.value = 1;
    fetchPlans();
  }

  // Watch dateRange and filters -- refetch all on change
  watch(
    [() => dateRange.value, selectedAgent, completionFilter, selectedProject],
    () => {
      page.value = 1;
      fetchAll();
    },
    { deep: true, immediate: true },
  );

  // Watch page only -- refetch list (not stats) on page change
  watch(page, () => {
    fetchPlans();
  });

  // Live refetch on typed WebSocket events
  const { on } = useWebSocket();
  on('conversation:changed', () => fetchAll());
  on('conversation:created', () => fetchAll());
  on('system:full-refresh', () => fetchAll());

  return {
    plans,
    stats,
    timeseries,
    loading,
    selectedAgent,
    completionFilter,
    selectedProject,
    page,
    sort,
    order,
    setSort,
  };
}
