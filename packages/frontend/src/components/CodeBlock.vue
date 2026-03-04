<template>
  <div class="bg-base-300 rounded-lg overflow-x-auto my-2 relative group">
    <!-- Copy button -->
    <button
      class="btn btn-xs btn-ghost absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
      @click="copyCode"
    >
      <Check v-if="copied" class="w-3 h-3 text-success" />
      <Copy v-else class="w-3 h-3" />
      <span class="ml-1">{{ copied ? 'Copied!' : 'Copy' }}</span>
    </button>

    <!-- Two-column layout: line numbers + code -->
    <div class="flex">
      <!-- Line number gutter -->
      <div
        class="text-base-content/30 text-right pr-3 pl-3 py-3 select-none text-xs leading-relaxed font-mono"
        aria-hidden="true"
      >
        <div v-for="n in lineCount" :key="n">{{ n }}</div>
      </div>

      <!-- Highlighted code -->
      <div class="py-3 pr-4 overflow-x-auto flex-1 text-xs leading-relaxed">
        <highlightjs :code="code" :language="language ?? undefined" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Copy, Check } from 'lucide-vue-next';

const props = defineProps<{
  code: string;
  language?: string;
}>();

const lineCount = computed(() => props.code.split('\n').length);

const copied = ref(false);

async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.code);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Clipboard API not available (e.g., non-HTTPS context)
  }
}
</script>
