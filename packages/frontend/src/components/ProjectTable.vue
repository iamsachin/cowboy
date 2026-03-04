<template>
  <div>
    <div v-if="loading" class="flex justify-center items-center h-48">
      <span class="loading loading-spinner loading-md"></span>
    </div>
    <div v-else-if="!data || data.length === 0" class="flex justify-center items-center h-48">
      <span class="text-base-content/50 text-sm">No data</span>
    </div>
    <div v-else class="overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th class="w-8"></th>
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
          <template v-for="row in sortedData" :key="row.project">
            <!-- Main row -->
            <tr
              class="cursor-pointer hover"
              @click="toggleExpand(row.project)"
            >
              <td>
                <ChevronRight
                  class="w-4 h-4 transition-transform"
                  :class="expanded.has(row.project) ? 'rotate-90' : ''"
                />
              </td>
              <td class="font-medium">{{ row.project }}</td>
              <td>{{ row.conversationCount }}</td>
              <td>{{ formatTokens(row.totalTokens) }}</td>
              <td>{{ formatCost(row.totalCost) }}</td>
              <td>{{ formatRelativeDate(row.lastActive) }}</td>
            </tr>
            <!-- Expanded detail row -->
            <tr v-if="expanded.has(row.project)">
              <td :colspan="columns.length + 1" class="bg-base-300 p-4">
                <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  <!-- Token breakdown KPIs (4 cols) -->
                  <div class="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard
                      title="Input Tokens"
                      :value="formatTokens(row.totalInput)"
                      description="Total input tokens"
                      :icon="ArrowDownRight"
                    />
                    <KpiCard
                      title="Output Tokens"
                      :value="formatTokens(row.totalOutput)"
                      description="Total output tokens"
                      :icon="ArrowUpRight"
                    />
                    <KpiCard
                      title="Cache Read"
                      :value="formatTokens(row.totalCacheRead)"
                      description="Cache read tokens"
                      :icon="Database"
                    />
                    <KpiCard
                      title="Cache Creation"
                      :value="formatTokens(row.totalCacheCreation)"
                      description="Cache creation tokens"
                      :icon="HardDrive"
                    />
                  </div>
                  <!-- Model distribution (1 col) -->
                  <div class="lg:col-span-1">
                    <h3 class="text-xs font-semibold uppercase tracking-wide text-base-content/60 mb-2">
                      Models
                    </h3>
                    <div v-if="row.topModels && row.topModels.length > 0" class="flex flex-wrap gap-1">
                      <span
                        v-for="m in row.topModels"
                        :key="m.model"
                        class="badge badge-sm badge-ghost"
                      >
                        {{ m.model }} ({{ m.count }})
                      </span>
                    </div>
                    <span v-else class="text-sm text-base-content/50">No model data</span>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ProjectStatsRow } from '@cowboy/shared';
import KpiCard from './KpiCard.vue';
import {
  ChevronRight,
  ArrowDownRight,
  ArrowUpRight,
  Database,
  HardDrive,
} from 'lucide-vue-next';

const props = defineProps<{
  data: ProjectStatsRow[];
  loading: boolean;
}>();

const columns = [
  { key: 'project', label: 'Project' },
  { key: 'conversationCount', label: 'Conversations' },
  { key: 'totalTokens', label: 'Total Tokens' },
  { key: 'totalCost', label: 'Cost' },
  { key: 'lastActive', label: 'Last Active' },
];

const expanded = ref<Set<string>>(new Set());
const sortBy = ref<string>('totalCost');
const sortOrder = ref<'asc' | 'desc'>('desc');

function toggleExpand(project: string) {
  const next = new Set(expanded.value);
  if (next.has(project)) {
    next.delete(project);
  } else {
    next.add(project);
  }
  expanded.value = next;
}

function toggleSort(key: string) {
  if (sortBy.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = key;
    sortOrder.value = 'desc';
  }
}

const sortedData = computed(() => {
  const arr = [...props.data];
  const dir = sortOrder.value === 'asc' ? 1 : -1;
  const key = sortBy.value;

  arr.sort((a, b) => {
    let va: number | string;
    let vb: number | string;

    if (key === 'project') {
      va = a.project.toLowerCase();
      vb = b.project.toLowerCase();
    } else if (key === 'lastActive') {
      va = a.lastActive;
      vb = b.lastActive;
    } else {
      va = (a as Record<string, unknown>)[key] as number ?? 0;
      vb = (b as Record<string, unknown>)[key] as number ?? 0;
    }

    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  return arr;
});

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}
</script>
