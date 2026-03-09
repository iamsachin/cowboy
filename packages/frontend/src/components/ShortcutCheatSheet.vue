<template>
  <dialog
    ref="dialogRef"
    class="modal"
    @click.self="close"
  >
    <div class="modal-box max-w-lg">
      <h3 class="font-bold text-lg mb-4">Keyboard Shortcuts</h3>

      <template v-for="group in groupedShortcuts" :key="group.name">
        <h4 class="text-sm font-semibold text-base-content/60 mt-4 mb-2">{{ group.name }}</h4>
        <div class="space-y-1">
          <div
            v-for="s in group.items"
            :key="s.label"
            class="flex items-center justify-between py-1.5 px-2 rounded hover:bg-base-200"
          >
            <span class="text-sm">{{ s.description }}</span>
            <kbd class="kbd kbd-sm">{{ s.label }}</kbd>
          </div>
        </div>
      </template>

      <div class="modal-action">
        <button class="btn btn-sm btn-ghost" @click="close">Close</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { shortcuts, showCheatSheet } from '../composables/useKeyboardShortcuts';

const dialogRef = ref<HTMLDialogElement | null>(null);

const GROUP_ORDER = ['Navigation', 'App', 'General'] as const;

const groupedShortcuts = computed(() => {
  const map = new Map<string, typeof shortcuts.value>();
  for (const g of GROUP_ORDER) map.set(g, []);

  for (const s of shortcuts.value) {
    const group = s.group ?? 'General';
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(s);
  }

  return Array.from(map.entries())
    .filter(([, items]) => items.length > 0)
    .map(([name, items]) => ({ name, items }));
});

function close() {
  showCheatSheet.value = false;
}

watch(showCheatSheet, (val) => {
  if (val) {
    dialogRef.value?.showModal();
  } else {
    dialogRef.value?.close();
  }
});

// Also close when dialog is closed natively (Escape key)
watch(dialogRef, (el) => {
  if (el) {
    el.addEventListener('close', () => {
      showCheatSheet.value = false;
    });
  }
});
</script>
