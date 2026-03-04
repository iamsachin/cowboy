<template>
  <div class="p-4 space-y-6">
    <!-- Page header with title + agent filter dropdown -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Analytics</h1>
      <div class="flex items-center gap-3">
        <select class="select select-sm select-bordered" v-model="selectedAgent">
          <option value="">All Agents</option>
          <option value="claude-code">Claude Code</option>
          <option value="cursor">Cursor</option>
        </select>
        <DateRangeFilter />
      </div>
    </div>

    <!-- Section 1: Activity Heatmap -->
    <div class="card bg-base-200 rounded-box">
      <div class="card-body">
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
import { Activity, Wrench, FolderOpen } from 'lucide-vue-next';
import DateRangeFilter from '../components/DateRangeFilter.vue';
import ActivityHeatmap from '../components/ActivityHeatmap.vue';
import ToolStatsChart from '../components/ToolStatsChart.vue';
import ToolStatsTable from '../components/ToolStatsTable.vue';
import ProjectTable from '../components/ProjectTable.vue';
import { useAdvancedAnalytics } from '../composables/useAdvancedAnalytics';
import { useDateRange } from '../composables/useDateRange';

const { toolStats, heatmapData, projectStats, loading, selectedAgent } = useAdvancedAnalytics();
const { setCustomRange } = useDateRange();

function onDrillDown(date: string) {
  setCustomRange(date, date);
}
</script>
