<template>
  <div class="bg-base-200 rounded-lg p-4">
    <h2 class="text-sm font-semibold mb-2">Conversation Activity</h2>
    <div v-show="isEmpty" class="flex justify-center items-center h-48 text-base-content/50">
      No data
    </div>
    <div v-show="!isEmpty" class="h-64">
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
import type { TimeSeriesPoint } from '@cowboy/shared';
import { AGENT_COLORS } from '../utils/agent-constants';
import { getChartThemeColors } from '../utils/chart-theme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const props = defineProps<{
  claudeData: TimeSeriesPoint[];
  cursorData: TimeSeriesPoint[];
}>();

const isEmpty = computed(
  () => props.claudeData.length === 0 && props.cursorData.length === 0
);

// Union of both datasets' periods, sorted
const periods = computed(() => {
  const set = new Set<string>();
  props.claudeData.forEach((p) => set.add(p.period));
  props.cursorData.forEach((p) => set.add(p.period));
  return [...set].sort();
});

function mapConversations(data: TimeSeriesPoint[]): (number | null)[] {
  const lookup = new Map(data.map((p) => [p.period, p.conversationCount]));
  return periods.value.map((period) => lookup.get(period) ?? 0);
}

const chartData = computed(() => ({
  labels: periods.value,
  datasets: [
    {
      label: 'Claude Code',
      data: mapConversations(props.claudeData),
      backgroundColor: AGENT_COLORS['claude-code'].border,
      borderColor: AGENT_COLORS['claude-code'].solid,
      borderWidth: 1,
      borderRadius: 2,
    },
    {
      label: 'Cursor',
      data: mapConversations(props.cursorData),
      backgroundColor: AGENT_COLORS['cursor'].border,
      borderColor: AGENT_COLORS['cursor'].solid,
      borderWidth: 1,
      borderRadius: 2,
    },
  ],
}));

const chartOptions = computed(() => {
  const themeColors = getChartThemeColors();
  return {
  responsive: true,
  animation: false,
  maintainAspectRatio: false,
  scales: {
    x: {
      stacked: true,
      grid: { color: themeColors.grid },
      ticks: { color: themeColors.text, maxRotation: 45, font: { size: 10 } },
    },
    y: {
      stacked: true,
      grid: { color: themeColors.grid },
      ticks: {
        color: themeColors.text,
        stepSize: 1,
      },
    },
  },
  plugins: {
    legend: {
      labels: { color: themeColors.legendText, boxWidth: 12, font: { size: 11 } },
    },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
          const label = ctx.dataset.label || '';
          const val = ctx.parsed.y ?? 0;
          return `${label}: ${val} conversations`;
        },
      },
    },
  },
};
});
</script>
