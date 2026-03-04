<template>
  <div class="flex items-center gap-2 text-xs py-1 px-2 rounded bg-base-300/50">
    <Wrench class="w-3.5 h-3.5 text-info shrink-0" />
    <span class="truncate">{{ toolCall.name }}</span>
    <span
      v-if="toolCall.status === 'completed'"
      class="badge badge-xs badge-success"
    >
      {{ toolCall.status }}
    </span>
    <span
      v-else-if="toolCall.status"
      class="badge badge-xs badge-warning"
    >
      {{ toolCall.status }}
    </span>
    <span v-else class="badge badge-xs badge-ghost">unknown</span>
    <span
      v-if="toolCall.duration != null"
      class="text-base-content/50 ml-auto"
    >
      {{ toolCall.duration }}ms
    </span>
  </div>
</template>

<script setup lang="ts">
import { Wrench } from 'lucide-vue-next';
import type { ToolCallRow } from '@cowboy/shared';

defineProps<{
  toolCall: ToolCallRow;
}>();
</script>
