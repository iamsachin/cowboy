<template>
  <div class="bg-base-200 rounded-lg p-4">
    <h2 class="text-sm font-semibold mb-2">{{ title }}</h2>
    <div v-if="isEmpty" class="flex justify-center items-center h-48 text-base-content/50">
      No data
    </div>
    <div v-else class="h-64">
      <Line :data="chartData" :options="chartOptions" />
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
import { AGENT_COLORS } from '../utils/agent-constants';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const props = defineProps<{
  claudeData: TimeSeriesPoint[];
  cursorData: TimeSeriesPoint[];
  metric: 'tokens' | 'cost' | 'conversations';
  title: string;
}>();

function getValue(point: TimeSeriesPoint, metric: string): number {
  switch (metric) {
    case 'tokens':
      return point.inputTokens + point.outputTokens;
    case 'cost':
      return point.cost;
    case 'conversations':
      return point.conversationCount;
    default:
      return 0;
  }
}

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

function mapToPeriods(data: TimeSeriesPoint[]): (number | null)[] {
  const lookup = new Map(data.map((p) => [p.period, p]));
  return periods.value.map((period) => {
    const point = lookup.get(period);
    return point ? getValue(point, props.metric) : null;
  });
}

const chartData = computed(() => ({
  labels: periods.value,
  datasets: [
    {
      label: 'Claude Code',
      data: mapToPeriods(props.claudeData),
      borderColor: AGENT_COLORS['claude-code'].border,
      backgroundColor: AGENT_COLORS['claude-code'].background,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      spanGaps: true,
    },
    {
      label: 'Cursor',
      data: mapToPeriods(props.cursorData),
      borderColor: AGENT_COLORS['cursor'].border,
      backgroundColor: AGENT_COLORS['cursor'].background,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      spanGaps: true,
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
      grid: { color: 'rgba(255, 255, 255, 0.1)' },
      ticks: {
        color: 'rgba(255, 255, 255, 0.7)',
        callback: (value: number | string) => {
          const n = Number(value);
          if (props.metric === 'cost') return `$${n.toFixed(2)}`;
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
          if (props.metric === 'cost') return `${label}: $${val.toFixed(4)}`;
          return `${label}: ${val.toLocaleString()}`;
        },
      },
    },
  },
}));
</script>
