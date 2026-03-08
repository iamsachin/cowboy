<template>
  <div class="bg-base-200 rounded-lg p-4">
    <h2 class="text-sm font-semibold mb-2">Model Distribution</h2>
    <div v-show="!data || data.length === 0" class="flex justify-center items-center h-48 text-base-content/50">
      No data
    </div>
    <div v-show="data && data.length > 0" class="h-64">
      <Doughnut :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type { ModelDistributionEntry } from '@cowboy/shared';
import { getChartThemeColors } from '../utils/chart-theme';

ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps<{
  data: ModelDistributionEntry[];
}>();

const PALETTE = [
  'rgba(56, 189, 248, 0.8)',   // sky
  'rgba(168, 85, 247, 0.8)',   // purple
  'rgba(52, 211, 153, 0.8)',   // emerald
  'rgba(251, 191, 36, 0.8)',   // amber
  'rgba(244, 114, 182, 0.8)',  // pink
  'rgba(96, 165, 250, 0.8)',   // blue
  'rgba(248, 113, 113, 0.8)',  // red
  'rgba(163, 230, 53, 0.8)',   // lime
];

const chartData = computed(() => ({
  labels: props.data.map((d) => d.model),
  datasets: [
    {
      data: props.data.map((d) => d.totalTokens),
      backgroundColor: props.data.map((_, i) => PALETTE[i % PALETTE.length]),
      borderColor: 'transparent',
      borderWidth: 1,
    },
  ],
}));

const chartOptions = computed(() => {
  const themeColors = getChartThemeColors();
  return {
  responsive: true,
  animation: false,
  maintainAspectRatio: false,
  cutout: '55%',
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        color: themeColors.legendText,
        boxWidth: 12,
        font: { size: 11 },
        padding: 8,
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx: { label?: string; parsed: number }) => {
          const total = props.data.reduce((sum, d) => sum + d.totalTokens, 0);
          const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
          return `${ctx.label}: ${ctx.parsed.toLocaleString()} tokens (${pct}%)`;
        },
      },
    },
  },
};
});
</script>
