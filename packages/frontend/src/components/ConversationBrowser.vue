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
        <option value="claude-code">Claude Code</option>
      </select>

      <select
        class="select select-bordered select-sm"
        :value="project"
        @change="setProject(($event.target as HTMLSelectElement).value)"
      >
        <option value="">All Projects</option>
        <option
          v-for="p in uniqueProjects"
          :key="p"
          :value="p"
        >
          {{ p }}
        </option>
      </select>

      <input
        v-model="searchQuery"
        type="search"
        class="input input-bordered input-sm"
        placeholder="Search conversations..."
        @keydown.enter="submitSearch"
      />
    </div>

    <!-- Table -->
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
                  {{ sortOrder === 'asc' ? '\u25B2' : '\u25BC' }}
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
              <template v-if="searchQuery">
                No results for '{{ searchQuery }}'
              </template>
              <template v-else>
                No conversations found
              </template>
            </td>
          </tr>

          <!-- Data rows -->
          <template v-else v-for="row in data.rows" :key="row.id">
            <tr
              class="cursor-pointer hover"
              @click="navigateToDetail(row.id)"
            >
              <td class="whitespace-nowrap">{{ formatDate(row.date) }}</td>
              <td>
                <span class="badge badge-sm badge-outline">{{ row.agent }}</span>
              </td>
              <td>{{ row.project ?? '--' }}</td>
              <td>
                <div class="max-w-[12rem] truncate">
                  {{ row.model ?? '--' }}
                </div>
              </td>
              <td>
                <div class="max-w-[16rem] truncate">
                  {{ row.title ?? '--' }}
                </div>
              </td>
              <td class="text-right font-mono">
                {{ formatTokens(row.inputTokens + row.outputTokens) }}
              </td>
            </tr>
            <!-- Search snippet row -->
            <tr
              v-if="searchQuery && 'snippet' in row && row.snippet"
              class="cursor-pointer hover"
              @click="navigateToDetail(row.id)"
            >
              <td :colspan="columns.length" class="pt-0 pb-2 pl-8">
                <span class="text-xs text-base-content/60" v-html="sanitizeSnippet(row.snippet)"></span>
              </td>
            </tr>
          </template>
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
import { useRouter } from 'vue-router';
import { useConversationBrowser } from '../composables/useConversationBrowser';

const router = useRouter();

const {
  data,
  loading,
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
} = useConversationBrowser();

const columns = [
  { field: 'date', label: 'Date' },
  { field: 'agent', label: 'Agent' },
  { field: 'project', label: 'Project' },
  { field: 'model', label: 'Model' },
  { field: 'title', label: 'Title' },
  { field: 'inputTokens', label: 'Tokens' },
];

const tokenFormatter = new Intl.NumberFormat('en-US');

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().slice(0, 10);
}

function formatTokens(n: number): string {
  return tokenFormatter.format(n);
}

function sanitizeSnippet(html: string): string {
  // Only allow <mark> tags for search highlighting
  return html.replace(/<(?!\/?mark\b)[^>]*>/g, '');
}

function navigateToDetail(id: string): void {
  router.push({ name: 'conversation-detail', params: { id } });
}

// Collect unique projects from current result set for the filter dropdown
const uniqueProjects = computed(() => {
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
