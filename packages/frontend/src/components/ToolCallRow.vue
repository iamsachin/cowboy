<template>
  <!-- Subagent card for Task/Agent tool calls -->
  <SubagentSummaryCard v-if="isSubagentCall" :toolCall="toolCall" />

  <!-- Standard tool call display -->
  <div v-else class="text-xs">
    <!-- Compact row: always visible -->
    <div
      class="flex items-center gap-2 py-1 px-2 rounded border-l-2"
      :class="isSuccess ? 'bg-success/5 border-success' : 'bg-amber-500/5 border-amber-400'"
    >
      <component :is="toolIcon.icon" class="w-3.5 h-3.5 shrink-0" :class="toolIcon.colorClass" />
      <span class="truncate">{{ toolCall.name }}</span>
      <span
        v-if="isSuccess"
        class="badge badge-xs badge-success"
      >
        success
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

    <!-- Expandable I/O details -->
    <details class="ml-6 mt-1" @click.stop>
      <summary class="text-xs text-info cursor-pointer">Show details</summary>
      <div class="mt-2">
        <DiffViewer v-if="toolCall.name === 'Edit'" :input="toolCall.input" :output="toolCall.output" />
        <CodeViewer v-else-if="toolCall.name === 'Read' || toolCall.name === 'Write'" :input="toolCall.input" :output="toolCall.output" :toolName="toolCall.name" />
        <BashViewer v-else-if="toolCall.name === 'Bash'" :input="toolCall.input" :output="toolCall.output" />
        <JsonFallbackViewer v-else :input="toolCall.input" :output="toolCall.output" />
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ToolCallRow } from '@cowboy/shared';
import { getToolIcon } from '../utils/tool-icons';
import DiffViewer from './tool-viewers/DiffViewer.vue';
import CodeViewer from './tool-viewers/CodeViewer.vue';
import BashViewer from './tool-viewers/BashViewer.vue';
import JsonFallbackViewer from './tool-viewers/JsonFallbackViewer.vue';
import SubagentSummaryCard from './SubagentSummaryCard.vue';

const props = defineProps<{
  toolCall: ToolCallRow;
}>();

const toolIcon = computed(() => getToolIcon(props.toolCall.name));
const isSuccess = computed(() =>
  props.toolCall.status === 'completed' || props.toolCall.status === 'success'
);
const isSubagentCall = computed(() =>
  props.toolCall.name === 'Task' || props.toolCall.name === 'Agent'
);
</script>
