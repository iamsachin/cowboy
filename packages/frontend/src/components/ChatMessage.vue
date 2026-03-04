<template>
  <div>
    <!-- Thinking collapsible (only for assistant messages with thinking content) -->
    <div
      v-if="message.role === 'assistant' && message.thinking"
      class="collapse collapse-arrow bg-base-200 my-2 rounded-lg max-w-[85%]"
    >
      <input type="checkbox" />
      <div class="collapse-title flex items-center gap-2 text-sm font-medium">
        <Brain class="w-4 h-4 text-info shrink-0" />
        <span>Thinking</span>
      </div>
      <div class="collapse-content">
        <pre class="text-xs whitespace-pre-wrap break-words">{{ message.thinking }}</pre>
      </div>
    </div>
    <!-- Chat bubble -->
    <div
      class="max-w-[85%]"
      :class="message.role === 'user' ? 'chat chat-end ml-auto' : 'chat chat-start'"
    >
      <div class="chat-header text-xs text-base-content/50 mb-1">
        {{ message.role === 'user' ? 'You' : 'Assistant' }}
        <time class="ml-1">{{ formatTime(message.createdAt) }}</time>
      </div>
      <div
        class="chat-bubble whitespace-normal break-words"
        :class="message.role === 'user' ? 'chat-bubble-primary' : ''"
      >
        <template v-if="message.content != null">
          <template v-for="(block, idx) in parsedContent" :key="idx">
            <p v-if="block.type === 'text'" class="whitespace-pre-wrap" :class="message.role === 'assistant' ? 'text-sm text-base-content/70' : ''">{{ block.content }}</p>
            <CodeBlock
              v-else
              :code="block.content"
              :language="block.language"
            />
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MessageRow } from '@cowboy/shared';
import CodeBlock from './CodeBlock.vue';
import { Brain } from 'lucide-vue-next';
import { stripXmlTags } from '../utils/content-sanitizer';

interface ContentBlock {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

const props = defineProps<{
  message: MessageRow;
}>();

function parseContent(raw: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    // Text before the code block
    if (match.index > lastIndex) {
      const text = stripXmlTags(raw.slice(lastIndex, match.index));
      if (text) {
        blocks.push({ type: 'text', content: text });
      }
    }
    blocks.push({
      type: 'code',
      content: match[2],
      language: match[1] || undefined,
    });
    lastIndex = regex.lastIndex;
  }

  // Remaining text after last code block
  if (lastIndex < raw.length) {
    const text = stripXmlTags(raw.slice(lastIndex));
    if (text) {
      blocks.push({ type: 'text', content: text });
    }
  }

  // If no blocks were created, return the whole content as text
  if (blocks.length === 0) {
    const cleaned = stripXmlTags(raw);
    if (cleaned) {
      blocks.push({ type: 'text', content: cleaned });
    }
  }

  return blocks;
}

const parsedContent = computed(() => {
  if (props.message.content == null) return [];
  return parseContent(props.message.content);
});

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
</script>
