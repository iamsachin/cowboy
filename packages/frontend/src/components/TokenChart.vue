<template>
  <div class="card bg-base-200 rounded-box">
    <div class="card-body">
      <h2 class="card-title text-sm">Token Usage Over Time</h2>
      <div v-if="loading" class="flex justify-center items-center h-48">
        <span class="loading loading-spinner loading-md"></span>
      </div>
      <div v-else-if="!data || data.length === 0" class="flex justify-center items-center h-48">
        <span class="text-base-content/50 text-sm">No data</span>
      </div>
      <div v-else class="h-64">
        <Line :data="chartData" :options="chartOptions" />
      </div>
    </div>
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
import type { TimeSeriesPoint } from '@cowboy/shared';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const props = withDefaults(defineProps<{
  data: TimeSeriesPoint[];
  loading?: boolean;
}>(), { loading: false });

const chartData = computed(() => ({
  labels: props.data.map((p) => p.period),
  datasets: [
    {
      label: 'Input',
      data: props.data.map((p) => p.inputTokens),
      borderColor: 'rgba(56, 189, 248, 0.8)',
      backgroundColor: 'rgba(56, 189, 248, 0.3)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    },
    {
      label: 'Output',
      data: props.data.map((p) => p.outputTokens),
      borderColor: 'rgba(192, 132, 252, 0.8)',
      backgroundColor: 'rgba(192, 132, 252, 0.3)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    },
    {
      label: 'Cache Read',
      data: props.data.map((p) => p.cacheReadTokens),
      borderColor: 'rgba(52, 211, 153, 0.8)',
      backgroundColor: 'rgba(52, 211, 153, 0.3)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    },
    {
      label: 'Cache Creation',
      data: props.data.map((p) => p.cacheCreationTokens),
      borderColor: 'rgba(251, 191, 36, 0.8)',
      backgroundColor: 'rgba(251, 191, 36, 0.3)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    },
  ],
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  scales: {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.1)' },
      ticks: { color: 'rgba(255, 255, 255, 0.7)', maxRotation: 45, font: { size: 10 } },
    },
    y: {
      stacked: true,
      grid: { color: 'rgba(255, 255, 255, 0.1)' },
      ticks: {
        color: 'rgba(255, 255, 255, 0.7)',
        callback: (value: number | string) => {
          const n = Number(value);
          if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
          if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
          return String(n);
        },
      },
    },
  },
  plugins: {
    legend: {
      labels: { color: 'rgba(255, 255, 255, 0.7)', boxWidth: 12, font: { size: 11 } },
    },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
          const label = ctx.dataset.label || '';
          const val = ctx.parsed.y ?? 0;
          return `${label}: ${val.toLocaleString()}`;
        },
      },
    },
  },
}));
</script>
