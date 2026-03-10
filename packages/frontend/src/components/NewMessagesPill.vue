<template>
  <Transition name="pill-fade">
    <button
      v-if="count > 0"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 btn btn-sm btn-primary gap-1 shadow-lg"
      @click="$emit('scrollToBottom')"
    >
      {{ count }} new message{{ count === 1 ? '' : 's' }}
      <ChevronDown class="w-4 h-4" />
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';

defineProps<{
  count: number;
}>();

defineEmits<{
  scrollToBottom: [];
}>();
</script>

<style scoped>
.pill-fade-enter-active,
.pill-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.pill-fade-enter-from,
.pill-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
