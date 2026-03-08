<template>
  <div class="card bg-base-200 rounded-box">
    <div class="card-body">
      <h2 class="card-title text-sm">Conversations Per Day</h2>
      <div v-if="loading" class="flex justify-center items-center h-48">
        <span class="loading loading-spinner loading-md"></span>
      </div>
      <div v-else-if="!data || data.length === 0" class="flex justify-center items-center h-48">
        <span class="text-base-content/50 text-sm">No data</span>
      </div>
      <div v-else class="h-64">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
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
import type { TimeSeriesPoint } from '@cowboy/shared';
import { getChartThemeColors } from '../utils/chart-theme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const props = withDefaults(defineProps<{
  data: TimeSeriesPoint[];
  loading?: boolean;
}>(), { loading: false });

const chartData = computed(() => ({
  labels: props.data.map((p) => p.period),
  datasets: [
    {
      label: 'Conversations',
      data: props.data.map((p) => p.conversationCount),
      backgroundColor: 'rgba(96, 165, 250, 0.8)',
      borderColor: 'rgba(96, 165, 250, 1)',
      borderWidth: 1,
      borderRadius: 4,
    },
  ],
}));

const chartOptions = computed(() => {
  const themeColors = getChartThemeColors();
  return {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      grid: { color: themeColors.grid },
      ticks: { color: themeColors.text, maxRotation: 45, font: { size: 10 } },
    },
    y: {
      grid: { color: themeColors.grid },
      ticks: {
        color: themeColors.text,
        stepSize: 1,
      },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: { y: number | null } }) => {
          const val = ctx.parsed.y ?? 0;
          return `Conversations: ${val}`;
        },
      },
    },
  },
};
});
</script>
