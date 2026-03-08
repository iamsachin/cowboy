<template>
  <div class="flex flex-col items-start my-1 w-full">
    <!-- Collapsed indicator (default) -->
    <div
      class="cursor-pointer select-none flex items-center gap-2 px-3 py-1 rounded-full border border-base-content/20 bg-base-300/30 text-base-content/40 text-xs hover:bg-base-300/50 transition-colors"
      @click="expanded = !expanded"
    >
      <ChevronRight
        class="w-3 h-3 shrink-0 transition-transform"
        :class="{ 'rotate-90': expanded }"
      />
      <span>{{ summaryLabel }}</span>
    </div>

    <!-- Expanded content (shown below the indicator, in-flow) -->
    <Transition name="fade">
      <div
        v-if="expanded"
        class="mt-2 w-full max-w-xl bg-base-200 border border-base-300 rounded-lg overflow-hidden"
      >
        <div
          v-for="(msg, idx) in group.messages"
          :key="msg.id"
          class="px-3 py-2 border-b border-base-300 last:border-0"
        >
          <div class="flex items-center gap-1.5 mb-1">
            <span class="badge badge-ghost badge-xs">{{ categoryLabel(group.categories[idx]) }}</span>
          </div>
          <div class="thinking-content max-h-40 overflow-y-auto text-xs text-base-content/60 break-words" v-html="renderMarkdown(stripXmlTags(msg.content || ''))"></div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronRight } from 'lucide-vue-next';
import type { SystemGroup, SystemMessageCategory } from '../composables/useGroupedTurns';
import { stripXmlTags } from '../utils/content-sanitizer';
import { renderMarkdown } from '../utils/render-markdown';

const props = defineProps<{
  group: SystemGroup;
}>();

const expanded = ref(false);

const categoryLabels: Record<SystemMessageCategory, string> = {
  'system-reminder': 'System reminder',
  'skill-instruction': 'Skill instruction',
  'objective': 'Objective',
  'system-caveat': 'System caveat',
  'task-notification': 'Task notification',
  'interrupt': 'Interrupt',
  'other': 'System',
};

function categoryLabel(category: SystemMessageCategory): string {
  return categoryLabels[category] ?? 'System';
}

const summaryLabel = computed(() => {
  const count = props.group.count;
  const uniqueCategories = [...new Set(props.group.categories)];
  const hints = uniqueCategories.map(c => categoryLabels[c]).join(', ');
  const noun = count === 1 ? 'system message' : 'system messages';
  return `${count} ${noun} (${hints})`;
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.thinking-content :deep(h1),
.thinking-content :deep(h2),
.thinking-content :deep(h3),
.thinking-content :deep(h4) {
  font-weight: 600;
  margin-top: 0.75em;
  margin-bottom: 0.25em;
}
.thinking-content :deep(h1) { font-size: 1.1em; }
.thinking-content :deep(h2) { font-size: 1.05em; }
.thinking-content :deep(h3) { font-size: 1em; }
.thinking-content :deep(ul),
.thinking-content :deep(ol) {
  padding-left: 1.5em;
  margin: 0.25em 0;
}
.thinking-content :deep(ul) { list-style-type: disc; }
.thinking-content :deep(ol) { list-style-type: decimal; }
.thinking-content :deep(li) { margin: 0.1em 0; }
.thinking-content :deep(code) {
  background: oklch(0.25 0 0 / 0.5);
  padding: 0.1em 0.3em;
  border-radius: 0.25em;
  font-size: 0.9em;
}
.thinking-content :deep(pre) {
  background: oklch(0.2 0 0 / 0.5);
  padding: 0.75em;
  border-radius: 0.375em;
  overflow-x: auto;
  margin: 0.5em 0;
}
.thinking-content :deep(pre code) {
  background: none;
  padding: 0;
}
.thinking-content :deep(p) { margin: 0.25em 0; }
.thinking-content :deep(strong) { font-weight: 600; }
.thinking-content :deep(table) {
  border-collapse: collapse;
  margin: 0.5em 0;
  font-size: 0.9em;
}
.thinking-content :deep(th),
.thinking-content :deep(td) {
  border: 1px solid oklch(0.4 0 0);
  padding: 0.25em 0.5em;
}
</style>
