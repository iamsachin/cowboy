<template>
  <button
    class="btn btn-ghost btn-sm btn-square text-base-content/70 hover:text-base-content"
    @click="toggleTheme"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
  >
    <Moon v-if="isDark" class="w-3.5 h-3.5" />
    <Sun v-else class="w-3.5 h-3.5" />
  </button>
</template>

<script setup lang="ts">
import { Sun, Moon } from 'lucide-vue-next';
import { useTheme } from '../composables/useTheme';

defineProps<{
  collapsed: boolean;
}>();

const { isDark, toggleTheme } = useTheme();
</script>
