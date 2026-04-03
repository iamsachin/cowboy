<template>
  <div class="bg-base-200 rounded-lg p-4">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-lg font-semibold">Top Conversations by {{ sortMode === 'cost' ? 'Cost' : 'Tokens' }}</h2>
      <div class="join">
        <button
          class="join-item btn btn-xs"
          :class="sortMode === 'cost' ? 'btn-primary' : 'btn-ghost'"
          @click="setSortMode('cost')"
        >Cost</button>
        <button
          class="join-item btn btn-xs"
          :class="sortMode === 'tokens' ? 'btn-primary' : 'btn-ghost'"
          @click="setSortMode('tokens')"
        >Tokens</button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading && rows.length === 0" class="flex justify-center py-6">
      <span class="loading loading-spinner loading-md"></span>
    </div>

    <!-- Empty state -->
    <div v-else-if="rows.length === 0" class="text-center py-6 text-base-content/50">
      No conversations in this period
    </div>

    <!-- Data table -->
    <div v-else class="overflow-x-auto">
      <table class="table table-zebra table-sm">
        <thead>
          <tr>
            <th class="w-12"></th>
            <th>Title</th>
            <th>Project</th>
            <th>Agent</th>
            <th class="text-right">Tokens</th>
            <th class="text-right">Cost</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in rows"
            :key="row.id"
            class="cursor-pointer hover"
            @click="router.push({ name: 'conversation-detail', params: { id: row.id } })"
          >
            <td>
              <span class="badge badge-sm badge-ghost font-bold">
                {{ index + 1 }}
              </span>
            </td>
            <td>
              <div class="max-w-[12rem] truncate">
                {{ row.title ? truncate(row.title, 30) : 'Untitled' }}
              </div>
            </td>
            <td>{{ row.project ?? '--' }}</td>
            <td><AgentBadge :agent="row.agent" /></td>
            <td class="text-right font-mono">
              {{ numberFormatter.format(row.inputTokens + row.outputTokens) }}
            </td>
            <td class="text-right whitespace-nowrap">
              <span v-if="row.cost !== null" class="text-primary font-mono">
                {{ currencyFormatter.format(row.cost) }}
              </span>
              <span v-else class="text-base-content/40">--</span>
            </td>
            <td class="whitespace-nowrap">
              {{ dateFormatter.format(new Date(row.date)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onScopeDispose } from 'vue';
import { useRouter } from 'vue-router';
import AgentBadge from './AgentBadge.vue';
import { useDateRange } from '../composables/useDateRange';
import { useWebSocket } from '../composables/useWebSocket';
import type { ConversationRow } from '../types';
import { API_BASE } from '../utils/api-base';

type SortMode = 'cost' | 'tokens';
const STORAGE_KEY = 'topConversations:sortMode';

const router = useRouter();
const { dateRange } = useDateRange();

const rows = ref<ConversationRow[]>([]);
const loading = ref(false);
const sortMode = ref<SortMode>((localStorage.getItem(STORAGE_KEY) as SortMode) || 'cost');

function setSortMode(mode: SortMode) {
  sortMode.value = mode;
  localStorage.setItem(STORAGE_KEY, mode);
}


const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

async function fetchTop(isLive = false) {
  if (!isLive) loading.value = true;
  try {
    const { from, to } = dateRange.value;
    const sort = sortMode.value === 'tokens' ? 'inputTokens' : 'cost';
    const res = await fetch(
      `${API_BASE}/api/analytics/conversations?sort=${sort}&order=desc&limit=3&from=${from}&to=${to}`
    );
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();
    rows.value = data.rows;
  } catch {
    // Silently fail - widget is non-critical
  } finally {
    loading.value = false;
  }
}

watch(
  () => [dateRange.value, sortMode.value],
  () => fetchTop(),
  { deep: true, immediate: true }
);

// Debounced WS refetch
let wsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedWsRefetch(): void {
  if (wsDebounceTimer) clearTimeout(wsDebounceTimer);
  wsDebounceTimer = setTimeout(() => {
    wsDebounceTimer = null;
    fetchTop(true);
  }, 500);
}

const { on } = useWebSocket();
on('conversation:changed', debouncedWsRefetch);
on('conversation:created', debouncedWsRefetch);
on('system:full-refresh', debouncedWsRefetch);

onScopeDispose(() => {
  if (wsDebounceTimer) {
    clearTimeout(wsDebounceTimer);
    wsDebounceTimer = null;
  }
});
</script>
