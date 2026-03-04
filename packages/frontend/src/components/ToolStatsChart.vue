<template>
  <div>
    <div v-if="loading" class="flex justify-center items-center h-48">
      <span class="loading loading-spinner loading-md"></span>
    </div>
    <div v-else-if="!data || data.length === 0" class="flex justify-center items-center h-48">
      <span class="text-base-content/50 text-sm">No data</span>
    </div>
    <div v-else :style="{ height: chartHeight + 'px' }">
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
import type { ToolStatsRow } from '@cowboy/shared';

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

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  scales: {
    x: {
      stacked: true,
      grid: { color: 'rgba(255, 255, 255, 0.1)' },
      ticks: { color: 'rgba(255, 255, 255, 0.7)' },
    },
    y: {
      stacked: true,
      grid: { color: 'rgba(255, 255, 255, 0.1)' },
      ticks: { color: 'rgba(255, 255, 255, 0.7)' },
    },
  },
  plugins: {
    legend: {
      labels: { color: 'rgba(255, 255, 255, 0.7)' },
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
}));
</script>
