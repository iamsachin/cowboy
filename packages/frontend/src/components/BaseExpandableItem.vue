<template>
  <div>
    <div
      class="flex items-center gap-2 text-sm cursor-pointer select-none"
      @click="$emit('toggle')"
    >
      <ChevronRight
        class="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
        :class="{ 'rotate-90': expanded }"
      />
      <component
        v-if="icon"
        :is="icon"
        class="w-4 h-4 shrink-0"
        :class="iconClass"
      />
      <span>{{ label }}</span>
      <slot name="header-extra" />
    </div>
    <div
      class="thinking-body"
      :class="expanded ? 'thinking-body--expanded' : 'thinking-body--collapsed'"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next';
import type { Component } from 'vue';

defineProps<{
  expanded: boolean;
  icon?: Component;
  iconClass?: string;
  label: string;
}>();

defineEmits<{
  toggle: [];
}>();
</script>

<style scoped>
.thinking-body {
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.2s ease;
}
.thinking-body--collapsed {
  max-height: 0;
  opacity: 0;
}
.thinking-body--expanded {
  max-height: 2000px;
  opacity: 1;
}
</style>
