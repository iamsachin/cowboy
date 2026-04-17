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
      class="badge badge-sm gap-1 cursor-pointer border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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
  // Soft palette: low-opacity bg tint + matching border + saturated text.
  // Avoids DaisyUI's solid badge fills which are too loud on dark backgrounds.
  switch (entry.ghostState) {
    case 'summary':
      if (entry.summaryStatus === 'success') {
        return {
          class: 'bg-success/10 border-success/30 text-success hover:bg-success/20',
          icon: CheckCircle2,
        };
      }
      // error + interrupted merge into the same red bucket
      return {
        class: 'bg-error/10 border-error/30 text-error hover:bg-error/20',
        icon: XCircle,
      };
    case 'running':
      return {
        class: 'bg-info/10 border-info/30 text-info hover:bg-info/20',
        icon: Loader2,
        spin: true,
      };
    case 'unmatched':
      return {
        class: 'bg-base-content/5 border-base-content/20 text-base-content/70 hover:bg-base-content/10',
        icon: HelpCircle,
      };
    case 'missing':
      return {
        class: 'bg-warning/10 border-warning/30 text-warning hover:bg-warning/20',
        icon: AlertTriangle,
      };
  }
}

function chipAriaLabel(entry: SubagentListEntry): string {
  const statusPart = entry.summaryStatus ? ` ${entry.summaryStatus}` : '';
  return `Jump to sub-agent: ${entry.description} (${entry.ghostState}${statusPart})`;
}
</script>
