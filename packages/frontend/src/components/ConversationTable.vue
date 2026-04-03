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
          <template
            v-else
            v-for="row in displayRows"
            :key="row.id"
          >
            <tr
              class="cursor-pointer hover"
              :class="{
                'row-highlight': newIds.has(row.id),
                'sub-row': row._isChild,
              }"
              @click="router.push({ name: 'conversation-detail', params: { id: row.id } })"
            >
              <td>
                <div class="max-w-[16rem] flex items-center gap-1.5">
                  <span
                    v-if="('isActive' in row) && row.isActive"
                    class="pulse-dot shrink-0"
                    title="Running"
                  ></span>
                  <div class="truncate">{{ cleanTitle(row.title ?? '') || '--' }}</div>
                  <div
                    v-if="row.hasCompaction"
                    class="tooltip tooltip-top shrink-0"
                    data-tip="Context was compacted"
                  >
                    <Scissors class="w-3 h-3 text-amber-400" />
                  </div>
                </div>
              </td>
              <td class="whitespace-nowrap" :class="{ 'pl-8': row._isChild }">
                <BotIcon v-if="row._isChild" class="w-3 h-3 text-base-content/30 mr-1 inline" />{{ formatDate(row.date) }}
              </td>
              <td><AgentBadge v-if="!row._isChild" :agent="row.agent" /></td>
              <td><span v-if="!row._isChild">{{ row.project ?? '--' }}</span></td>
              <td>
                <div
                  class="max-w-[12rem] truncate"
                  :class="{ 'tooltip': row.model && row.model.length > 20 }"
                  :data-tip="row.model"
                >
                  {{ row.model ?? '--' }}
                </div>
              </td>
              <td class="text-right font-mono">
                {{ formatTokens(row.inputTokens + row.outputTokens) }}
                <span v-if="row._childrenTokens" class="text-base-content/40 text-xs ml-1">(+{{ formatTokens(row._childrenTokens) }})</span>
              </td>
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
          </template>
        </tbody>
      </table>
    </div>

    <!-- Pagination footer -->
    <div
      v-if="data && data.total > 0"
      class="flex items-center gap-4 mt-3 text-sm flex-wrap"
    >
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
      <span class="text-base-content/60">
        Showing {{ rangeStart }}-{{ rangeEnd }} of {{ data.total }} conversations
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useConversations } from '../composables/useConversations';
import { Scissors, Bot as BotIcon } from 'lucide-vue-next';
import AgentBadge from './AgentBadge.vue';
import { formatCost } from '../utils/format-tokens';
import { cleanTitle } from '../utils/content-sanitizer';
import type { ConversationRow } from '../types';

const props = defineProps<{
  agent?: string;
}>();

const router = useRouter();

const agentRef = computed(() => props.agent);
const { data, loading, refreshing, page, sortField, sortOrder, setSort, setPage, newIds } = useConversations(agentRef);

const displayRows = computed(() => {
  if (!data.value) return [];
  const result: Array<ConversationRow & { _isChild?: boolean; _childrenTokens?: number }> = [];
  for (const row of data.value.rows) {
    const childrenTokens = row.children
      ? row.children.reduce((sum, c) => sum + c.inputTokens + c.outputTokens, 0)
      : 0;
    result.push({ ...row, _childrenTokens: childrenTokens || undefined });
    if (row.children) {
      for (const child of row.children) {
        result.push({ ...child, _isChild: true });
      }
    }
  }
  return result;
});

const columns = [
  { field: 'title', label: 'Title' },
  { field: 'date', label: 'Date' },
  { field: 'agent', label: 'Agent' },
  { field: 'project', label: 'Project' },
  { field: 'model', label: 'Model' },
  { field: 'inputTokens', label: 'Tokens' },
  { field: 'cost', label: 'Cost' },
];

const tokenFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTokens(n: number): string {
  return tokenFormatter.format(n);
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

<style scoped>
.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: oklch(0.72 0.19 142);
  animation: pulse-fade 1.5s ease-in-out infinite;
}

@keyframes pulse-fade {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.row-highlight {
  animation: row-enter 2s ease-out;
}
@keyframes row-enter {
  0% { background-color: oklch(0.85 0.1 142 / 0.3); }
  100% { background-color: transparent; }
}
</style>
