<template>
  <div class="space-y-3">
    <!-- Input section -->
    <div>
      <div class="text-xs text-base-content/50 mb-1">Input</div>
      <div class="relative group">
        <button
          class="btn btn-xs btn-ghost absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          @click.stop="copyInput"
        >
          <Check v-if="copiedInput" class="w-3 h-3 text-success" />
          <Copy v-else class="w-3 h-3" />
        </button>
        <pre class="bg-base-300 rounded p-2 text-xs whitespace-pre-wrap break-words max-h-80 overflow-y-auto"><code v-html="highlight(inputText)"></code></pre>
      </div>
    </div>

    <!-- Output section -->
    <div>
      <div class="text-xs text-base-content/50 mb-1">Output</div>
      <div class="relative group">
        <button
          class="btn btn-xs btn-ghost absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          @click.stop="copyOutput"
        >
          <Check v-if="copiedOutput" class="w-3 h-3 text-success" />
          <Copy v-else class="w-3 h-3" />
        </button>
        <pre class="bg-base-300 rounded p-2 text-xs whitespace-pre-wrap break-words max-h-80 overflow-y-auto"><code v-html="highlight(displayedOutput)"></code></pre>
      </div>
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
import { Copy, Check } from 'lucide-vue-next';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import { truncateOutput } from '../../utils/turn-helpers';

hljs.registerLanguage('json', json);

function highlight(text: string): string {
  try {
    JSON.parse(text);
    return hljs.highlight(text, { language: 'json' }).value;
  } catch {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

const props = defineProps<{
  input: unknown;
  output: unknown;
}>();

const showFullOutput = ref(false);
const copiedInput = ref(false);
const copiedOutput = ref(false);

const inputText = computed(() => {
  if (props.input == null) return '(none)';
  return typeof props.input === 'string'
    ? props.input
    : JSON.stringify(props.input, null, 2);
});

const fullOutputText = computed(() => {
  if (props.output == null) return '(none)';
  return typeof props.output === 'string'
    ? props.output
    : JSON.stringify(props.output, null, 2);
});

const truncatedResult = computed(() => truncateOutput(props.output));
const outputTruncated = computed(() => truncatedResult.value.truncated);

const displayedOutput = computed(() => {
  if (props.output == null) return '(none)';
  if (showFullOutput.value || !outputTruncated.value) {
    return fullOutputText.value;
  }
  return truncatedResult.value.text;
});

async function copyInput(): Promise<void> {
  try {
    await navigator.clipboard.writeText(inputText.value);
    copiedInput.value = true;
    setTimeout(() => { copiedInput.value = false; }, 1500);
  } catch {
    // Clipboard API not available
  }
}

async function copyOutput(): Promise<void> {
  try {
    await navigator.clipboard.writeText(fullOutputText.value);
    copiedOutput.value = true;
    setTimeout(() => { copiedOutput.value = false; }, 1500);
  } catch {
    // Clipboard API not available
  }
}
</script>
