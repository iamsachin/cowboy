<template>
  <div class="p-4 space-y-6">
    <!-- Page header with title + filters -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <h1 class="text-2xl font-bold">Plans</h1>
      <div class="flex items-center gap-3 flex-wrap">
        <select class="select select-sm select-bordered" v-model="selectedAgent">
          <option value="">All Agents</option>
          <option value="claude-code">Claude Code</option>
          <option value="cursor">Cursor</option>
        </select>
        <select class="select select-sm select-bordered" v-model="selectedProject">
          <option value="">All Projects</option>
          <option v-for="proj in projectOptions" :key="proj" :value="proj">{{ proj }}</option>
        </select>
        <select class="select select-sm select-bordered" v-model="completionFilter">
          <option value="">All Status</option>
          <option value="complete">Complete</option>
          <option value="partial">Partial</option>
          <option value="not-started">Not Started</option>
          <option value="unknown">Unknown</option>
        </select>
        <DateRangeFilter />
      </div>
    </div>

    <!-- KPI cards -->
    <div v-if="stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Total Plans"
        :value="String(stats.totalPlans)"
        description=""
        :icon="ClipboardList"
      />
      <KpiCard
        title="Total Steps"
        :value="String(stats.totalSteps)"
        description=""
        :icon="ListChecks"
      />
      <KpiCard
        title="Completion Rate"
        :value="`${stats.completionRate.toFixed(1)}%`"
        description=""
        :icon="CheckCircle2"
      />
      <KpiCard
        title="Avg Steps/Plan"
        :value="stats.avgStepsPerPlan.toFixed(1)"
        description=""
        :icon="BarChart3"
      />
    </div>

    <!-- Charts -->
    <PlanStatsCharts :timeseries="timeseries" :loading="loading" />

    <!-- Plan table -->
    <div class="bg-base-200 rounded-lg p-4">
      <h2 class="text-lg font-semibold mb-3">Plan List</h2>

      <div class="overflow-x-auto">
        <table class="table table-zebra table-pin-rows table-sm">
          <thead>
            <tr>
              <th
                v-for="col in columns"
                :key="col.field"
                class="cursor-pointer select-none hover:bg-base-300"
                @click="handleSort(col.field)"
              >
                <div class="flex items-center gap-1">
                  <span>{{ col.label }}</span>
                  <span v-if="sort === col.field" class="text-xs opacity-70">
                    {{ order === 'asc' ? '\u25B2' : '\u25BC' }}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading state -->
            <tr v-if="loading && !plans">
              <td :colspan="columns.length" class="text-center py-8">
                <span class="loading loading-spinner loading-md"></span>
              </td>
            </tr>

            <!-- Empty state -->
            <tr v-else-if="!plans || plans.rows.length === 0">
              <td :colspan="columns.length" class="text-center py-8 text-base-content/50">
                No plans found
              </td>
            </tr>

            <!-- Data rows -->
            <tr
              v-else
              v-for="row in plans.rows"
              :key="row.id"
              class="cursor-pointer hover"
              @click="router.push({ name: 'plan-detail', params: { id: row.id } })"
            >
              <td class="max-w-[16rem] truncate">{{ row.title }}</td>
              <td class="font-mono text-center">{{ row.completedSteps }}/{{ row.totalSteps }}</td>
              <td>
                <span class="badge badge-sm" :class="statusBadgeClass(row.status)">
                  {{ row.status }}
                </span>
              </td>
              <td><AgentBadge :agent="row.agent" /></td>
              <td>{{ row.project ?? '--' }}</td>
              <td class="whitespace-nowrap">{{ formatDate(row.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination footer -->
      <div
        v-if="plans && plans.total > 0"
        class="flex items-center justify-between mt-3 text-sm flex-wrap gap-2"
      >
        <span class="text-base-content/60">
          Showing {{ rangeStart }}-{{ rangeEnd }} of {{ plans.total }} plans
        </span>
        <div class="join">
          <button
            class="join-item btn btn-sm"
            :disabled="page <= 1"
            @click="page = page - 1"
          >
            &laquo;
          </button>
          <button
            v-for="p in visiblePages"
            :key="p"
            class="join-item btn btn-sm"
            :class="{ 'btn-active': p === page }"
            @click="page = p"
          >
            {{ p }}
          </button>
          <button
            class="join-item btn btn-sm"
            :disabled="page >= totalPages"
            @click="page = page + 1"
          >
            &raquo;
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ClipboardList, ListChecks, CheckCircle2, BarChart3 } from 'lucide-vue-next';
import DateRangeFilter from '../components/DateRangeFilter.vue';
import KpiCard from '../components/KpiCard.vue';
import PlanStatsCharts from '../components/PlanStatsCharts.vue';
import AgentBadge from '../components/AgentBadge.vue';
import { usePlans } from '../composables/usePlans';

const router = useRouter();

const {
  plans,
  stats,
  timeseries,
  loading,
  selectedAgent,
  completionFilter,
  selectedProject,
  page,
  sort,
  order,
  setSort,
} = usePlans();

const columns = [
  { field: 'title', label: 'Title' },
  { field: 'steps', label: 'Steps' },
  { field: 'status', label: 'Status' },
  { field: 'agent', label: 'Agent' },
  { field: 'project', label: 'Project' },
  { field: 'date', label: 'Date' },
];

function handleSort(field: string) {
  setSort(field);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'complete':
      return 'badge-success';
    case 'partial':
      return 'badge-warning';
    case 'not-started':
    case 'unknown':
    default:
      return 'badge-ghost';
  }
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toISOString().slice(0, 10);
  } catch {
    return isoString;
  }
}

// Derive project options from current result set
const projectOptions = computed(() => {
  if (!plans.value) return [];
  const projects = new Set<string>();
  for (const row of plans.value.rows) {
    if (row.project) projects.add(row.project);
  }
  return Array.from(projects).sort();
});

const totalPages = computed(() => {
  if (!plans.value) return 1;
  return Math.max(1, Math.ceil(plans.value.total / plans.value.limit));
});

const rangeStart = computed(() => {
  if (!plans.value) return 0;
  return (plans.value.page - 1) * plans.value.limit + 1;
});

const rangeEnd = computed(() => {
  if (!plans.value) return 0;
  return Math.min(plans.value.page * plans.value.limit, plans.value.total);
});

const visiblePages = computed(() => {
  const total = totalPages.value;
  const current = page.value;
  const maxVisible = 5;

  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  let start = Math.max(1, current - Math.floor(maxVisible / 2));
  let end = start + maxVisible - 1;

  if (end > total) {
    end = total;
    start = Math.max(1, end - maxVisible + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
});
</script>
