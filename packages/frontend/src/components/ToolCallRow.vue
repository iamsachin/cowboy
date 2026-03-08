<template>
  <div class="text-xs">
    <!-- Compact row: always visible -->
    <div class="flex items-center gap-2 py-1 px-2 rounded bg-base-300/50">
      <component :is="toolIcon.icon" class="w-3.5 h-3.5 shrink-0" :class="toolIcon.colorClass" />
      <span class="truncate">{{ toolCall.name }}</span>
      <span
        v-if="toolCall.status === 'completed'"
        class="badge badge-xs badge-success"
      >
        {{ toolCall.status }}
      </span>
      <span
        v-else-if="toolCall.status"
        class="badge badge-xs badge-warning"
      >
        {{ toolCall.status }}
      </span>
      <span v-else class="badge badge-xs badge-ghost">unknown</span>
      <span
        v-if="toolCall.duration != null"
        class="text-base-content/50 ml-auto"
      >
        {{ toolCall.duration }}ms
      </span>
    </div>

    <!-- Expandable I/O details -->
    <details class="ml-6 mt-1" @click.stop>
      <summary class="text-xs text-info cursor-pointer">Show details</summary>
      <div class="mt-2 space-y-3">
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
            <pre class="bg-base-300 rounded p-2 text-xs whitespace-pre-wrap break-words max-h-80 overflow-y-auto">{{ inputText }}</pre>
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
            <pre class="bg-base-300 rounded p-2 text-xs whitespace-pre-wrap break-words max-h-80 overflow-y-auto">{{ displayedOutput }}</pre>
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
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Copy, Check } from 'lucide-vue-next';
import type { ToolCallRow } from '@cowboy/shared';
import { truncateOutput } from '../utils/turn-helpers';
import { getToolIcon } from '../utils/tool-icons';

const props = defineProps<{
  toolCall: ToolCallRow;
}>();

const toolIcon = computed(() => getToolIcon(props.toolCall.name));
const showFullOutput = ref(false);
const copiedInput = ref(false);
const copiedOutput = ref(false);

const inputText = computed(() => {
  if (props.toolCall.input == null) return '(none)';
  return typeof props.toolCall.input === 'string'
    ? props.toolCall.input
    : JSON.stringify(props.toolCall.input, null, 2);
});

const fullOutputText = computed(() => {
  if (props.toolCall.output == null) return '(none)';
  return typeof props.toolCall.output === 'string'
    ? props.toolCall.output
    : JSON.stringify(props.toolCall.output, null, 2);
});

const truncatedResult = computed(() => truncateOutput(props.toolCall.output));

const outputTruncated = computed(() => truncatedResult.value.truncated);

const displayedOutput = computed(() => {
  if (props.toolCall.output == null) return '(none)';
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
