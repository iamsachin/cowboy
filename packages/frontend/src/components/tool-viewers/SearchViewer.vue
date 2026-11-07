<template>
  <div v-if="!pattern">
    <JsonFallbackViewer :input="input" :output="output" />
  </div>
  <div v-else class="space-y-2">
    <div class="bg-base-300 rounded-lg p-3 font-mono space-y-1">
      <div class="break-all"><span class="text-violet-400 select-none">{{ toolName === 'Glob' ? 'glob ' : '/' }}</span>{{ pattern }}<span v-if="toolName !== 'Glob'" class="text-violet-400 select-none">/</span></div>
      <div v-if="params.length" class="flex flex-wrap gap-1.5">
        <span v-for="[k, v] in params" :key="k" class="badge badge-xs badge-ghost">{{ k }}: {{ v }}</span>
      </div>
    </div>
    <div v-if="outputText">
      <div class="text-base-content/50 mb-1">{{ lines.length }} line{{ lines.length === 1 ? '' : 's' }}</div>
      <pre class="bg-base-300 rounded-lg p-3 whitespace-pre-wrap break-all max-h-80 overflow-y-auto">{{ displayed }}</pre>
      <button v-if="truncated && !showAll" class="btn btn-xs btn-ghost mt-1" @click.stop="showAll = true">
        Show full output
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { truncateOutput } from '../../utils/turn-helpers';
import JsonFallbackViewer from './JsonFallbackViewer.vue';

const props = defineProps<{ input: unknown; output: unknown; toolName: string }>();
const showAll = ref(false);

const inp = computed(() => (props.input ?? {}) as Record<string, unknown>);
const pattern = computed(() => (typeof inp.value.pattern === 'string' ? inp.value.pattern : ''));
// Everything besides the pattern (path, glob, type, output_mode, -i, ...) shown as chips
const params = computed(() =>
  Object.entries(inp.value)
    .filter(([k, v]) => k !== 'pattern' && v != null && v !== '')
    .map(([k, v]) => [k, String(v)] as [string, string]),
);
const outputText = computed(() =>
  props.output == null ? '' : typeof props.output === 'string' ? props.output : JSON.stringify(props.output, null, 2),
);
const lines = computed(() => outputText.value.split('\n').filter(Boolean));
const truncResult = computed(() => truncateOutput(props.output));
const truncated = computed(() => truncResult.value.truncated);
const displayed = computed(() => (showAll.value || !truncated.value ? outputText.value : truncResult.value.text));
</script>
