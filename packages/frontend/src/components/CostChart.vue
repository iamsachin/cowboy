<template>
  <div class="card bg-base-200 rounded-box">
    <div class="card-body">
      <h2 class="card-title text-sm">Cost Trend</h2>
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
  LineElement,
  PointElement,
  LineController,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import type { TimeSeriesPoint } from '@cowboy/shared';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  LineController,
  Filler,
  Tooltip,
  Legend,
);

const props = withDefaults(defineProps<{
  data: TimeSeriesPoint[];
  loading?: boolean;
}>(), { loading: false });

/**
 * Generate future period labels by parsing the last historical label
 * and incrementing based on detected granularity (daily, weekly, monthly).
 */
function generateFutureLabels(labels: string[], count: number): string[] {
  if (labels.length === 0 || count <= 0) return [];

  const last = labels[labels.length - 1];
  const future: string[] = [];

  // Weekly: YYYY-WXX pattern
  const weekMatch = last.match(/^(\d{4})-W(\d{2})$/);
  if (weekMatch) {
    let year = parseInt(weekMatch[1], 10);
    let week = parseInt(weekMatch[2], 10);
    for (let i = 0; i < count; i++) {
      week++;
      if (week > 52) {
        week = 1;
        year++;
      }
      future.push(`${year}-W${String(week).padStart(2, '0')}`);
    }
    return future;
  }

  // Monthly: YYYY-MM pattern (exactly 7 chars)
  const monthMatch = last.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    let year = parseInt(monthMatch[1], 10);
    let month = parseInt(monthMatch[2], 10);
    for (let i = 0; i < count; i++) {
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
      future.push(`${year}-${String(month).padStart(2, '0')}`);
    }
    return future;
  }

  // Daily: YYYY-MM-DD pattern (default)
  const dateMatch = last.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const d = new Date(`${last}T00:00:00Z`);
    for (let i = 0; i < count; i++) {
      d.setUTCDate(d.getUTCDate() + 1);
      future.push(d.toISOString().slice(0, 10));
    }
    return future;
  }

  // Fallback: simple +N labels
  for (let i = 1; i <= count; i++) {
    future.push(`+${i}`);
  }
  return future;
}

/**
 * Compute projection data arrays for the cost chart.
 * Uses a simple moving average with standard deviation confidence band.
 */
function computeProjection(timeseries: TimeSeriesPoint[]): {
  labels: string[];
  historicalCosts: (number | null)[];
  projectionLine: (number | null)[];
  upperBound: (number | null)[];
  lowerBound: (number | null)[];
} {
  const costs = timeseries.map((p) => p.cost);
  const labels = timeseries.map((p) => p.period);
  const n = costs.length;

  if (n <= 1) {
    return {
      labels,
      historicalCosts: costs,
      projectionLine: [],
      upperBound: [],
      lowerBound: [],
    };
  }

  // Moving average = mean cost
  const avgCost = costs.reduce((a, b) => a + b, 0) / n;

  // Standard deviation for confidence band
  const variance = costs.reduce((sum, c) => sum + (c - avgCost) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  // Project forward same number of periods as historical (symmetric)
  const futureLabels = generateFutureLabels(labels, n);
  const allLabels = [...labels, ...futureLabels];

  // Historical costs padded with null for projection slots
  const historicalCosts: (number | null)[] = [...costs, ...Array(n).fill(null)];

  // Projection line: null for historical, overlap at last historical point, then avgCost
  const projectionLine: (number | null)[] = [
    ...Array(n - 1).fill(null),
    costs[n - 1], // overlap at last historical point for visual continuity
    ...Array(n).fill(avgCost),
  ];

  // Upper bound: null for historical, overlap, then avgCost + stdDev
  const upperBound: (number | null)[] = [
    ...Array(n - 1).fill(null),
    costs[n - 1],
    ...Array(n).fill(Math.max(0, avgCost + stdDev)),
  ];

  // Lower bound: null for historical, overlap, then avgCost - stdDev (min 0)
  const lowerBound: (number | null)[] = [
    ...Array(n - 1).fill(null),
    costs[n - 1],
    ...Array(n).fill(Math.max(0, avgCost - stdDev)),
  ];

  return { labels: allLabels, historicalCosts, projectionLine, upperBound, lowerBound };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chartData = computed<any>(() => {
  if (!props.data || props.data.length <= 1) {
    // 0-1 data points: no projection, just the bar chart
    return {
      labels: props.data.map((p) => p.period),
      datasets: [
        {
          label: 'Cost',
          data: props.data.map((p) => p.cost),
          backgroundColor: 'rgba(244, 114, 182, 0.8)',
          borderColor: 'rgba(244, 114, 182, 1)',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }

  const projection = computeProjection(props.data);

  return {
    labels: projection.labels,
    datasets: [
      {
        label: 'Cost',
        data: projection.historicalCosts,
        backgroundColor: 'rgba(244, 114, 182, 0.8)',
        borderColor: 'rgba(244, 114, 182, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        type: 'line' as const,
        label: 'Projected',
        data: projection.projectionLine,
        borderColor: 'rgba(244, 114, 182, 0.7)',
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
        spanGaps: false,
      },
      {
        type: 'line' as const,
        label: 'Upper bound',
        data: projection.upperBound,
        borderColor: 'transparent',
        pointRadius: 0,
        fill: '+1',
        backgroundColor: 'rgba(244, 114, 182, 0.1)',
        spanGaps: false,
      },
      {
        type: 'line' as const,
        label: 'Lower bound',
        data: projection.lowerBound,
        borderColor: 'transparent',
        pointRadius: 0,
        fill: false,
        spanGaps: false,
      },
    ],
  };
});

const chartOptions = computed(() => ({
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
        callback: (value: number | string) => `$${Number(value).toFixed(2)}`,
      },
    },
  },
  plugins: {
    legend: {
      display: true,
      labels: {
        filter: (item: { text: string }) =>
          !['Upper bound', 'Lower bound'].includes(item.text),
        color: 'rgba(255, 255, 255, 0.7)',
      },
    },
    tooltip: {
      filter: (tooltipItem: { dataset: { label?: string } }) =>
        !['Upper bound', 'Lower bound'].includes(tooltipItem.dataset.label ?? ''),
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
          const val = ctx.parsed.y ?? 0;
          const label = ctx.dataset.label ?? 'Cost';
          return `${label}: $${val.toFixed(4)}`;
        },
      },
    },
  },
}));
</script>
