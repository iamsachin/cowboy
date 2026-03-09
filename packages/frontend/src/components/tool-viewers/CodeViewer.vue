<template>
  <div v-if="!filePath || !codeContent">
    <JsonFallbackViewer :input="input" :output="output" />
  </div>
  <div v-else>
    <!-- File path header with language badge -->
    <div class="flex items-center gap-2 mb-2">
      <span class="text-xs font-mono text-base-content/70 truncate">{{ filePath }}</span>
      <span v-if="language" class="badge badge-xs badge-ghost">{{ language }}</span>
    </div>

    <!-- Code display using existing CodeBlock component -->
    <CodeBlock :code="codeContent" :language="language" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getLanguageFromPath } from '../../utils/file-lang-map';
import CodeBlock from '../CodeBlock.vue';
import JsonFallbackViewer from './JsonFallbackViewer.vue';

const props = defineProps<{
  input: unknown;
  output: unknown;
  toolName: string;
}>();

const typedInput = computed(() => props.input as Record<string, unknown> | null);

const filePath = computed<string | null>(() => {
  if (!props.input || typeof props.input !== 'object') return null;
  return (typedInput.value?.file_path as string) ?? null;
});

const language = computed<string | undefined>(() => {
  if (!filePath.value) return undefined;
  return getLanguageFromPath(filePath.value);
});

const codeContent = computed<string | null>(() => {
  if (props.toolName === 'Write') {
    // For Write: display input.content (the written file content)
    if (!props.input || typeof props.input !== 'object') return null;
    const content = typedInput.value?.content;
    if (content == null) return null;
    return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  }

  // For Read: display output (the file contents read)
  if (props.output == null) return null;
  return typeof props.output === 'string'
    ? props.output
    : JSON.stringify(props.output, null, 2);
});
</script>
