<template>
  <!-- Ghost state: no subagent data -->
  <div
    v-if="!toolCall.subagentSummary"
    class="border border-dashed border-base-300 rounded-lg p-3 opacity-50"
  >
    <div class="flex items-center gap-2 text-xs text-base-content/50">
      <Bot class="w-4 h-4 shrink-0" />
      <span>Subagent data not found</span>
    </div>
  </div>

  <!-- Summary card with data -->
  <div
    v-else
    class="border rounded-lg overflow-hidden"
    :class="cardClasses"
  >
    <!-- Collapsed: always visible summary -->
    <div class="cursor-pointer select-none p-3 space-y-1" @click="expanded = !expanded">
      <!-- Row 1: Icon, title, status badge, duration -->
      <div class="flex items-center gap-2 text-xs">
        <ChevronRight
          class="w-3.5 h-3.5 shrink-0 transition-transform"
          :class="{ 'rotate-90': expanded }"
        />
        <Bot class="w-4 h-4 shrink-0 text-info" />
        <span class="font-medium truncate flex-1">{{ cardTitle }}</span>
        <span class="badge badge-xs" :class="statusBadgeClass">{{ summary.status }}</span>
        <component
          :is="statusIcon"
          class="w-3.5 h-3.5 shrink-0"
          :class="isError ? 'text-error' : 'text-success'"
        />
        <span class="text-base-content/50 whitespace-nowrap">{{ formattedDuration }}</span>
      </div>

      <!-- Row 2: Tool breakdown -->
      <div v-if="toolBreakdownText" class="text-xs text-base-content/50 pl-6">
        {{ toolBreakdownText }}
      </div>

      <!-- Row 3: Files touched -->
      <div v-if="summary.filesTouched.length > 0" class="text-xs text-base-content/40 pl-6 truncate">
        {{ filesTouchedText }}
      </div>

      <!-- Row 4: Tokens -->
      <div class="text-xs text-base-content/50 pl-6">
        in: {{ formatTokenCount(summary.inputTokens) }}, out: {{ formatTokenCount(summary.outputTokens) }}
      </div>

      <!-- Row 5: Error (conditional) -->
      <div
        v-if="summary.lastError"
        class="text-xs text-error pl-6 truncate"
        :title="summary.lastError"
      >
        {{ summary.lastError }}
      </div>

      <!-- Row 6: Confidence hint (conditional) -->
      <div v-if="confidenceHint" class="text-xs text-base-content/30 pl-6 italic">
        {{ confidenceHint }}
      </div>
    </div>

    <!-- Expanded: tool call list -->
    <div v-if="expanded" class="border-t border-base-300 px-3 pb-3 pt-2">
      <!-- Loading state -->
      <div v-if="loadingDetail" class="flex justify-center py-4">
        <span class="loading loading-spinner loading-sm"></span>
      </div>

      <!-- Tool call list -->
      <div v-else-if="subagentToolCalls.length > 0" class="space-y-1">
        <div
          v-for="(tc, idx) in subagentToolCalls"
          :key="tc.id"
          class="flex items-center gap-2 text-xs py-0.5 px-1 rounded"
          :class="{ 'bg-error/10': isLastErroredCall(tc, idx) }"
        >
          <component
            :is="getToolIcon(tc.name).icon"
            class="w-3 h-3 shrink-0"
            :class="getToolIcon(tc.name).colorClass"
          />
          <span class="font-mono">{{ tc.name }}</span>
          <span class="text-base-content/40 truncate flex-1">{{ extractTarget(tc) }}</span>
          <CheckCircle2
            v-if="tc.status === 'completed'"
            class="w-3 h-3 shrink-0 text-success"
          />
          <XCircle
            v-else-if="tc.status === 'error'"
            class="w-3 h-3 shrink-0 text-error"
          />
          <span
            v-else-if="tc.status"
            class="badge badge-xs badge-ghost"
          >{{ tc.status }}</span>
        </div>
      </div>

      <!-- Fallback: show tool breakdown as list -->
      <div v-else class="space-y-1">
        <div
          v-for="[name, count] in toolBreakdownEntries"
          :key="name"
          class="flex items-center gap-2 text-xs py-0.5"
        >
          <component
            :is="getToolIcon(name).icon"
            class="w-3 h-3 shrink-0"
            :class="getToolIcon(name).colorClass"
          />
          <span class="font-mono">{{ name }}</span>
          <span class="text-base-content/40">x{{ count }}</span>
        </div>
      </div>

      <!-- Open full conversation link -->
      <router-link
        v-if="toolCall.subagentConversationId"
        :to="'/conversations/' + toolCall.subagentConversationId"
        class="flex items-center gap-1 text-xs text-info hover:underline mt-3 pt-2 border-t border-base-300"
      >
        Open full conversation
        <ExternalLink class="w-3 h-3" />
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  Bot, ChevronRight, CheckCircle2, XCircle, AlertCircle, ExternalLink,
} from 'lucide-vue-next';
import type { ToolCallRow, SubagentSummary, ConversationDetailResponse } from '@cowboy/shared';
import { formatTokenCount } from '../utils/format-tokens';
import { getToolIcon } from '../utils/tool-icons';

const props = defineProps<{
  toolCall: ToolCallRow;
}>();

const expanded = ref(false);
const loadingDetail = ref(false);
const subagentToolCalls = ref<ToolCallRow[]>([]);
let fetched = false;

const summary = computed(() => props.toolCall.subagentSummary as SubagentSummary);

const isError = computed(() =>
  summary.value.status === 'error' || summary.value.status === 'interrupted'
);

const statusIcon = computed(() => isError.value ? AlertCircle : CheckCircle2);

const statusBadgeClass = computed(() =>
  isError.value ? 'badge-error' : 'badge-success'
);

const cardClasses = computed(() =>
  isError.value
    ? 'border-l-4 border-l-error bg-error/5'
    : 'border-l-4 border-l-info bg-info/5'
);

const cardTitle = computed(() => {
  const input = props.toolCall.input as Record<string, unknown> | null;
  if (input?.description && typeof input.description === 'string') {
    return input.description;
  }
  if (input?.prompt && typeof input.prompt === 'string') {
    return input.prompt.slice(0, 80) + (input.prompt.length > 80 ? '...' : '');
  }
  return 'Subagent task';
});

const formattedDuration = computed(() => {
  const ms = summary.value.durationMs;
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}m ${sec}s`;
  return `${totalSec}s`;
});

const toolBreakdownEntries = computed(() =>
  Object.entries(summary.value.toolBreakdown).sort((a, b) => b[1] - a[1])
);

const toolBreakdownText = computed(() => {
  if (toolBreakdownEntries.value.length === 0) return null;
  return toolBreakdownEntries.value
    .map(([name, count]) => `${name} x${count}`)
    .join(', ');
});

const filesTouchedText = computed(() => {
  const files = summary.value.filesTouched;
  if (files.length <= 5) return files.join(', ');
  return files.slice(0, 5).join(', ') + ` +${files.length - 5} more`;
});

const confidenceHint = computed(() => {
  const c = summary.value.matchConfidence;
  if (c === 'medium') return 'matched by description';
  if (c === 'low') return 'matched by position -- may be inaccurate';
  return null;
});

// Lazy-load subagent tool calls on first expand
watch(expanded, async (isExpanded) => {
  if (!isExpanded || fetched || !props.toolCall.subagentConversationId) return;
  fetched = true;
  loadingDetail.value = true;
  try {
    const res = await fetch(
      `/api/analytics/conversations/${props.toolCall.subagentConversationId}`
    );
    if (res.ok) {
      const detail: ConversationDetailResponse = await res.json();
      subagentToolCalls.value = detail.toolCalls;
    }
  } catch {
    // Silently fail — fall back to breakdown view
  } finally {
    loadingDetail.value = false;
  }
});

function extractTarget(tc: ToolCallRow): string {
  const input = tc.input as Record<string, unknown> | null;
  if (!input) return '';
  // Common patterns: file_path, path, command
  if (typeof input.file_path === 'string') return input.file_path;
  if (typeof input.path === 'string') return input.path;
  if (typeof input.command === 'string') {
    return input.command.length > 60
      ? input.command.slice(0, 60) + '...'
      : input.command;
  }
  if (typeof input.pattern === 'string') return input.pattern;
  return '';
}

function isLastErroredCall(tc: ToolCallRow, idx: number): boolean {
  if (!isError.value || tc.status !== 'error') return false;
  // Check if this is the last errored call in the list
  for (let i = idx + 1; i < subagentToolCalls.value.length; i++) {
    if (subagentToolCalls.value[i].status === 'error') return false;
  }
  return true;
}
</script>
