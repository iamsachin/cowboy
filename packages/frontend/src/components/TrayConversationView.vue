<template>
  <div ref="contentRef" class="flex-1 overflow-y-auto">
    <div v-if="loading" class="flex items-center justify-center h-full">
      <span class="loading loading-spinner loading-md text-primary"></span>
    </div>
    <div v-else-if="data" class="p-3">
      <ConversationDetail
        :messages="data.messages"
        :toolCalls="data.toolCalls"
        :tokenUsageByMessage="data.tokenUsageByMessage"
        :compactionEvents="data.compactionEvents ?? []"
        :conversationId="conversationId"
        :newGroupKeys="newGroupKeys"
        :scrollContainerRef="contentRef"
        :isActive="data.conversation.isActive ?? false"
      />
    </div>
    <div v-else class="flex items-center justify-center h-full text-base-content/40">
      <p class="text-sm">No messages yet</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import { useConversationDetail } from '../composables/useConversationDetail';
import ConversationDetail from './ConversationDetail.vue';

const props = defineProps<{
  conversationId: string;
}>();

const contentRef = ref<HTMLElement | null>(null);

const { data, loading, newGroupKeys } = useConversationDetail(props.conversationId);

// Auto-scroll to bottom on initial load
watch(loading, (isLoading, wasLoading) => {
  if (wasLoading && !isLoading && contentRef.value) {
    nextTick(() => {
      contentRef.value!.scrollTop = contentRef.value!.scrollHeight;
    });
  }
});
</script>
