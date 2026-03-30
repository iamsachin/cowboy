<template>
  <div class="px-4 pt-2 pb-4 space-y-4">
    <!-- Error alert -->
    <div v-if="agentError" class="alert alert-error">
      <span>{{ agentError }}</span>
    </div>

    <!-- Loading state -->
    <div v-if="agentLoading && !agentOverview" class="flex justify-center items-center py-16">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <!-- Header row -->
      <div class="flex items-center justify-between flex-wrap gap-2">
        <h1 class="text-2xl font-bold">Claude Code</h1>
        <DateRangeFilter />
      </div>

      <!-- KPI Cards Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Tokens"
          :value="agentOverview ? formatNumber(agentOverview.totalTokens) : '--'"
          :description="tokenDescription"
          :icon="Coins"
          :trend="agentOverview?.trends.tokensTrend"
          :trend-label="trendLabel"
        />
        <KpiCard
          title="Estimated Cost"
          :value="agentOverview ? formatCurrency(agentOverview.estimatedCost) : '$--'"
          :description="costDescription"
          :icon="DollarSign"
          :trend="agentOverview?.trends.costTrend"
          :trend-label="trendLabel"
        />
        <KpiCard
          title="Conversations"
          :value="agentOverview ? agentOverview.conversationCount.toString() : '--'"
          :description="conversationsDescription"
          :icon="MessageSquare"
          :trend="agentOverview?.trends.conversationsTrend"
          :trend-label="trendLabel"
        />
        <KpiCard
          title="Active Days"
          :value="agentOverview ? agentOverview.activeDays.toString() : '--'"
          :description="activeDaysDescription"
          :icon="CalendarDays"
          :trend="agentOverview?.trends.activeDaysTrend"
          :trend-label="trendLabel"
        />
      </div>

      <!-- Charts Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TokenChart :data="agentTimeseries" :loading="agentLoading" />
        <CostChart :data="agentTimeseries" :loading="agentLoading" />
        <ConversationsChart :data="agentTimeseries" :loading="agentLoading" />
        <ModelDistributionChart :data="agentModelDistribution" />
      </div>

      <!-- Conversation Table -->
      <ConversationTable agent="claude-code" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Coins, DollarSign, MessageSquare, CalendarDays } from 'lucide-vue-next';
import KpiCard from '../components/KpiCard.vue';
import DateRangeFilter from '../components/DateRangeFilter.vue';
import TokenChart from '../components/TokenChart.vue';
import CostChart from '../components/CostChart.vue';
import ConversationsChart from '../components/ConversationsChart.vue';
import ConversationTable from '../components/ConversationTable.vue';
import ModelDistributionChart from '../components/ModelDistributionChart.vue';
import { useDateRange } from '../composables/useDateRange';
import { useAgentAnalytics } from '../composables/useAgentAnalytics';

const { preset, isCustom } = useDateRange();

// Always use claude-code agent
const agentRef = ref('claude-code');
const {
  overview: agentOverview,
  timeseries: agentTimeseries,
  modelDistribution: agentModelDistribution,
  loading: agentLoading,
  error: agentError,
} = useAgentAnalytics(agentRef);

// Formatters
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

// Preset label for KPI descriptions
const presetLabel = computed(() => {
  if (isCustom.value) return 'custom range';
  switch (preset.value) {
    case 'today': return 'today';
    case '7d': return 'last 7 days';
    case '30d': return 'last 30 days';
    case 'all': return 'all time';
    default: return '';
  }
});

// Contextual KPI descriptions
const tokenDescription = computed(() => {
  if (!agentOverview.value) return '';
  const count = agentOverview.value.conversationCount;
  return count > 0 ? `Across ${count} conversations` : 'No conversations yet';
});

const costDescription = computed(() => {
  if (!agentOverview.value) return '';
  return `In ${presetLabel.value}`;
});

const conversationsDescription = computed(() => {
  if (!agentOverview.value) return '';
  const days = agentOverview.value.activeDays;
  return days > 0 ? `Across ${days} active days` : 'No activity yet';
});

const activeDaysDescription = computed(() => {
  if (!agentOverview.value) return '';
  return `In ${presetLabel.value}`;
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
