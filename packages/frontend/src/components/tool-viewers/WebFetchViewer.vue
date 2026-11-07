<template>
  <div v-if="!url">
    <JsonFallbackViewer :input="input" :output="output" />
  </div>
  <div v-else class="space-y-2">
    <div class="bg-base-300 rounded-lg p-3 space-y-1">
      <div class="font-mono break-all text-info select-all">{{ url }}</div>
      <div v-if="prompt" class="text-base-content/60 whitespace-pre-wrap break-words">{{ prompt }}</div>
    </div>
    <div
      v-if="outputText"
      class="thinking-content bg-base-300 rounded-lg p-3 max-h-96 overflow-y-auto"
      v-html="renderMarkdown(outputText)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { renderMarkdown } from '../../utils/render-markdown';
import JsonFallbackViewer from './JsonFallbackViewer.vue';

const props = defineProps<{ input: unknown; output: unknown }>();

const inp = computed(() => (props.input ?? {}) as Record<string, unknown>);
const url = computed(() => (typeof inp.value.url === 'string' ? inp.value.url : ''));
const prompt = computed(() => (typeof inp.value.prompt === 'string' ? inp.value.prompt : ''));
const outputText = computed(() =>
  props.output == null ? '' : typeof props.output === 'string' ? props.output : JSON.stringify(props.output, null, 2),
);
</script>

<style>
@import '../../styles/markdown-content.css';
</style>
