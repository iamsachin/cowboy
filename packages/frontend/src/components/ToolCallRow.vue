<template>
  <!-- Subagent card for Task/Agent tool calls -->
  <SubagentSummaryCard v-if="isSubagentCall" :toolCall="toolCall" :isActive="isActive" />

  <!-- Standard tool call display -->
  <div v-else class="text-xs">
    <!-- Compact row: always visible -->
    <div
      class="flex items-center gap-2 py-1.5 px-2 rounded border-l-2"
      :class="isSuccess ? 'bg-success/5 border-success' : isError ? 'bg-error/5 border-error' : 'bg-amber-500/5 border-amber-400'"
    >
      <component :is="toolIcon.icon" class="w-3.5 h-3.5 shrink-0" :class="toolIcon.colorClass" />
      <span class="truncate">{{ displayName }}</span>
      <CircleCheck
        v-if="isSuccess"
        class="w-3.5 h-3.5 text-success shrink-0"
      />
      <span
        v-else-if="isError"
        class="badge badge-xs badge-error"
      >
        error
      </span>
      <span
        v-else-if="toolCall.status"
        class="badge badge-xs badge-warning"
      >
        {{ toolCall.status }}
      </span>
      <span v-else class="badge badge-xs badge-ghost">pending</span>
      <span v-if="toolCall.duration != null || tokenInfo" class="ml-auto flex items-center gap-2">
        <span v-if="toolCall.duration != null" class="text-base-content/50">
          {{ toolCall.duration }}ms
        </span>
        <span v-if="tokenInfo" class="text-base-content/60">
          {{ tokenInfo }}
        </span>
      </span>
    </div>

    <!-- Expandable I/O details -->
    <details :open="autoExpand" class="ml-6 mt-1" @click.stop>
      <summary class="text-xs text-info cursor-pointer">Show details</summary>
      <div class="mt-2">
        <DiffViewer v-if="toolCall.name === 'Edit'" :input="toolCall.input" :output="toolCall.output" />
        <CodeViewer v-else-if="toolCall.name === 'Read' || toolCall.name === 'Write'" :input="toolCall.input" :output="toolCall.output" :toolName="toolCall.name" />
        <BashViewer v-else-if="toolCall.name === 'Bash'" :input="toolCall.input" :output="toolCall.output" />
        <JsonFallbackViewer v-else :input="displayInput" :output="toolCall.output" />
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CircleCheck } from 'lucide-vue-next';
import type { ToolCallRow } from '../types';
import { getToolIcon } from '../utils/tool-icons';
import DiffViewer from './tool-viewers/DiffViewer.vue';
import CodeViewer from './tool-viewers/CodeViewer.vue';
import BashViewer from './tool-viewers/BashViewer.vue';
import JsonFallbackViewer from './tool-viewers/JsonFallbackViewer.vue';
import SubagentSummaryCard from './SubagentSummaryCard.vue';

const props = defineProps<{
  toolCall: ToolCallRow;
  autoExpand?: boolean;
  tokenInfo?: string;
  isActive: boolean;
}>();

const toolIcon = computed(() => getToolIcon(props.toolCall.name));
const isSuccess = computed(() =>
  props.toolCall.status === 'completed' ||
  props.toolCall.status === 'success' ||
  !props.toolCall.status
);
const isError = computed(() => props.toolCall.status === 'error');
const isSubagentCall = computed(() =>
  props.toolCall.name === 'Task' || props.toolCall.name === 'Agent'
);

const displayName = computed(() => {
  if (props.toolCall.name === 'Skill' && props.toolCall.input && typeof props.toolCall.input === 'object') {
    const inp = props.toolCall.input as Record<string, unknown>;
    if (inp.skill) return `Skill: ${inp.skill}`;
  }
  return props.toolCall.name;
});

const displayInput = computed(() => {
  if (props.toolCall.name === 'Skill' && props.toolCall.input && typeof props.toolCall.input === 'object') {
    const inp = props.toolCall.input as Record<string, unknown>;
    if (inp.args) return inp.args;
  }
  return props.toolCall.input;
});
</script>
