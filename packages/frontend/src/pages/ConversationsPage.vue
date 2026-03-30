<template>
  <div class="px-4 pt-2 pb-4 space-y-4">
    <!-- Header row: title left, date filter right -->
    <div class="flex items-center justify-between flex-wrap gap-2">
      <h1 class="text-2xl font-bold">Conversations</h1>
      <DateRangeFilter />
    </div>

    <!-- Conversation browser with filters and table -->
    <ConversationBrowser />
  </div>
</template>

<script setup lang="ts">
import DateRangeFilter from '../components/DateRangeFilter.vue';
import ConversationBrowser from '../components/ConversationBrowser.vue';
</script>
