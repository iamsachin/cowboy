<template>
  <div class="p-4 space-y-4">
    <!-- Page Header -->
    <h1 class="text-2xl font-bold">Overview</h1>

    <!-- KPI Cards Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        title="Total Tokens"
        value="--"
        description="Awaiting data"
        :icon="Coins"
      />
      <KpiCard
        title="Estimated Cost"
        value="$--"
        description="Awaiting data"
        :icon="DollarSign"
      />
      <KpiCard
        title="Conversations"
        value="--"
        description="Awaiting data"
        :icon="MessageSquare"
      />
      <KpiCard
        title="Active Days"
        value="--"
        description="Awaiting data"
        :icon="CalendarDays"
      />
    </div>

    <!-- Chart Placeholders Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartPlaceholder title="Token Usage Over Time" />
      <ChartPlaceholder title="Cost Trend" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Coins, DollarSign, MessageSquare, CalendarDays } from 'lucide-vue-next';
import KpiCard from '../components/KpiCard.vue';
import ChartPlaceholder from '../components/ChartPlaceholder.vue';
</script>
