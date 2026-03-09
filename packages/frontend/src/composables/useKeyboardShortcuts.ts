import { ref, computed, onMounted, onUnmounted } from 'vue';
import { isEditableElement, type ShortcutHandler } from '../utils/keyboard';

export interface ShortcutRegistration {
  key: string;
  meta?: boolean;
  handler: ShortcutHandler;
  description: string;
  label: string;
  /** Grouping category for cheat sheet display */
  group?: 'Navigation' | 'App' | 'General';
}

// Module-level singleton state so multiple components share registrations
const registry = new Map<string, ShortcutRegistration>();
const listenerCount = ref(0);

/** Reactive list of registered shortcuts (for cheat sheet) */
export const shortcuts = computed(() => Array.from(registry.values()));

/** Controls cheat sheet modal visibility */
export const showCheatSheet = ref(false);

function makeKey(key: string, meta?: boolean): string {
  return meta ? `meta+${key.toLowerCase()}` : key.toLowerCase();
}

function handleKeydown(e: KeyboardEvent) {
  const k = e.key.toLowerCase();
  const hasMeta = e.metaKey || e.ctrlKey;

  // Try meta combos first
  if (hasMeta) {
    const reg = registry.get(makeKey(k, true));
    if (reg) {
      e.preventDefault();
      reg.handler(e);
      return;
    }
  }

  // Non-modifier shortcuts: skip if in editable element
  if (!hasMeta) {
    if (isEditableElement(document.activeElement)) return;
    const reg = registry.get(makeKey(k));
    if (reg) {
      e.preventDefault();
      reg.handler(e);
    }
  }
}

/**
 * Central keyboard shortcut manager (singleton).
 *
 * Call in any component to register shortcuts. The document listener is
 * managed via reference counting — added on first mount, removed when
 * last consumer unmounts.
 */
export function useKeyboardShortcuts() {
  onMounted(() => {
    if (listenerCount.value === 0) {
      document.addEventListener('keydown', handleKeydown);
    }
    listenerCount.value++;
  });

  onUnmounted(() => {
    listenerCount.value--;
    if (listenerCount.value === 0) {
      document.removeEventListener('keydown', handleKeydown);
    }
  });

  function register(shortcut: ShortcutRegistration) {
    registry.set(makeKey(shortcut.key, shortcut.meta), shortcut);
  }

  function unregister(key: string, meta?: boolean) {
    registry.delete(makeKey(key, meta));
  }

  return { register, unregister, shortcuts, showCheatSheet };
}
