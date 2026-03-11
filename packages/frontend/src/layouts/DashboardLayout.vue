<template>
  <div class="flex h-screen bg-base-300">
    <AppSidebar v-show="!sidebarHidden" />
    <main class="flex-1 overflow-y-auto relative z-20" style="-webkit-app-region: no-drag;">
      <slot />
    </main>
    <ShortcutCheatSheet />
    <CommandPalette />
    <LiveTokenPill />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppSidebar from '../components/AppSidebar.vue';
import ShortcutCheatSheet from '../components/ShortcutCheatSheet.vue';
import CommandPalette from '../components/CommandPalette.vue';
import LiveTokenPill from '../components/LiveTokenPill.vue';
import { useKeyboardShortcuts, showCheatSheet } from '../composables/useKeyboardShortcuts';
import { useCommandPalette } from '../composables/useCommandPalette';

const { register } = useKeyboardShortcuts();
const router = useRouter();
const { open: openPalette } = useCommandPalette(router);

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

// Cmd+K: open command palette
register({
  key: 'k',
  meta: true,
  handler: () => {
    openPalette();
  },
  description: 'Open command palette',
  label: 'Cmd+K',
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
