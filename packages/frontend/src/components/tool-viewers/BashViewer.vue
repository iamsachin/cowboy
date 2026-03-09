<template>
  <div v-if="!isValidInput">
    <JsonFallbackViewer :input="input" :output="output" />
  </div>
  <div v-else>
    <!-- Optional description label -->
    <div v-if="description" class="text-xs text-base-content/50 mb-1">{{ description }}</div>

    <!-- Command in terminal-styled block -->
    <div class="bg-base-300 rounded-lg p-3 font-mono text-xs">
      <span class="text-emerald-400 select-none">$ </span>
      <span class="whitespace-pre-wrap break-words">{{ command }}</span>
    </div>

    <!-- Output section -->
    <div v-if="hasOutput" class="mt-2">
      <pre class="bg-base-300 rounded-lg p-3 text-xs whitespace-pre-wrap break-words max-h-80 overflow-y-auto">{{ displayedOutput }}</pre>
      <button
        v-if="outputTruncated && !showFullOutput"
        class="btn btn-xs btn-ghost mt-1"
        @click.stop="showFullOutput = true"
      >
        Show full output
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { truncateOutput } from '../../utils/turn-helpers';
import JsonFallbackViewer from './JsonFallbackViewer.vue';

const props = defineProps<{
  input: unknown;
  output: unknown;
}>();

const showFullOutput = ref(false);

const typedInput = computed(() => props.input as Record<string, unknown> | null);

const isValidInput = computed(() => {
  if (!props.input || typeof props.input !== 'object') return false;
  return 'command' in (typedInput.value ?? {});
});

const command = computed(() => String(typedInput.value?.command ?? ''));
const description = computed(() => {
  const desc = typedInput.value?.description;
  return desc ? String(desc) : null;
});

const hasOutput = computed(() => {
  if (props.output == null) return false;
  if (typeof props.output === 'string' && props.output.trim() === '') return false;
  return true;
});

const fullOutputText = computed(() => {
  if (props.output == null) return '';
  return typeof props.output === 'string'
    ? props.output
    : JSON.stringify(props.output, null, 2);
});

const truncatedResult = computed(() => truncateOutput(props.output));
const outputTruncated = computed(() => truncatedResult.value.truncated);

const displayedOutput = computed(() => {
  if (props.output == null) return '';
  if (showFullOutput.value || !outputTruncated.value) {
    return fullOutputText.value;
  }
  return truncatedResult.value.text;
});
</script>
