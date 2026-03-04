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

    <template v-else>
      <!-- KPI Cards Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Tokens"
          :value="overview ? formatNumber(overview.totalTokens) : '--'"
          description="Awaiting data"
          :icon="Coins"
          :trend="overview?.trends.tokensTrend"
          :trend-label="trendLabel"
        />
        <KpiCard
          title="Estimated Cost"
          :value="overview ? formatCurrency(overview.estimatedCost) : '$--'"
          description="Awaiting data"
          :icon="DollarSign"
          :trend="overview?.trends.costTrend"
          :trend-label="trendLabel"
        />
        <KpiCard
          title="Conversations"
          :value="overview ? overview.conversationCount.toString() : '--'"
          description="Awaiting data"
          :icon="MessageSquare"
          :trend="overview?.trends.conversationsTrend"
          :trend-label="trendLabel"
        />
        <KpiCard
          title="Active Days"
          :value="overview ? overview.activeDays.toString() : '--'"
          description="Awaiting data"
          :icon="CalendarDays"
          :trend="overview?.trends.activeDaysTrend"
          :trend-label="trendLabel"
        />
      </div>

      <!-- Charts Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TokenChart :data="timeseries" />
        <CostChart :data="timeseries" />
        <ConversationsChart :data="timeseries" />
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
import ConversationTable from '../components/ConversationTable.vue';
import { useDateRange } from '../composables/useDateRange';
import { useAnalytics } from '../composables/useAnalytics';

const { preset, isCustom } = useDateRange();
const { overview, timeseries, loading, error } = useAnalytics();

const numberFormatter = new Intl.NumberFormat('en-US');
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatNumber(n: number): string {
  return numberFormatter.format(n);
}

function formatCurrency(n: number): string {
  return currencyFormatter.format(n);
}

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
