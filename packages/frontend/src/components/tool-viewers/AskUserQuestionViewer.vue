<template>
  <div v-if="!questions.length">
    <JsonFallbackViewer :input="input" :output="output" />
  </div>
  <div v-else class="space-y-3">
    <div v-for="q in questions" :key="q.question" class="bg-base-300 rounded-lg p-3 space-y-2">
      <div class="flex items-start gap-2">
        <span v-if="q.header" class="badge badge-sm badge-ghost shrink-0">{{ q.header }}</span>
        <span class="font-medium whitespace-pre-wrap break-words">{{ q.question }}</span>
      </div>
      <ul class="space-y-1">
        <li
          v-for="o in q.options ?? []"
          :key="o.label"
          class="rounded px-2 py-1 border-l-2"
          :class="isChosen(q.question, o.label) ? 'border-success bg-success/10' : 'border-transparent opacity-70'"
        >
          <div class="flex items-center gap-1.5">
            <CircleCheck v-if="isChosen(q.question, o.label)" class="w-3.5 h-3.5 text-success shrink-0" />
            <span class="font-medium">{{ o.label }}</span>
          </div>
          <div v-if="o.description" class="text-base-content/60">{{ o.description }}</div>
        </li>
      </ul>
      <!-- Free-text ("Other") answers or anything not matching an option -->
      <div v-if="answers[q.question] && !matchesOption(q)" class="text-success">
        Answer: {{ answers[q.question] }}
      </div>
      <div v-else-if="!answers[q.question] && output" class="text-base-content/50 whitespace-pre-wrap">{{ output }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CircleCheck } from 'lucide-vue-next';
import { parseAskAnswers } from '../../utils/turn-helpers';
import JsonFallbackViewer from './JsonFallbackViewer.vue';

interface Question {
  question: string;
  header?: string;
  options?: { label: string; description?: string }[];
}

const props = defineProps<{ input: unknown; output: unknown }>();

const questions = computed<Question[]>(() => {
  const q = (props.input as { questions?: unknown } | null)?.questions;
  return Array.isArray(q) ? q.filter((x) => x && typeof x.question === 'string') : [];
});
const answers = computed(() => parseAskAnswers(props.output, questions.value.map((q) => q.question)));

// Multi-select answers are comma-joined labels, so match by inclusion
function isChosen(question: string, label: string): boolean {
  const a = answers.value[question];
  return !!a && (a === label || a.split(', ').includes(label));
}
function matchesOption(q: Question): boolean {
  return (q.options ?? []).some((o) => isChosen(q.question, o.label));
}
</script>
