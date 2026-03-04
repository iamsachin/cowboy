<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <!-- Plans over time: Bar chart -->
    <div class="card bg-base-200 rounded-box">
      <div class="card-body p-4">
        <h3 class="card-title text-sm">Plans Over Time</h3>
        <div v-if="loading" class="flex justify-center items-center h-48">
          <span class="loading loading-spinner loading-md"></span>
        </div>
        <div v-else-if="!timeseries || timeseries.length === 0" class="flex justify-center items-center h-48">
          <span class="text-base-content/50 text-sm">No data</span>
        </div>
        <div v-else class="h-64">
          <Bar :data="barChartData" :options="barChartOptions" />
        </div>
      </div>
    </div>

    <!-- Completion rate trend: Line chart -->
    <div class="card bg-base-200 rounded-box">
      <div class="card-body p-4">
        <h3 class="card-title text-sm">Completion Rate Trend</h3>
        <div v-if="loading" class="flex justify-center items-center h-48">
          <span class="loading loading-spinner loading-md"></span>
        </div>
        <div v-else-if="!timeseries || timeseries.length === 0" class="flex justify-center items-center h-48">
          <span class="text-base-content/50 text-sm">No data</span>
        </div>
        <div v-else class="h-64">
          <Line :data="lineChartData" :options="lineChartOptions" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Bar, Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type { PlanTimeSeriesPoint } from '@cowboy/shared';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const props = defineProps<{
  timeseries: PlanTimeSeriesPoint[] | null;
  loading: boolean;
}>();

const barChartData = computed(() => ({
  labels: (props.timeseries ?? []).map((p) => p.period),
  datasets: [
    {
      label: 'Plans',
      data: (props.timeseries ?? []).map((p) => p.planCount),
      backgroundColor: 'rgba(129, 140, 248, 0.8)',
      borderColor: 'rgba(129, 140, 248, 1)',
      borderWidth: 1,
      borderRadius: 4,
    },
  ],
}));

const barChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.1)' },
      ticks: { color: 'rgba(255, 255, 255, 0.7)', maxRotation: 45, font: { size: 10 } },
    },
    y: {
      grid: { color: 'rgba(255, 255, 255, 0.1)' },
      ticks: {
        color: 'rgba(255, 255, 255, 0.7)',
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
          return `Plans: ${val}`;
        },
      },
    },
  },
}));

const lineChartData = computed(() => ({
  labels: (props.timeseries ?? []).map((p) => p.period),
  datasets: [
    {
      label: 'Completion Rate',
      data: (props.timeseries ?? []).map((p) => p.completionRate),
      borderColor: 'rgba(52, 211, 153, 1)',
      backgroundColor: 'rgba(52, 211, 153, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: 'rgba(52, 211, 153, 1)',
    },
  ],
}));

const lineChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.1)' },
      ticks: { color: 'rgba(255, 255, 255, 0.7)', maxRotation: 45, font: { size: 10 } },
    },
    y: {
      grid: { color: 'rgba(255, 255, 255, 0.1)' },
      ticks: {
        color: 'rgba(255, 255, 255, 0.7)',
        callback: (value: number | string) => `${Number(value)}%`,
      },
      min: 0,
      max: 100,
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx: { parsed: { y: number | null } }) => {
          const val = ctx.parsed.y ?? 0;
          return `Completion: ${val.toFixed(1)}%`;
        },
      },
    },
  },
}));
</script>
