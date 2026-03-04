<template>
  <ol class="space-y-1" :class="compact ? 'text-xs' : 'text-sm'">
    <li
      v-for="step in steps"
      :key="step.id"
      class="flex items-start gap-2 rounded px-2"
      :class="compact ? 'py-0.5' : 'py-1.5 bg-base-200'"
    >
      <span class="shrink-0 mt-0.5">
        <CheckCircle2 v-if="step.status === 'complete'" class="text-success" :class="iconSize" />
        <XCircle v-else-if="step.status === 'incomplete'" class="text-error" :class="iconSize" />
        <Circle v-else class="text-base-content/40" :class="iconSize" />
      </span>
      <span class="text-base-content/60 shrink-0">{{ step.stepNumber }}.</span>
      <span>{{ step.content }}</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle2, XCircle, Circle } from 'lucide-vue-next';
import type { PlanStepRow } from '@cowboy/shared';

const props = withDefaults(
  defineProps<{
    steps: PlanStepRow[];
    compact?: boolean;
  }>(),
  { compact: false },
);

const iconSize = computed(() => (props.compact ? 'w-3.5 h-3.5' : 'w-4 h-4'));
</script>
