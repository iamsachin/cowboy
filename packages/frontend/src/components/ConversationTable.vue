<template>
  <div class="bg-base-200 rounded-lg p-4">
    <h2 class="text-lg font-semibold mb-3">Conversations</h2>

    <div class="overflow-x-auto">
      <table class="table table-zebra table-pin-rows table-sm">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.field"
              class="cursor-pointer select-none hover:bg-base-300"
              @click="setSort(col.field)"
            >
              <div class="flex items-center gap-1">
                <span>{{ col.label }}</span>
                <span v-if="sortField === col.field" class="text-xs opacity-70">
                  {{ sortOrder === 'asc' ? '▲' : '▼' }}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading state -->
          <tr v-if="loading && !data">
            <td :colspan="columns.length" class="text-center py-8">
              <span class="loading loading-spinner loading-md"></span>
            </td>
          </tr>

          <!-- Empty state -->
          <tr v-else-if="!data || data.rows.length === 0">
            <td :colspan="columns.length" class="text-center py-8 text-base-content/50">
              No conversations found
            </td>
          </tr>

          <!-- Data rows -->
          <tr v-else v-for="row in data.rows" :key="row.id">
            <td class="whitespace-nowrap">{{ formatDate(row.date) }}</td>
            <td>{{ row.project ?? '--' }}</td>
            <td>
              <div
                class="max-w-[12rem] truncate"
                :class="{ 'tooltip': row.model && row.model.length > 20 }"
                :data-tip="row.model"
              >
                {{ row.model ?? '--' }}
              </div>
            </td>
            <td class="text-right font-mono">{{ formatTokens(row.inputTokens) }}</td>
            <td class="text-right font-mono">{{ formatTokens(row.outputTokens) }}</td>
            <td class="text-right font-mono">{{ formatTokens(row.cacheReadTokens) }}</td>
            <td class="text-right font-mono">{{ formatTokens(row.cacheCreationTokens) }}</td>
            <td class="whitespace-nowrap">
              <template v-if="row.cost !== null">
                <span class="text-primary font-mono">{{ formatCost(row.cost) }}</span>
                <span v-if="row.savings !== null && row.savings > 0" class="text-success text-xs ml-1">
                  (saved {{ formatCost(row.savings) }})
                </span>
              </template>
              <span
                v-else
                class="text-base-content/40 tooltip"
                data-tip="Unknown model"
              >
                N/A
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination footer -->
    <div
      v-if="data && data.total > 0"
      class="flex items-center justify-between mt-3 text-sm flex-wrap gap-2"
    >
      <span class="text-base-content/60">
        Showing {{ rangeStart }}-{{ rangeEnd }} of {{ data.total }} conversations
      </span>
      <div class="join">
        <button
          class="join-item btn btn-sm"
          :disabled="page <= 1"
          @click="setPage(page - 1)"
        >
          &laquo;
        </button>
        <button
          v-for="p in visiblePages"
          :key="p"
          class="join-item btn btn-sm"
          :class="{ 'btn-active': p === page }"
          @click="setPage(p)"
        >
          {{ p }}
        </button>
        <button
          class="join-item btn btn-sm"
          :disabled="page >= totalPages"
          @click="setPage(page + 1)"
        >
          &raquo;
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useConversations } from '../composables/useConversations';

const { data, loading, page, sortField, sortOrder, setSort, setPage } = useConversations();

const columns = [
  { field: 'date', label: 'Date' },
  { field: 'project', label: 'Project' },
  { field: 'model', label: 'Model' },
  { field: 'inputTokens', label: 'Input Tokens' },
  { field: 'outputTokens', label: 'Output Tokens' },
  { field: 'cacheReadTokens', label: 'Cache Read' },
  { field: 'cacheCreationTokens', label: 'Cache Creation' },
  { field: 'cost', label: 'Cost' },
];

const tokenFormatter = new Intl.NumberFormat('en-US');
const costFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  // Use compact YYYY-MM-DD format
  return d.toISOString().slice(0, 10);
}

function formatTokens(n: number): string {
  return tokenFormatter.format(n);
}

function formatCost(n: number): string {
  return costFormatter.format(n);
}

const totalPages = computed(() => {
  if (!data.value) return 1;
  return Math.max(1, Math.ceil(data.value.total / data.value.limit));
});

const rangeStart = computed(() => {
  if (!data.value) return 0;
  return (data.value.page - 1) * data.value.limit + 1;
});

const rangeEnd = computed(() => {
  if (!data.value) return 0;
  return Math.min(data.value.page * data.value.limit, data.value.total);
});

const visiblePages = computed(() => {
  const total = totalPages.value;
  const current = page.value;
  const maxVisible = 5;

  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  // Center current page in window
  let start = Math.max(1, current - Math.floor(maxVisible / 2));
  let end = start + maxVisible - 1;

  if (end > total) {
    end = total;
    start = Math.max(1, end - maxVisible + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
});
</script>
