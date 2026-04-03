<template>
  <div v-show="data.length === 0" class="flex justify-center items-center h-full">
    <span class="text-base-content/50 text-sm">No data</span>
  </div>
  <div v-show="data.length > 0" class="h-full">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import type { TokenRatePoint } from '../types';
import { getChartThemeColors } from '../utils/chart-theme';
import { formatTokenCount } from '../utils/format-tokens';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const props = defineProps<{
  data: TokenRatePoint[];
}>();

const chartData = computed(() => {
  const themeColors = getChartThemeColors();
  return {
    labels: props.data.map((p) => {
      // Convert UTC minute string to local HH:MM for display
      const d = new Date(p.minute + ':00Z');
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }),
    datasets: [
      {
        label: 'Input',
        data: props.data.map((p) => p.inputTokens),
        borderColor: themeColors.inputBorder,
        backgroundColor: themeColors.inputFill,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
      {
        label: 'Output',
        data: props.data.map((p) => p.outputTokens),
        borderColor: themeColors.outputBorder,
        backgroundColor: themeColors.outputFill,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
    ],
  };
});

const chartOptions = computed(() => {
  const themeColors = getChartThemeColors();
  return {
    responsive: true,
    animation: false as const,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      x: {
        grid: { color: themeColors.grid },
        ticks: {
          color: themeColors.text,
          maxRotation: 0,
          font: { size: 9 },
          maxTicksLimit: 8,
        },
      },
      y: {
        min: 0,
        grid: { color: themeColors.grid },
        ticks: {
          color: themeColors.text,
          callback: (value: number | string) => {
            const n = Number(value);
            return formatTokenCount(n);
          },
        },
      },
    },
    plugins: {
      legend: {
        labels: { color: themeColors.legendText, boxWidth: 10, font: { size: 10 }, usePointStyle: true, pointStyle: 'circle' },
      },
      tooltip: {
        usePointStyle: true,
        callbacks: {
          title: (items: { label?: string }[]) => {
            return items[0]?.label ?? '';
          },
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const label = ctx.dataset.label || '';
            const val = ctx.parsed.y ?? 0;
            return `${label}: ${val.toLocaleString()} tokens`;
          },
        },
      },
    },
  };
});
</script>
