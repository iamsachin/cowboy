<template>
  <div v-if="!isValidInput">
    <JsonFallbackViewer :input="input" :output="output" />
  </div>
  <div v-else>
    <!-- File path header with +N/-M badges -->
    <div class="flex items-center gap-2 mb-2">
      <span class="text-xs font-mono text-base-content/70 truncate">{{ filePath }}</span>
      <span v-if="diff.additions > 0" class="badge badge-xs badge-success">+{{ diff.additions }}</span>
      <span v-if="diff.deletions > 0" class="badge badge-xs badge-error">-{{ diff.deletions }}</span>
    </div>

    <!-- Diff lines -->
    <div class="bg-base-300 rounded-lg overflow-x-auto font-mono text-xs">
      <div
        v-for="(line, idx) in diff.lines"
        :key="idx"
        :class="[
          'flex',
          line.type === 'add' ? 'bg-green-500/10' : '',
          line.type === 'remove' ? 'bg-red-500/10' : '',
        ]"
      >
        <!-- Old line number gutter -->
        <div class="w-10 text-right pr-1 text-base-content/30 select-none shrink-0">
          {{ line.oldLineNum ?? '' }}
        </div>
        <!-- New line number gutter -->
        <div class="w-10 text-right pr-2 text-base-content/30 select-none shrink-0">
          {{ line.newLineNum ?? '' }}
        </div>
        <!-- Prefix (+/-/space) -->
        <div class="w-4 text-center select-none shrink-0" :class="{
          'text-green-400': line.type === 'add',
          'text-red-400': line.type === 'remove',
          'text-base-content/30': line.type === 'unchanged',
        }">
          {{ line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ' }}
        </div>
        <!-- Content -->
        <div class="whitespace-pre-wrap break-words py-px pr-2 flex-1">{{ line.content }}</div>
      </div>
    </div>

    <!-- Truncation warning -->
    <div v-if="diff.truncated" class="mt-2 text-xs text-amber-500">
      Diff truncated to 500 lines
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { computeLineDiff, type DiffResult } from '../../utils/lcs-diff';
import JsonFallbackViewer from './JsonFallbackViewer.vue';

const props = defineProps<{
  input: unknown;
  output: unknown;
}>();

const typedInput = computed(() => props.input as Record<string, unknown> | null);

const isValidInput = computed(() => {
  if (!props.input || typeof props.input !== 'object') return false;
  const inp = typedInput.value;
  if (!inp) return false;
  // old_string and new_string must exist (can be empty strings for file creation/deletion)
  return 'old_string' in inp && 'new_string' in inp;
});

const filePath = computed(() => {
  return (typedInput.value?.file_path as string) ?? 'unknown file';
});

const diff = computed<DiffResult>(() => {
  if (!isValidInput.value) {
    return { lines: [], additions: 0, deletions: 0, truncated: false };
  }
  const oldStr = String(typedInput.value?.old_string ?? '');
  const newStr = String(typedInput.value?.new_string ?? '');
  return computeLineDiff(oldStr, newStr);
});
</script>
