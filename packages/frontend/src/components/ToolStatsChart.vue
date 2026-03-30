<template>
  <div>
    <div v-show="loading" class="flex justify-center items-center h-48">
      <span class="loading loading-spinner loading-md"></span>
    </div>
    <div v-show="!loading && (!data || data.length === 0)" class="flex justify-center items-center h-48">
      <span class="text-base-content/50 text-sm">No data</span>
    </div>
    <div v-show="!loading && data && data.length > 0" :style="{ height: chartHeight + 'px' }">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type { ToolStatsRow } from '../types';
import { getChartThemeColors } from '../utils/chart-theme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const props = defineProps<{
  data: ToolStatsRow[];
  loading: boolean;
}>();

// Dynamic height based on number of tools (minimum 200px)
const chartHeight = computed(() => Math.max(200, props.data.length * 32 + 60));

const chartData = computed(() => ({
  labels: props.data.map((t) => t.name),
  datasets: [
    {
      label: 'Success',
      data: props.data.map((t) => t.success),
      backgroundColor: 'rgba(52, 211, 153, 0.8)',
      borderColor: 'rgba(52, 211, 153, 1)',
      borderWidth: 1,
    },
    {
      label: 'Failure',
      data: props.data.map((t) => t.failure),
      backgroundColor: 'rgba(248, 113, 113, 0.8)',
      borderColor: 'rgba(248, 113, 113, 1)',
      borderWidth: 1,
    },
  ],
}));

const chartOptions = computed(() => {
  const themeColors = getChartThemeColors();
  return {
  responsive: true,
  animation: false as const,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  scales: {
    x: {
      stacked: true,
      grid: { color: themeColors.grid },
      ticks: { color: themeColors.text },
    },
    y: {
      stacked: true,
      grid: { color: themeColors.grid },
      ticks: { color: themeColors.text },
    },
  },
  plugins: {
    legend: {
      labels: { color: themeColors.legendText },
    },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { x: number | null } }) => {
          const val = ctx.parsed.x ?? 0;
          return `${ctx.dataset.label}: ${val}`;
        },
      },
    },
  },
};
});
</script>
