<template>
  <div>
    <div v-if="loading" class="flex justify-center items-center h-48">
      <span class="loading loading-spinner loading-md"></span>
    </div>
    <div v-else-if="!data || data.length === 0" class="flex justify-center items-center h-48">
      <span class="text-base-content/50 text-sm">No data</span>
    </div>
    <div v-else class="overflow-x-auto">
      <table class="table table-zebra table-sm">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              class="cursor-pointer select-none hover:text-primary"
              @click="toggleSort(col.key)"
            >
              <div class="flex items-center gap-1">
                {{ col.label }}
                <span v-if="sortBy === col.key" class="text-xs">
                  {{ sortOrder === 'asc' ? '&#9650;' : '&#9660;' }}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in sortedData" :key="row.name">
            <td class="font-mono text-sm">{{ row.name }}</td>
            <td>{{ row.total }}</td>
            <td>{{ formatSuccessRate(row) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ToolStatsRow } from '@cowboy/shared';

const props = defineProps<{
  data: ToolStatsRow[];
  loading: boolean;
}>();

const columns = [
  { key: 'name', label: 'Tool Name' },
  { key: 'total', label: 'Calls' },
  { key: 'successRate', label: 'Success Rate' },
];

const sortBy = ref<string>('total');
const sortOrder = ref<'asc' | 'desc'>('desc');

function toggleSort(key: string) {
  if (sortBy.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = key;
    sortOrder.value = 'desc';
  }
}

function getSuccessRate(row: ToolStatsRow): number {
  const denominator = row.total - (row.unknown ?? 0) - (row.rejected ?? 0);
  if (denominator === 0) return 0;
  return (row.success / denominator) * 100;
}

const sortedData = computed(() => {
  const arr = [...props.data];
  const dir = sortOrder.value === 'asc' ? 1 : -1;
  const key = sortBy.value;

  arr.sort((a, b) => {
    let va: number | string;
    let vb: number | string;

    if (key === 'successRate') {
      va = getSuccessRate(a);
      vb = getSuccessRate(b);
    } else if (key === 'name') {
      va = a.name.toLowerCase();
      vb = b.name.toLowerCase();
    } else {
      va = (a as unknown as Record<string, number>)[key] ?? 0;
      vb = (b as unknown as Record<string, number>)[key] ?? 0;
    }

    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  return arr;
});

function formatSuccessRate(row: ToolStatsRow): string {
  if (row.total === 0) return 'N/A';
  return `${getSuccessRate(row).toFixed(1)}%`;
}

</script>
