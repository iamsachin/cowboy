<template>
  <div
    v-if="subagents.length > 0"
    class="flex items-center gap-2 flex-wrap mb-4"
    data-testid="subagent-overview-strip"
  >
    <!-- Aggregate header: "N sub-agent(s) · 2 ✓ 1 ✗ …" -->
    <span class="text-sm text-base-content/70 flex items-center gap-2">
      <span>{{ aggregate.total }} sub-agent{{ aggregate.total === 1 ? '' : 's' }}</span>
      <template v-if="aggregate.success > 0">
        <span class="text-base-content/30">·</span>
        <span class="flex items-center gap-1 text-success">
          <CheckCircle2 class="w-3 h-3" aria-hidden="true" />
          {{ aggregate.success }}
        </span>
      </template>
      <template v-if="aggregate.error > 0">
        <span class="text-base-content/30">·</span>
        <span class="flex items-center gap-1 text-error">
          <XCircle class="w-3 h-3" aria-hidden="true" />
          {{ aggregate.error }}
        </span>
      </template>
      <template v-if="aggregate.running > 0">
        <span class="text-base-content/30">·</span>
        <span class="flex items-center gap-1 text-info">
          <Loader2 class="w-3 h-3 animate-spin" aria-hidden="true" />
          {{ aggregate.running }}
        </span>
      </template>
      <template v-if="aggregate.unmatched > 0">
        <span class="text-base-content/30">·</span>
        <span class="flex items-center gap-1 text-base-content/70">
          <HelpCircle class="w-3 h-3" aria-hidden="true" />
          {{ aggregate.unmatched }}
        </span>
      </template>
      <template v-if="aggregate.missing > 0">
        <span class="text-base-content/30">·</span>
        <span class="flex items-center gap-1 text-warning">
          <AlertTriangle class="w-3 h-3" aria-hidden="true" />
          {{ aggregate.missing }}
        </span>
      </template>
    </span>

    <!-- Chips -->
    <button
      v-for="entry in subagents"
      :key="entry.toolCallId"
      type="button"
      class="badge badge-sm gap-1 cursor-pointer hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      :class="chipLook(entry).class"
      :title="entry.description"
      :aria-label="chipAriaLabel(entry)"
      @click="$emit('jump-to', entry.toolCallId)"
    >
      <component
        :is="chipLook(entry).icon"
        class="w-3 h-3 shrink-0"
        :class="{ 'animate-spin': chipLook(entry).spin }"
        aria-hidden="true"
      />
      <span class="truncate max-w-[16ch]">{{ entry.description }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-vue-next';
import type {
  SubagentListEntry,
  SubagentListAggregate,
} from '../composables/useSubagentList';

interface Props {
  subagents: SubagentListEntry[];
  aggregate: SubagentListAggregate;
}
defineProps<Props>();

defineEmits<{
  (e: 'jump-to', toolCallId: string): void;
}>();

interface ChipLook {
  class: string;
  icon: Component;
  spin?: boolean;
}

/**
 * Map ghostState (+ summaryStatus) to chip classes + icon.
 * Keep in sync with SubagentSummaryCard.vue's visual palette so the strip and
 * the inline card never disagree.
 */
function chipLook(entry: SubagentListEntry): ChipLook {
  switch (entry.ghostState) {
    case 'summary':
      if (entry.summaryStatus === 'success') {
        return { class: 'badge-success', icon: CheckCircle2 };
      }
      // error + interrupted merge into the same red bucket
      return { class: 'badge-error', icon: XCircle };
    case 'running':
      return { class: 'badge-info', icon: Loader2, spin: true };
    case 'unmatched':
      return { class: 'badge-ghost', icon: HelpCircle };
    case 'missing':
      return { class: 'badge-warning', icon: AlertTriangle };
  }
}

function chipAriaLabel(entry: SubagentListEntry): string {
  const statusPart = entry.summaryStatus ? ` ${entry.summaryStatus}` : '';
  return `Jump to sub-agent: ${entry.description} (${entry.ghostState}${statusPart})`;
}
</script>
