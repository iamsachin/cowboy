<template>
  <div class="divider text-xs text-base-content/40">/clear — context reset</div>
</template>

<script setup lang="ts">
import type { ClearDividerTurn } from '../composables/useGroupedTurns';

defineProps<{
  turn: ClearDividerTurn;
}>();
</script>
