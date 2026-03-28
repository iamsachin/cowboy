<template>
  <div class="p-4 space-y-4">
    <!-- Header row: title left, date filter right -->
    <div class="flex items-center justify-between flex-wrap gap-2">
      <h1 class="text-2xl font-bold">Overview</h1>
      <DateRangeFilter />
    </div>

    <!-- Error alert -->
    <div v-if="error" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <!-- Loading state -->
    <div v-if="loading && !overview" class="flex justify-center items-center py-16">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Empty state: no data at all -->
    <div v-else-if="hasNoDataAtAll" class="flex justify-center items-center py-24">
      <div class="card bg-base-200 shadow-lg max-w-md">
        <div class="card-body items-center text-center">
          <MessageSquare class="w-12 h-12 opacity-30 mb-2" />
          <h2 class="card-title">No conversations yet</h2>
          <p class="opacity-60">Start a coding session with Claude Code to see your analytics here.</p>
        </div>
      </div>
    </div>

    <!-- Empty state: no data in selected range -->
    <div v-else-if="hasNoDataInRange" class="flex justify-center items-center py-24">
      <div class="card bg-base-200 shadow-lg max-w-md">
        <div class="card-body items-center text-center">
          <CalendarDays class="w-12 h-12 opacity-30 mb-2" />
          <h2 class="card-title">No data in this range</h2>
          <p class="opacity-60">Try selecting a different date range or "All time".</p>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- KPI Cards Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Tokens"
          :value="overview ? formatNumber(overview.totalTokens) : '--'"
          :description="dateRangeLabel"
          :icon="Coins"
          :trend="overview?.trends.tokensTrend"
          :trend-label="trendLabel"
        />
        <KpiCard
          title="Estimated Cost"
          :value="overview ? formatCurrency(overview.estimatedCost) : '$--'"
          :description="dateRangeLabel"
          :icon="DollarSign"
          :trend="overview?.trends.costTrend"
          :trend-label="trendLabel"
        />
        <KpiCard
          title="Conversations"
          :value="overview ? overview.conversationCount.toString() : '--'"
          :description="dateRangeLabel"
          :icon="MessageSquare"
          :trend="overview?.trends.conversationsTrend"
          :trend-label="trendLabel"
        />
        <KpiCard
          title="Active Days"
          :value="overview ? overview.activeDays.toString() : '--'"
          :description="dateRangeLabel"
          :icon="CalendarDays"
          :trend="overview?.trends.activeDaysTrend"
          :trend-label="trendLabel"
        />
      </div>

      <!-- Charts Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TokenChart :data="timeseries" :loading="loading" />
        <CostChart :data="timeseries" :loading="loading" />
        <ConversationsChart :data="timeseries" :loading="loading" />
        <ModelDistributionChart :data="modelDistribution" />
      </div>

      <!-- Conversation Table -->
      <ConversationTable />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Coins, DollarSign, MessageSquare, CalendarDays } from 'lucide-vue-next';
import KpiCard from '../components/KpiCard.vue';
import DateRangeFilter from '../components/DateRangeFilter.vue';
import TokenChart from '../components/TokenChart.vue';
import CostChart from '../components/CostChart.vue';
import ConversationsChart from '../components/ConversationsChart.vue';
import ModelDistributionChart from '../components/ModelDistributionChart.vue';
import ConversationTable from '../components/ConversationTable.vue';
import { useDateRange } from '../composables/useDateRange';
import { useAnalytics } from '../composables/useAnalytics';

const { preset, isCustom, customFrom, customTo } = useDateRange();
const { overview, timeseries, modelDistribution, loading, error } = useAnalytics();

const numberFormatter = new Intl.NumberFormat('en-US');
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

function formatNumber(n: number): string {
  return numberFormatter.format(n);
}

function formatCurrency(n: number): string {
  return currencyFormatter.format(n);
}

const dateRangeLabel = computed(() => {
  if (isCustom.value && customFrom.value && customTo.value) {
    const from = new Date(customFrom.value + 'T00:00:00');
    const to = new Date(customTo.value + 'T00:00:00');
    return `${dateFormatter.format(from)} \u2013 ${dateFormatter.format(to)}`;
  }
  switch (preset.value) {
    case 'today':
      return 'Today';
    case '7d':
      return 'Last 7 days';
    case '30d':
      return 'Last 30 days';
    case 'all':
      return 'All time';
    default:
      return '';
  }
});

const hasNoDataAtAll = computed(() => {
  return overview.value !== null
    && overview.value.conversationCount === 0
    && preset.value === 'all';
});

const hasNoDataInRange = computed(() => {
  return overview.value !== null
    && overview.value.conversationCount === 0
    && preset.value !== 'all';
});

const trendLabel = computed(() => {
  if (isCustom.value) return 'vs prior period';
  switch (preset.value) {
    case 'today':
      return 'vs yesterday';
    case '7d':
      return 'vs prior 7d';
    case '30d':
      return 'vs prior 30d';
    case 'all':
      return '';
    default:
      return '';
  }
});
</script>
