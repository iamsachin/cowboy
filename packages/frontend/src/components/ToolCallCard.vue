<template>
  <div class="collapse collapse-arrow bg-base-200 my-2 rounded-lg">
    <input type="checkbox" />

    <!-- Collapsed title: icon + name + status badge -->
    <div class="collapse-title flex items-center gap-2 text-sm font-medium">
      <Wrench class="w-4 h-4 text-info shrink-0" />
      <span class="truncate">{{ toolCall.name }}</span>
      <span
        v-if="toolCall.status"
        class="badge badge-sm"
        :class="toolCall.status === 'completed' ? 'badge-success' : 'badge-warning'"
      >
        {{ toolCall.status }}
      </span>
      <span v-else class="badge badge-sm badge-ghost">unknown</span>
      <span v-if="toolCall.duration != null" class="text-xs text-base-content/50 ml-auto mr-4">
        {{ toolCall.duration }}ms
      </span>
    </div>

    <!-- Expanded content: input/output JSON -->
    <div class="collapse-content space-y-3">
      <div v-if="toolCall.input != null">
        <div class="text-xs font-semibold text-base-content/60 mb-1">Input:</div>
        <pre class="bg-base-300 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">{{ formatJson(toolCall.input) }}</pre>
      </div>
      <div v-if="toolCall.output != null">
        <div class="text-xs font-semibold text-base-content/60 mb-1">Output:</div>
        <pre class="bg-base-300 p-2 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">{{ formatJson(toolCall.output) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Wrench } from 'lucide-vue-next';
import type { ToolCallRow } from '@cowboy/shared';

defineProps<{
  toolCall: ToolCallRow;
}>();

function formatJson(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
</script>
