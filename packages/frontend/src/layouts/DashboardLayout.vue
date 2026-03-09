<template>
  <div class="flex h-screen bg-base-300">
    <AppSidebar v-show="!sidebarHidden" />
    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>
    <ShortcutCheatSheet />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import AppSidebar from '../components/AppSidebar.vue';
import ShortcutCheatSheet from '../components/ShortcutCheatSheet.vue';
import { useKeyboardShortcuts, showCheatSheet } from '../composables/useKeyboardShortcuts';

const { register } = useKeyboardShortcuts();

// Sidebar fully-hidden state (separate from the sidebar's own collapse toggle)
const sidebarHidden = ref(localStorage.getItem('sidebar-hidden') === 'true');

watch(sidebarHidden, (val) => {
  localStorage.setItem('sidebar-hidden', String(val));
});

// Cmd+B: toggle sidebar visibility
register({
  key: 'b',
  meta: true,
  handler: () => {
    sidebarHidden.value = !sidebarHidden.value;
  },
  description: 'Toggle sidebar',
  label: 'Cmd+B',
  group: 'App',
});

// ?: open cheat sheet
register({
  key: '?',
  handler: () => {
    showCheatSheet.value = true;
  },
  description: 'Show keyboard shortcuts',
  label: '?',
  group: 'General',
});
</script>
