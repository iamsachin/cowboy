<template>
  <div class="p-4 space-y-4">
    <!-- Tab bar -->
    <div class="tabs tabs-border tabs-lg mb-4" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        role="tab"
        class="tab"
        :class="{ 'tab-active': activeTab === tab.id }"
        @click="setTab(tab.id)"
      >
        <component :is="tab.icon" class="w-4 h-4 mr-1.5" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Per-agent tab content (Claude Code or Cursor) -->
    <template v-if="activeTab === 'claude-code' || activeTab === 'cursor'">
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
          <h1 class="text-2xl font-bold">{{ agentLabel }}</h1>
          <DateRangeFilter />
        </div>

        <!-- KPI Cards Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            title="Total Tokens"
            :value="agentOverview ? formatNumber(agentOverview.totalTokens) : '--'"
            description="Awaiting data"
            :icon="Coins"
            :trend="agentOverview?.trends.tokensTrend"
            :trend-label="trendLabel"
          />
          <KpiCard
            title="Estimated Cost"
            :value="agentOverview ? formatCurrency(agentOverview.estimatedCost) : '$--'"
            description="Awaiting data"
            :icon="DollarSign"
            :trend="agentOverview?.trends.costTrend"
            :trend-label="trendLabel"
          />
          <KpiCard
            title="Conversations"
            :value="agentOverview ? agentOverview.conversationCount.toString() : '--'"
            description="Awaiting data"
            :icon="MessageSquare"
            :trend="agentOverview?.trends.conversationsTrend"
            :trend-label="trendLabel"
          />
          <KpiCard
            title="Active Days"
            :value="agentOverview ? agentOverview.activeDays.toString() : '--'"
            description="Awaiting data"
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
        <ConversationTable :agent="activeTab" />
      </template>
    </template>

    <!-- Compare tab content -->
    <template v-if="activeTab === 'compare'">
      <!-- Error alert -->
      <div v-if="compareError" class="alert alert-error">
        <span>{{ compareError }}</span>
      </div>

      <!-- Loading state -->
      <div v-if="compareLoading && !claudeCode.overview.value && !cursorData.overview.value" class="flex justify-center items-center py-16">
        <span class="loading loading-spinner loading-lg"></span>
      </div>

      <template v-else>
        <!-- Header row -->
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h1 class="text-2xl font-bold">Agent Comparison</h1>
          <DateRangeFilter />
        </div>

        <!-- Comparison Cards Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <ComparisonCard
            title="Total Tokens"
            :claude-value="claudeCode.overview.value ? formatNumber(claudeCode.overview.value.totalTokens) : '--'"
            :cursor-value="cursorData.overview.value ? formatNumber(cursorData.overview.value.totalTokens) : '--'"
            :claude-trend="claudeCode.overview.value?.trends.tokensTrend"
            :cursor-trend="cursorData.overview.value?.trends.tokensTrend"
            :icon="Coins"
          />
          <ComparisonCard
            title="Estimated Cost"
            :claude-value="claudeCode.overview.value ? formatCurrency(claudeCode.overview.value.estimatedCost) : '$--'"
            :cursor-value="cursorData.overview.value ? formatCurrency(cursorData.overview.value.estimatedCost) : '$--'"
            :claude-trend="claudeCode.overview.value?.trends.costTrend"
            :cursor-trend="cursorData.overview.value?.trends.costTrend"
            :icon="DollarSign"
          />
          <ComparisonCard
            title="Conversations"
            :claude-value="claudeCode.overview.value ? claudeCode.overview.value.conversationCount.toString() : '--'"
            :cursor-value="cursorData.overview.value ? cursorData.overview.value.conversationCount.toString() : '--'"
            :claude-trend="claudeCode.overview.value?.trends.conversationsTrend"
            :cursor-trend="cursorData.overview.value?.trends.conversationsTrend"
            :icon="MessageSquare"
          />
          <ComparisonCard
            title="Active Days"
            :claude-value="claudeCode.overview.value ? claudeCode.overview.value.activeDays.toString() : '--'"
            :cursor-value="cursorData.overview.value ? cursorData.overview.value.activeDays.toString() : '--'"
            :claude-trend="claudeCode.overview.value?.trends.activeDaysTrend"
            :cursor-trend="cursorData.overview.value?.trends.activeDaysTrend"
            :icon="CalendarDays"
          />
        </div>

        <!-- Overlaid Charts Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AgentOverlayChart
            title="Token Usage Comparison"
            metric="tokens"
            :claude-data="claudeCode.timeseries.value"
            :cursor-data="cursorData.timeseries.value"
          />
          <AgentOverlayChart
            title="Cost Comparison"
            metric="cost"
            :claude-data="claudeCode.timeseries.value"
            :cursor-data="cursorData.timeseries.value"
          />
          <AgentOverlayChart
            title="Conversation Comparison"
            metric="conversations"
            :claude-data="claudeCode.timeseries.value"
            :cursor-data="cursorData.timeseries.value"
          />
          <AgentActivityChart
            :claude-data="claudeCode.timeseries.value"
            :cursor-data="cursorData.timeseries.value"
          />
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Coins, DollarSign, MessageSquare, CalendarDays, Terminal, Mouse } from 'lucide-vue-next';
import KpiCard from '../components/KpiCard.vue';
import DateRangeFilter from '../components/DateRangeFilter.vue';
import TokenChart from '../components/TokenChart.vue';
import CostChart from '../components/CostChart.vue';
import ConversationsChart from '../components/ConversationsChart.vue';
import ConversationTable from '../components/ConversationTable.vue';
import ModelDistributionChart from '../components/ModelDistributionChart.vue';
import ComparisonCard from '../components/ComparisonCard.vue';
import AgentOverlayChart from '../components/AgentOverlayChart.vue';
import AgentActivityChart from '../components/AgentActivityChart.vue';
import { useDateRange } from '../composables/useDateRange';
import { useAgentAnalytics } from '../composables/useAgentAnalytics';
import { useAgentComparison } from '../composables/useAgentComparison';
import { AGENT_LABELS } from '../utils/agent-constants';

const route = useRoute();
const router = useRouter();

const { preset, isCustom } = useDateRange();

// Tab state from URL query param, default is 'compare'
const activeTab = computed(() => (route.query.tab as string) || 'compare');

function setTab(tab: string) {
  router.replace({ query: { ...route.query, tab } });
}

const tabs = [
  { id: 'claude-code', label: 'Claude Code', icon: Terminal },
  { id: 'cursor', label: 'Cursor', icon: Mouse },
  { id: 'compare', label: 'Compare', icon: CalendarDays },
];

// Per-agent data (used when a per-agent tab is active)
const agentRef = computed(() => activeTab.value);
const {
  overview: agentOverview,
  timeseries: agentTimeseries,
  modelDistribution: agentModelDistribution,
  loading: agentLoading,
  error: agentError,
} = useAgentAnalytics(agentRef);

// Comparison data (used when compare tab is active)
const {
  claudeCode,
  cursor: cursorData,
  loading: compareLoading,
  error: compareError,
} = useAgentComparison();

// Agent label
const agentLabel = computed(() => AGENT_LABELS[activeTab.value] ?? activeTab.value);

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
