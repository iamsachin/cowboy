<template>
  <div class="bg-base-200 rounded-lg p-4">
    <!-- Filter bar -->
    <div class="flex items-center gap-2 flex-wrap mb-3">
      <select
        class="select select-bordered select-sm"
        :value="agent"
        @change="setAgent(($event.target as HTMLSelectElement).value)"
      >
        <option value="">All Agents</option>
        <option v-for="a in agentOptions" :key="a" :value="a">{{ AGENT_LABELS[a] || a }}</option>
      </select>

      <select
        class="select select-bordered select-sm"
        :value="project"
        @change="setProject(($event.target as HTMLSelectElement).value)"
      >
        <option value="">All Projects</option>
        <option
          v-for="p in projectOptions"
          :key="p"
          :value="p"
        >
          {{ p }}
        </option>
      </select>

      <div class="relative">
        <input
          v-model="searchQuery"
          type="search"
          class="input input-bordered input-sm pr-14"
          placeholder="Search conversations..."
          @keydown.enter="submitSearch"
        />
        <span
          v-if="loading && searchQuery"
          class="absolute right-7 top-1/2 -translate-y-1/2 loading loading-spinner loading-xs"
        ></span>
        <button
          v-if="searchQuery"
          class="absolute right-1 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
          @click="clearSearch"
          title="Clear search"
        >
          &times;
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto relative">
      <!-- Loading overlay for subsequent fetches -->
      <div
        v-if="loading && data"
        class="absolute inset-0 bg-base-200/60 z-10 flex items-center justify-center"
      >
        <span class="loading loading-spinner loading-md"></span>
      </div>

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
                  {{ sortOrder === 'asc' ? '\u25B2' : '\u25BC' }}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody :class="{ 'opacity-50 pointer-events-none': loading && data }">
          <!-- Loading state (first load) -->
          <tr v-if="loading && !data">
            <td :colspan="columns.length" class="text-center py-8">
              <span class="loading loading-spinner loading-md"></span>
            </td>
          </tr>

          <!-- Empty state -->
          <tr v-else-if="!data || data.rows.length === 0">
            <td :colspan="columns.length" class="text-center py-8 text-base-content/50">
              <template v-if="searchQuery">
                No results for '{{ searchQuery }}'
              </template>
              <template v-else>
                No conversations found
              </template>
            </td>
          </tr>

          <!-- Data rows -->
          <template v-else v-for="row in displayRows" :key="row.id">
            <tr
              class="cursor-pointer hover"
              :class="{
                'row-highlight': newIds.has(row.id),
                'sub-row': row._isChild,
              }"
              @click="navigateToDetail(row.id)"
            >
              <td class="whitespace-nowrap" :class="{ 'pl-8': row._isChild }">
                <BotIcon v-if="row._isChild" class="w-3 h-3 text-base-content/30 mr-1 inline" />{{ formatDate(row.date) }}
              </td>
              <td>
                <AgentBadge :agent="row.agent" />
              </td>
              <td>{{ row.project ?? '--' }}</td>
              <td>
                <div class="max-w-[12rem] truncate" :title="row.model ?? ''">
                  {{ row.model ?? '--' }}
                </div>
              </td>
              <td>
                <div class="max-w-[16rem] flex items-center gap-1.5">
                  <span
                    v-if="('isActive' in row) && row.isActive"
                    class="pulse-dot shrink-0"
                    title="Running"
                  ></span>
                  <BotIcon
                    v-if="row._isChild"
                    class="w-3.5 h-3.5 text-info shrink-0"
                    title="Subagent"
                  />
                  <div class="min-w-0">
                    <div class="truncate">{{ cleanTitle(row.title ?? '') }}</div>
                    <div
                      v-if="searchQuery && 'snippet' in row && row.snippet"
                      class="text-xs text-base-content/60 truncate mt-0.5"
                      v-html="sanitizeSnippet(row.snippet as string)"
                    ></div>
                  </div>
                </div>
              </td>
              <td class="text-right font-mono">
                {{ formatTokens(row.inputTokens + row.outputTokens) }}
                <span v-if="row._childrenTokens" class="text-base-content/40 text-xs ml-1">(+{{ formatTokens(row._childrenTokens) }})</span>
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
import DOMPurify from 'dompurify';
import { useConversationBrowser } from '../composables/useConversationBrowser';
import { Bot as BotIcon } from 'lucide-vue-next';
import AgentBadge from './AgentBadge.vue';
import { AGENTS, AGENT_LABELS } from '../utils/agent-constants';
import { cleanTitle } from '../utils/content-sanitizer';
import type { ConversationRow } from '../types';

const router = useRouter();

const {
  data,
  loading,
  refreshing,
  page,
  sortField,
  sortOrder,
  agent,
  project,
  searchQuery,
  setSort,
  setPage,
  setAgent,
  setProject,
  submitSearch,
  clearSearch,
  filterOptions,
  newIds,
} = useConversationBrowser();

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
  { field: 'date', label: 'Date' },
  { field: 'agent', label: 'Agent' },
  { field: 'project', label: 'Project' },
  { field: 'model', label: 'Model' },
  { field: 'title', label: 'Title' },
  { field: 'inputTokens', label: 'Tokens' },
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

function sanitizeSnippet(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['mark'] });
}

function navigateToDetail(id: string): void {
  router.push({ name: 'conversation-detail', params: { id } });
}

// Use API-provided filter options, with fallback to hardcoded/page-derived values
const agentOptions = computed(() => {
  return filterOptions.value?.agents ?? AGENTS;
});

const projectOptions = computed(() => {
  if (filterOptions.value?.projects) return filterOptions.value.projects;
  // Fallback: collect from current page
  if (!data.value) return [];
  const projects = new Set<string>();
  for (const row of data.value.rows) {
    if (row.project) projects.add(row.project);
  }
  return Array.from(projects).sort();
});

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
