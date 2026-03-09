<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-if="visible"
      class="bg-base-200 border-b border-base-300 shadow-sm px-3 py-1.5 flex items-center gap-2"
    >
      <Search class="w-4 h-4 text-base-content/50 shrink-0" />

      <input
        ref="inputRef"
        :value="query"
        type="text"
        class="input input-sm input-bordered flex-1 min-w-0"
        placeholder="Search in conversation..."
        @input="$emit('update:query', ($event.target as HTMLInputElement).value)"
        @keydown.enter.exact.prevent="$emit('next')"
        @keydown.shift.enter.exact.prevent="$emit('prev')"
        @keydown.escape.prevent="$emit('close')"
      />

      <span
        v-if="totalMatches > 0"
        class="text-xs text-base-content/60 whitespace-nowrap tabular-nums"
      >
        {{ currentMatch }} of {{ totalMatches }}
      </span>
      <span
        v-else-if="query.length > 0"
        class="text-xs text-base-content/40 whitespace-nowrap"
      >
        No matches
      </span>

      <button
        class="btn btn-ghost btn-xs btn-square"
        :disabled="totalMatches === 0"
        title="Previous match (Shift+Enter)"
        @click="$emit('prev')"
      >
        <ChevronUp class="w-4 h-4" />
      </button>

      <button
        class="btn btn-ghost btn-xs btn-square"
        :disabled="totalMatches === 0"
        title="Next match (Enter)"
        @click="$emit('next')"
      >
        <ChevronDown class="w-4 h-4" />
      </button>

      <button
        class="btn btn-ghost btn-xs btn-square"
        title="Close (Escape)"
        @click="$emit('close')"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-vue-next';

const props = defineProps<{
  query: string;
  currentMatch: number;
  totalMatches: number;
  visible: boolean;
}>();

defineEmits<{
  'update:query': [value: string];
  next: [];
  prev: [];
  close: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);

// Auto-focus when search bar becomes visible
watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    nextTick(() => {
      inputRef.value?.focus();
    });
  }
});
</script>
