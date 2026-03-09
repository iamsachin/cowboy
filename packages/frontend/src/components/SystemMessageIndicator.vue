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
          <div class="relative">
            <div
              class="thinking-content text-xs text-base-content/60 break-words overflow-hidden transition-[max-height] duration-200"
              :class="fullyExpanded.has(msg.id) ? 'max-h-none' : 'max-h-40'"
              v-html="renderMarkdown(stripXmlTags(msg.content || ''))"
            ></div>
            <div
              v-if="!fullyExpanded.has(msg.id)"
              class="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-base-200 to-transparent flex items-end justify-center"
            >
              <button
                class="flex items-center gap-1 text-xs text-base-content/50 hover:text-base-content/80 pb-0.5"
                @click="fullyExpanded.add(msg.id)"
              >
                <ChevronsDown class="w-3 h-3" />
                <span>Show full</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { ChevronRight, ChevronsDown } from 'lucide-vue-next';
import type { SystemGroup, SystemMessageCategory } from '../composables/useGroupedTurns';
import { stripXmlTags } from '../utils/content-sanitizer';
import { renderMarkdown } from '../utils/render-markdown';

const props = defineProps<{
  group: SystemGroup;
}>();

const expanded = ref(false);
const fullyExpanded = reactive(new Set<string>());

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
</style>

<style>
@import '../styles/markdown-content.css';
</style>
