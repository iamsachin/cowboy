<template>
  <div class="px-4 pt-2 pb-4 space-y-6">
    <!-- Page header with title + agent filter dropdown -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Analytics</h1>
      <div class="flex items-center gap-3">
        <select class="select select-sm select-bordered" v-model="selectedAgent">
          <option value="">All Agents</option>
          <option v-for="agent in agentOptions" :key="agent" :value="agent">
            {{ AGENT_LABELS[agent] ?? agent }}
          </option>
        </select>
        <DateRangeFilter />
      </div>
    </div>

    <!-- Section 1: Activity Heatmap -->
    <div class="card bg-base-200 rounded-box overflow-visible">
      <div class="card-body overflow-visible">
        <h2 class="card-title text-sm flex items-center gap-2">
          <Activity class="w-4 h-4" /> Activity
        </h2>
        <ActivityHeatmap :data="heatmapData" :loading="loading" @drillDown="onDrillDown" />
      </div>
    </div>

    <!-- Section 2: Tool Analytics (chart + table side by side on lg) -->
    <div class="card bg-base-200 rounded-box">
      <div class="card-body">
        <h2 class="card-title text-sm flex items-center gap-2">
          <Wrench class="w-4 h-4" /> Tool Analytics
        </h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ToolStatsChart :data="toolStats" :loading="loading" />
          <ToolStatsTable :data="toolStats" :loading="loading" />
        </div>
      </div>
    </div>

    <!-- Section 3: Per-Project Analytics -->
    <div class="card bg-base-200 rounded-box">
      <div class="card-body">
        <h2 class="card-title text-sm flex items-center gap-2">
          <FolderOpen class="w-4 h-4" /> Projects
        </h2>
        <ProjectTable :data="projectStats" :loading="loading" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Activity, Wrench, FolderOpen } from 'lucide-vue-next';
import DateRangeFilter from '../components/DateRangeFilter.vue';
import ActivityHeatmap from '../components/ActivityHeatmap.vue';
import { API_BASE } from '../utils/api-base';
import ToolStatsChart from '../components/ToolStatsChart.vue';
import ToolStatsTable from '../components/ToolStatsTable.vue';
import ProjectTable from '../components/ProjectTable.vue';
import { useAdvancedAnalytics } from '../composables/useAdvancedAnalytics';
import { useDateRange } from '../composables/useDateRange';
import { AGENT_LABELS } from '../utils/agent-constants';

const { toolStats, heatmapData, projectStats, loading, selectedAgent } = useAdvancedAnalytics();
const { setCustomRange } = useDateRange();

// API-driven agent filter with fallback to hardcoded values
const agentOptions = ref<string[]>(Object.keys(AGENT_LABELS));

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE}/api/analytics/filters`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.agents) && data.agents.length > 0) {
        agentOptions.value = data.agents;
      }
    }
  } catch {
    // Keep fallback values
  }
});

function onDrillDown(date: string) {
  setCustomRange(date, date);
}
</script>
