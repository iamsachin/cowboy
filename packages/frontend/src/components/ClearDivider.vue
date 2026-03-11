<template>
  <div v-if="isFirst" class="flex items-center gap-2 px-4 py-2 rounded-lg bg-info/10 text-info">
    <Eraser class="w-4 h-4 shrink-0" />
    <span class="text-xs font-medium">Context cleared</span>
  </div>
  <div v-else class="divider text-xs text-base-content/40">/clear — context reset</div>
</template>

<script setup lang="ts">
import { Eraser } from 'lucide-vue-next';
import type { ClearDividerTurn } from '../composables/useGroupedTurns';

defineProps<{
  turn: ClearDividerTurn;
  isFirst?: boolean;
}>();
</script>
