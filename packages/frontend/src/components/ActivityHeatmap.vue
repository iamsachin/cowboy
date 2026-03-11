<template>
  <div>
    <div v-if="loading" class="flex justify-center items-center h-32">
      <span class="loading loading-spinner loading-md"></span>
    </div>
    <div v-else-if="!data || data.length === 0" class="flex justify-center items-center h-32">
      <span class="text-base-content/50 text-sm">No data</span>
    </div>
    <div v-else class="overflow-x-auto">
      <div class="flex gap-1">
        <!-- Day-of-week labels -->
        <div class="flex flex-col shrink-0" :style="{ gap: '2px' }">
          <div
            v-for="(label, i) in dayLabels"
            :key="i"
            class="text-xs text-base-content/50 flex items-center justify-end pr-1"
            :style="{ height: '12px', width: '24px' }"
          >
            {{ label }}
          </div>
        </div>
        <!-- Heatmap grid -->
        <div
          class="heatmap-grid"
          :style="{
            display: 'grid',
            gridTemplateRows: 'repeat(7, 12px)',
            gridAutoFlow: 'column',
            gridAutoColumns: '12px',
            gap: '2px',
          }"
        >
          <div
            v-for="(cell, i) in cells"
            :key="i"
            class="rounded-sm cursor-pointer hover:ring-1 hover:ring-base-content/30 tooltip"
            :data-tip="`${cell.date}: ${cell.count} conversation${cell.count !== 1 ? 's' : ''}`"
            :style="{
              width: '12px',
              height: '12px',
              backgroundColor: intensityColor(cell.count, maxCount),
            }"
            @click="$emit('drillDown', cell.date)"
          ></div>
        </div>
      </div>
      <!-- Color scale legend -->
      <div class="flex items-center gap-1 mt-2">
        <span class="text-xs text-base-content/50">Less</span>
        <div
          v-for="level in legendLevels"
          :key="level"
          class="rounded-sm"
          :style="{
            width: '12px',
            height: '12px',
            backgroundColor: intensityColor(level, 4),
          }"
        ></div>
        <span class="text-xs text-base-content/50">More</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HeatmapDay } from '../types';

const props = defineProps<{
  data: HeatmapDay[];
  loading: boolean;
}>();

defineEmits<{
  drillDown: [date: string];
}>();

const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

interface HeatmapCell {
  date: string;
  count: number;
}

const cells = computed<HeatmapCell[]>(() => {
  if (!props.data || props.data.length === 0) return [];

  // Build a map of date -> count
  const countMap = new Map<string, number>();
  for (const d of props.data) {
    countMap.set(d.date, d.count);
  }

  // Find min/max dates from data
  const dates = props.data.map((d) => d.date).sort();
  const minDate = new Date(dates[0] + 'T00:00:00');
  const maxDate = new Date(dates[dates.length - 1] + 'T00:00:00');

  // Align start to Sunday (go back to previous Sunday)
  const startDate = new Date(minDate);
  const dayOfWeek = startDate.getDay(); // 0=Sun, 1=Mon, ...
  startDate.setDate(startDate.getDate() - dayOfWeek);

  // Align end to Saturday (go forward to next Saturday)
  const endDate = new Date(maxDate);
  const endDayOfWeek = endDate.getDay();
  if (endDayOfWeek !== 6) {
    endDate.setDate(endDate.getDate() + (6 - endDayOfWeek));
  }

  // Generate all cells from startDate to endDate
  const result: HeatmapCell[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    result.push({
      date: dateStr,
      count: countMap.get(dateStr) ?? 0,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
});

const maxCount = computed(() => {
  if (cells.value.length === 0) return 0;
  return Math.max(...cells.value.map((c) => c.count));
});

const legendLevels = [0, 1, 2, 3, 4];

function intensityColor(count: number, max: number): string {
  if (count === 0 || max === 0) return 'var(--heatmap-0)';

  const ratio = count / max;
  if (ratio <= 0.25) return 'var(--heatmap-1)';
  if (ratio <= 0.5) return 'var(--heatmap-2)';
  if (ratio <= 0.75) return 'var(--heatmap-3)';
  return 'var(--heatmap-4)';
}
</script>

<style scoped>
div {
  --heatmap-0: oklch(var(--b3));
  --heatmap-1: oklch(var(--su) / 0.25);
  --heatmap-2: oklch(var(--su) / 0.50);
  --heatmap-3: oklch(var(--su) / 0.75);
  --heatmap-4: oklch(var(--su) / 1.0);
}
</style>
