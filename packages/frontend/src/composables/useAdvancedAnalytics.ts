import { ref, watch } from 'vue';
import type { ToolStatsRow, HeatmapDay, ProjectStatsRow } from '@cowboy/shared';
import { useDateRange } from './useDateRange';
import { useWebSocket } from './useWebSocket';

export function useAdvancedAnalytics() {
  const { dateRange } = useDateRange();

  const toolStats = ref<ToolStatsRow[]>([]);
  const heatmapData = ref<HeatmapDay[]>([]);
  const projectStats = ref<ProjectStatsRow[]>([]);
  const loading = ref(false);
  const selectedAgent = ref<string>('');

  async function fetchToolStats(): Promise<void> {
    const { from, to } = dateRange.value;
    let url = `/api/analytics/tool-stats?from=${from}&to=${to}`;
    if (selectedAgent.value) url += `&agent=${selectedAgent.value}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tool stats fetch failed: ${res.status}`);
    toolStats.value = await res.json();
  }

  async function fetchHeatmap(): Promise<void> {
    const { from, to } = dateRange.value;
    let url = `/api/analytics/heatmap?from=${from}&to=${to}`;
    if (selectedAgent.value) url += `&agent=${selectedAgent.value}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Heatmap fetch failed: ${res.status}`);
    heatmapData.value = await res.json();
  }

  async function fetchProjectStats(): Promise<void> {
    const { from, to } = dateRange.value;
    let url = `/api/analytics/project-stats?from=${from}&to=${to}`;
    if (selectedAgent.value) url += `&agent=${selectedAgent.value}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Project stats fetch failed: ${res.status}`);
    projectStats.value = await res.json();
  }

  async function fetchAll(): Promise<void> {
    loading.value = true;
    try {
      await Promise.all([fetchToolStats(), fetchHeatmap(), fetchProjectStats()]);
    } catch (e) {
      console.error('Advanced analytics fetch error:', e);
    } finally {
      loading.value = false;
    }
  }

  // Watch dateRange and selectedAgent -- refetch on either change
  watch(
    [() => dateRange.value, selectedAgent],
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
    toolStats,
    heatmapData,
    projectStats,
    loading,
    selectedAgent,
  };
}
