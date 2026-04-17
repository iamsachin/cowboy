<template>
  <!--
    IMPR-8: Parallel sub-agent visual grouping.
    Renders N parallel Task/Agent tool_calls (siblings sharing a messageId) inside a single
    bordered wrapper with a shared header and a flex-wrap card grid. Each inner card retains
    its own [data-tool-call-id] attribute so IMPR-2 chip jumps and handleTimelineNavigate
    continue to scroll to specific cards.
  -->
  <div class="border border-base-300 rounded-lg bg-base-100/30 p-2 space-y-2">
    <!-- Shared header -->
    <div class="flex items-center gap-2 text-xs px-1 flex-wrap">
      <Workflow class="w-4 h-4 shrink-0 text-info" />
      <span class="font-medium">
        {{ toolCalls.length }} sub-agents running in parallel
      </span>
      <span
        v-if="aggregate.success > 0"
        class="text-success whitespace-nowrap"
      >· {{ aggregate.success }} &#x2713;</span>
      <span
        v-if="aggregate.error > 0"
        class="text-error whitespace-nowrap"
      >· {{ aggregate.error }} &#x2717;</span>
      <span
        v-if="aggregate.running > 0"
        class="text-info whitespace-nowrap animate-pulse"
      >· {{ aggregate.running }} &#x27F3;</span>
      <span
        v-if="aggregate.unmatched > 0"
        class="text-base-content/60 whitespace-nowrap"
      >· {{ aggregate.unmatched }} ?</span>
      <span
        v-if="aggregate.missing > 0"
        class="text-warning whitespace-nowrap"
      >· {{ aggregate.missing }} &#x26A0;</span>
    </div>

    <!-- Card grid: flex-wrap via grid, 1 col on narrow, 2 cols on md+ -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
      <div
        v-for="tc in toolCalls"
        :key="tc.id"
        :data-tool-call-id="tc.id"
        style="scroll-margin-top: 3rem"
      >
        <SubagentSummaryCard
          :toolCall="tc"
          :isActive="isActive"
          :parentModel="parentModel"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Workflow } from 'lucide-vue-next';
import type { ToolCallRow } from '../types';
import { classifyGhostState } from '../utils/ghost-card-state';
import SubagentSummaryCard from './SubagentSummaryCard.vue';

const props = defineProps<{
  /** Guaranteed length >= 2, all Task/Agent, all sharing messageId. */
  toolCalls: ToolCallRow[];
  isActive: boolean;
  parentModel?: string | null;
}>();

/**
 * Aggregate state counters derived using the SAME classifier as useSubagentList
 * (classifyGhostState). Interrupted merges into error — mirrors
 * useSubagentList.ts:122-124.
 *
 * When classifyGhostState returns 'summary', we additionally check
 * subagentSummary.status to split success vs error (otherwise the split would
 * always show 0 for success/error). Non-summary ghost states map 1:1 to their
 * bucket.
 */
const aggregate = computed(() => {
  const counts = {
    total: 0,
    success: 0,
    error: 0,
    running: 0,
    unmatched: 0,
    missing: 0,
  };
  for (const tc of props.toolCalls) {
    counts.total += 1;
    const ghost = classifyGhostState({
      subagentSummary: tc.subagentSummary,
      subagentLinkAttempted: tc.subagentLinkAttempted,
      subagentConversationId: tc.subagentConversationId ?? null,
      isActive: props.isActive,
    });
    switch (ghost) {
      case 'summary':
        // Split success vs error (error + interrupted merged).
        if (tc.subagentSummary && tc.subagentSummary.status === 'success') {
          counts.success += 1;
        } else {
          counts.error += 1;
        }
        break;
      case 'running':
        counts.running += 1;
        break;
      case 'unmatched':
        counts.unmatched += 1;
        break;
      case 'missing':
        counts.missing += 1;
        break;
    }
  }
  return counts;
});
</script>
