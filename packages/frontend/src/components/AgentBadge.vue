<template>
  <span
    class="badge badge-sm"
    :class="badgeClass"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AGENT_LABELS } from '../utils/agent-constants';

const props = defineProps<{
  agent: string;
}>();

const label = computed(() => AGENT_LABELS[props.agent] ?? props.agent);

const badgeClass = computed(() => {
  if (props.agent === 'claude-code') return 'badge-primary';
  if (props.agent === 'cursor') return 'badge-secondary';
  return 'badge-ghost';
});
</script>
