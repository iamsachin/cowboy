<template>
  <div class="transition-[padding] duration-200" :class="{ 'pr-[236px]': isOpen && data }">
    <div ref="pageRef" class="flex-1 min-w-0 p-4 max-w-5xl mx-auto">
      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center items-center min-h-[60vh]">
        <span class="loading loading-spinner loading-lg"></span>
      </div>

      <!-- Not found state -->
      <div v-else-if="notFound" class="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <div role="alert" class="alert alert-warning max-w-md">
          <AlertTriangle class="w-5 h-5" />
          <span>Conversation not found</span>
        </div>
        <button class="btn btn-ghost btn-sm gap-1" @click="goBack">
          <ArrowLeft class="w-4 h-4" />
          Back to conversations
        </button>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <div role="alert" class="alert alert-error max-w-md">
          <span>{{ error }}</span>
        </div>
        <button class="btn btn-ghost btn-sm gap-1" @click="goBack">
          <ArrowLeft class="w-4 h-4" />
          Back to conversations
        </button>
      </div>

      <!-- Success state -->
      <template v-else-if="data">
        <!-- Back link -->
        <div class="flex items-center gap-1 mb-4">
          <button class="btn btn-ghost btn-sm gap-1" @click="goBack">
            <ArrowLeft class="w-4 h-4" />
            Back to conversations
          </button>
          <router-link
            v-if="data.conversation.parentConversationId"
            :to="'/conversations/' + data.conversation.parentConversationId"
            class="btn btn-ghost btn-sm gap-1"
          >
            <ArrowUpLeft class="w-4 h-4" />
            Parent: {{ data.conversation.parentTitle || 'Unknown' }}
          </router-link>
        </div>

        <!-- Metadata header bar -->
        <div class="bg-base-200 rounded-lg p-4 mb-6">
          <h1 class="text-xl font-bold mb-3 flex items-start gap-2">
            <span class="break-words min-w-0">{{ displayTitle }}</span>
            <span v-if="data.conversation.isActive" class="pulse-dot inline-block"></span>
            <div class="dropdown dropdown-end">
              <button tabindex="0" class="btn btn-ghost btn-xs tooltip tooltip-bottom" data-tip="Export conversation">
                <Download class="w-4 h-4" />
              </button>
              <ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box z-10 w-40 p-2 shadow">
                <li><a @click="handleExportMarkdown">Markdown</a></li>
                <li><a @click="handleExportJson">JSON</a></li>
                <li><a @click="handleExportPlainText">Plain Text</a></li>
              </ul>
            </div>
            <button
              class="btn btn-ghost btn-xs tooltip tooltip-bottom"
              data-tip="Toggle timeline"
              @click="handleToggle"
            >
              <PanelRight class="w-4 h-4" :class="{ 'text-primary': isOpen }" />
            </button>
          </h1>
          <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <!-- Agent badge -->
            <div class="flex items-center gap-1">
              <span class="text-base-content/60">Agent:</span>
              <span class="badge badge-outline badge-sm">{{ data.conversation.agent }}</span>
            </div>

            <!-- Skill -->
            <div v-if="skillInvocation" class="flex items-center gap-1">
              <span class="text-base-content/60">Skill:</span>
              <span>{{ skillInvocation }}</span>
            </div>

            <!-- Model -->
            <div class="flex items-center gap-1">
              <span class="text-base-content/60">Model:</span>
              <span>{{ data.conversation.model || '--' }}</span>
            </div>

            <!-- Project -->
            <div class="flex items-center gap-1">
              <span class="text-base-content/60">Project:</span>
              <span>{{ data.conversation.project || '--' }}</span>
            </div>

            <!-- Date -->
            <div class="flex items-center gap-1">
              <span class="text-base-content/60">Date:</span>
              <span>{{ formatDate(data.conversation.createdAt) }}</span>
            </div>

            <!-- Duration -->
            <div class="flex items-center gap-1">
              <span class="text-base-content/60">Duration:</span>
              <span>{{ messageDuration }}</span>
            </div>

            <!-- Total tokens -->
            <div class="flex items-center gap-1">
              <span class="text-base-content/60">Tokens:</span>
              <span>{{ formatNumber(totalTokens) }}</span>
              <span
                v-if="data.tokenSummary.cacheReadTokens > 0"
                class="text-base-content/50 text-xs"
              >({{ formatNumber(data.tokenSummary.cacheReadTokens) }} cached)</span>
            </div>

            <!-- Cost -->
            <div class="flex items-center gap-1">
              <span class="text-base-content/60">Cost:</span>
              <span>{{ data.tokenSummary.cost != null ? formatCost(data.tokenSummary.cost) : 'N/A' }}</span>
              <span
                v-if="data.tokenSummary.savings != null && data.tokenSummary.savings > 0"
                class="text-success text-xs"
              >
                (saved {{ formatCost(data.tokenSummary.savings) }})
              </span>
            </div>
          </div>
        </div>

        <!-- Conversation timeline -->
        <ConversationDetail
          ref="detailRef"
          :messages="data.messages"
          :toolCalls="data.toolCalls"
          :tokenUsageByMessage="data.tokenUsageByMessage"
          :compactionEvents="data.compactionEvents ?? []"
          :conversationId="id"
          :newGroupKeys="newGroupKeys"
          :scrollContainerRef="scrollContainer"
        />
      </template>
    </div>

    <!-- Timeline panel -->
    <div
      v-if="isOpen && data"
      ref="timelinePanelRef"
      :style="{ left: timelineLeft + 'px' }"
      class="fixed top-[62px] w-[260px] h-[calc(100vh-62px-16px)] overflow-y-auto hide-scrollbar border border-base-300 bg-base-100 z-10 rounded-xl shadow-lg transition-[left,opacity] duration-200 ease-out"
      :class="timelineReady ? 'opacity-100' : 'opacity-0'">
        <ConversationTimeline
          :events="timelineEvents"
          :active-key="activeKey"
          :is-active="data.conversation.isActive ?? false"
          @navigate="handleTimelineNavigate"
        />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, watchEffect, nextTick, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, ArrowUpLeft, AlertTriangle, PanelRight, Download } from 'lucide-vue-next';
import { useConversationDetail } from '../composables/useConversationDetail';
import { useTimeline, extractTimelineEvents } from '../composables/useTimeline';
import { useScrollTracker } from '../composables/useScrollTracker';
import ConversationDetail from '../components/ConversationDetail.vue';
import ConversationTimeline from '../components/ConversationTimeline.vue';
import { cleanTitle} from '../utils/content-sanitizer';
import { formatCost } from '../utils/format-tokens';
import { exportAsMarkdown, exportAsJson, exportAsPlainText, downloadFile, sanitizeFilename } from '../utils/conversation-exporter';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;

function goBack() {
  if (window.history.state?.back) {
    router.back();
  } else {
    router.push('/conversations');
  }
}

const { data, loading, error, notFound, newGroupKeys, refreshing } = useConversationDetail(id);

// Timeline state
const { isOpen, toggle, activeKey, setActiveKey } = useTimeline();

// Scroll container: the <main> element from DashboardLayout
const pageRef = ref<HTMLElement | null>(null);
const scrollContainer = ref<HTMLElement | null>(null);

// ConversationDetail ref for accessing exposed methods
const detailRef = ref<InstanceType<typeof ConversationDetail> | null>(null);

// Timeline panel ref for auto-scroll tracking
const timelinePanelRef = ref<HTMLElement | null>(null);

// Dynamically center timeline in the space right of the content
const timelineLeft = ref(0);
const timelineReady = ref(false);

function updateTimelineLeft() {
  if (!pageRef.value) return;
  const rect = pageRef.value.getBoundingClientRect();
  const contentRight = rect.right;
  const viewportWidth = window.innerWidth;
  const spaceRight = viewportWidth - contentRight;
  timelineLeft.value = contentRight + (spaceRight - 260) / 2 - 8;
}

onMounted(() => {
  if (pageRef.value) {
    const main = pageRef.value.closest('main');
    scrollContainer.value = main as HTMLElement | null;
    if (main) main.scrollTop = 0;
  }
  // Start off-screen right, then slide + fade in after layout settles
  timelineLeft.value = window.innerWidth;
  setTimeout(() => {
    updateTimelineLeft();
    nextTick(() => { timelineReady.value = true; });
  }, 250);
  window.addEventListener('resize', updateTimelineLeft);
});

// Recalculate when timeline visibility changes (padding transition)
watch(isOpen, (open) => {
  if (open) {
    timelineReady.value = false;
    // Start off-screen to the right
    timelineLeft.value = window.innerWidth;
    setTimeout(() => {
      updateTimelineLeft();
      nextTick(() => { timelineReady.value = true; });
    }, 50);
  } else {
    timelineReady.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', updateTimelineLeft);
});

// Scroll tracker for the timeline panel (used for auto-scroll to new events)
const { isAtBottom: isTimelineAtBottom } = useScrollTracker(timelinePanelRef);

// Timeline events derived from ConversationDetail exposed turns
const timelineEvents = computed(() => {
  const turns = detailRef.value?.turns;
  if (!turns) return [];
  return extractTimelineEvents(turns);
});

// --- Toggle handler ---
async function handleToggle() {
  toggle();
  await nextTick();
  updateTimelineLeft();
  // Update again after padding transition completes
  setTimeout(updateTimelineLeft, 220);
  setupObserver();
}

// --- Click-to-scroll navigation handler ---
const navigating = ref(false);
let navigatingTimeout: ReturnType<typeof setTimeout> | null = null;

async function handleTimelineNavigate(key: string, turnIndex: number) {
  // Set navigating flag to prevent observer from interfering
  navigating.value = true;
  if (navigatingTimeout) clearTimeout(navigatingTimeout);

  // Manually set activeKey so timeline highlights immediately
  setActiveKey(key);

  // 1. Load more if beyond pagination boundary
  detailRef.value?.loadUpTo(turnIndex);
  await nextTick();

  // 2. Auto-expand if collapsed assistant group
  detailRef.value?.expandGroup(key);
  await nextTick();

  // 3. Smooth scroll to element
  const el = scrollContainer.value?.querySelector(`[data-turn-key="${key}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Clear navigating flag after scroll settles
  navigatingTimeout = setTimeout(() => { navigating.value = false; }, 600);
}

// --- IntersectionObserver for active event tracking ---
let observer: IntersectionObserver | null = null;
const visibleTurnKeys = new Set<string>();

function setupObserver() {
  observer?.disconnect();
  visibleTurnKeys.clear();
  const root = scrollContainer.value;
  if (!root) return;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const key = (entry.target as HTMLElement).dataset.turnKey;
        if (!key) continue;
        if (entry.isIntersecting) visibleTurnKeys.add(key);
        else visibleTurnKeys.delete(key);
      }
      // Skip observer updates during programmatic navigation
      if (navigating.value) return;
      // Find topmost visible key in timeline event order
      const eventKeys = timelineEvents.value.map(e => e.key);
      for (const k of eventKeys) {
        if (visibleTurnKeys.has(k)) { setActiveKey(k); return; }
      }
      // No timeline event visible -- keep previous activeKey
    },
    { root, threshold: 0.1 }
  );

  for (const el of root.querySelectorAll('[data-turn-key]')) {
    observer.observe(el);
  }
}

// Re-observe when turns change (live updates, pagination changes)
watch(timelineEvents, () => nextTick(setupObserver), { immediate: false });
// Initial setup after mount
onMounted(() => nextTick(setupObserver));
onUnmounted(() => {
  observer?.disconnect();
  if (navigatingTimeout) clearTimeout(navigatingTimeout);
});

// --- Timeline panel auto-scroll to keep highlighted event in view ---
watch(activeKey, (key) => {
  if (!key || !timelinePanelRef.value) return;
  const el = timelinePanelRef.value.querySelector(`[data-timeline-key="${key}"]`);
  el?.scrollIntoView({ behavior: navigating.value ? 'instant' : 'smooth', block: 'nearest' });
});

// --- Timeline auto-scroll to new events only when user is at bottom ---
watch(
  () => timelineEvents.value.length,
  (newLen, oldLen) => {
    if (newLen > (oldLen ?? 0) && isTimelineAtBottom.value && timelinePanelRef.value) {
      nextTick(() => {
        timelinePanelRef.value?.scrollTo({
          top: timelinePanelRef.value.scrollHeight,
          behavior: 'smooth',
        });
      });
    }
  }
);

// Dev-mode assertion: warn on duplicate message IDs
if (import.meta.env.DEV) {
  watchEffect(() => {
    if (!data.value) return;
    const ids = data.value.messages.map(m => m.id);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) duplicates.push(id);
      seen.add(id);
    }
    if (duplicates.length > 0) {
      console.warn('Duplicate message IDs detected:', duplicates);
    }
  });
}

const totalTokens = computed(() => {
  if (!data.value) return 0;
  const s = data.value.tokenSummary;
  return s.inputTokens + s.outputTokens;
});

const messageDuration = computed(() => {
  if (!data.value) return '--';
  const c = data.value.conversation;
  const first = c.firstMessageAt || c.createdAt;
  const last = c.lastMessageAt || c.updatedAt;
  if (first === last) return '--';
  return formatDuration(first, last);
});

const displayTitle = computed(() => cleanTitle(data.value?.conversation.title || ''));

const skillInvocation = computed(() => {
  if (!data.value) return null;
  for (const msg of data.value.messages) {
    if (msg.role !== 'user' || !msg.content) continue;
    // Check for "Base directory for this skill:" pattern
    const skillMatch = msg.content.match(/^Base directory for this skill:\s*\S+\/skills\/([^\/\s#]+)/);
    if (skillMatch) return skillMatch[1];
    // Check for structured skill prompts with known patterns
    if (/<objective>/.test(msg.content) && /<execution_context>/.test(msg.content)) {
      const refMatch = msg.content.match(/skills\/([^\/\s]+)\//);
      if (refMatch) return refMatch[1];
      return 'skill';
    }
  }
  return null;
});

// Set document title
watchEffect(() => {
  document.title = `${displayTitle.value} - Cowboy`;
});

const numberFormatter = new Intl.NumberFormat();

function formatNumber(n: number): string {
  return numberFormatter.format(n);
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function formatDuration(start: string, end: string): string {
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 0) return '--';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  } catch {
    return '--';
  }
}

// --- Export handlers ---
function getExportFilename(ext: string): string {
  const title = data.value?.conversation.title || 'conversation';
  const date = new Date().toISOString().slice(0, 10);
  return `${sanitizeFilename(title)}-${date}.${ext}`;
}

function handleExportMarkdown(): void {
  if (!data.value) return;
  const content = exportAsMarkdown(data.value);
  downloadFile(content, getExportFilename('md'), 'text/markdown');
}

function handleExportJson(): void {
  if (!data.value) return;
  const content = exportAsJson(data.value);
  downloadFile(content, getExportFilename('json'), 'application/json');
}

function handleExportPlainText(): void {
  if (!data.value) return;
  const content = exportAsPlainText(data.value);
  downloadFile(content, getExportFilename('txt'), 'text/plain');
}
</script>

<style scoped>
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: oklch(0.72 0.19 142);
  animation: pulse-fade 1.5s ease-in-out infinite;
}

@keyframes pulse-fade {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
