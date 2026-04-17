import { ref, computed, watch } from 'vue';
import Fuse from 'fuse.js';
import type { Router } from 'vue-router';
import { API_BASE } from '../utils/api-base';

export interface ConversationItem {
  id: string;
  title: string;
  agent: string;
  project: string;
  date: string;
}

export interface PageItem {
  name: string;
  path: string;
  icon: string;
}

/** Sub-agent in the currently-open conversation. Source: useSubagentList. */
export interface CurrentSubagentItem {
  toolCallId: string;
  description: string;
  status: 'success' | 'error' | 'interrupted' | 'running' | 'unmatched' | 'missing' | 'summary';
}

/** Sub-agent across all conversations. Source: GET /api/analytics/subagents/recent. */
export interface RecentSubagentItem {
  conversationId: string;
  toolCallId: string;
  description: string;
  status: string | null;
  timestamp: string;
}

export type PaletteResult =
  | { type: 'page'; item: PageItem }
  | { type: 'conversation'; item: ConversationItem }
  | { type: 'current-subagent'; item: CurrentSubagentItem; index: number }
  | { type: 'recent-subagent'; item: RecentSubagentItem };

const PAGES: PageItem[] = [
  { name: 'Overview', path: '/overview', icon: 'LayoutDashboard' },
  { name: 'Conversations', path: '/conversations', icon: 'MessageSquare' },
  { name: 'Analytics', path: '/analytics', icon: 'BarChart3' },
  { name: 'Settings', path: '/settings', icon: 'Settings' },
];

// Module-level singleton state
const isOpen = ref(false);
const query = ref('');
const highlightedIndex = ref(0);
const conversations = ref<ConversationItem[]>([]);
const loading = ref(false);
let conversationsLoaded = false;
let fuseInstance: Fuse<ConversationItem> | null = null;

// IMPR-10: sub-agent state
const currentConversationSubagents = ref<CurrentSubagentItem[]>([]);
const currentConversationId = ref<string | null>(null);
const recentSubagents = ref<RecentSubagentItem[]>([]);
let recentSubagentsLoaded = false;
let recentSubagentsFuse: Fuse<RecentSubagentItem> | null = null;

function createFuseInstance(items: ConversationItem[]): Fuse<ConversationItem> {
  return new Fuse(items, {
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'agent', weight: 0.15 },
      { name: 'project', weight: 0.15 },
    ],
    threshold: 0.4,
    includeMatches: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
  });
}

const filteredPages = computed(() => {
  if (!query.value) return PAGES;
  const q = query.value.toLowerCase();
  return PAGES.filter((p) => p.name.toLowerCase().includes(q));
});

const filteredConversations = computed(() => {
  if (!query.value) {
    return conversations.value.slice(0, 10);
  }
  if (!fuseInstance) return [];
  const results = fuseInstance.search(query.value);
  return results.slice(0, 10).map((r) => r.item);
});

/** Match `sub N` (1-indexed) to jump to a sub-agent in the current conversation. */
const subIndexMatch = computed<{ index: number; item: CurrentSubagentItem } | null>(() => {
  const m = query.value.trim().match(/^sub\s+(\d+)$/i);
  if (!m) return null;
  const idx = parseInt(m[1], 10) - 1;
  const item = currentConversationSubagents.value[idx];
  if (!item) return null;
  return { index: idx, item };
});

const filteredCurrentSubagents = computed<PaletteResult[]>(() => {
  // `sub N` exact-jump takes priority over keyword filtering.
  if (subIndexMatch.value) {
    return [{
      type: 'current-subagent',
      item: subIndexMatch.value.item,
      index: subIndexMatch.value.index,
    }];
  }
  if (!query.value || currentConversationSubagents.value.length === 0) return [];
  const q = query.value.toLowerCase();
  return currentConversationSubagents.value
    .map((item, index) => ({ type: 'current-subagent' as const, item, index }))
    .filter((r) => r.item.description.toLowerCase().includes(q))
    .slice(0, 5);
});

const filteredRecentSubagents = computed<PaletteResult[]>(() => {
  if (subIndexMatch.value) return []; // exact `sub N` mode suppresses fuzzy results
  if (!query.value) return [];
  if (!recentSubagentsFuse) return [];
  // Filter out sub-agents that already appear in current-conversation results.
  const currentIds = new Set(currentConversationSubagents.value.map((s) => s.toolCallId));
  const results = recentSubagentsFuse.search(query.value);
  return results
    .map((r) => r.item)
    .filter((item) => !currentIds.has(item.toolCallId))
    .slice(0, 5)
    .map((item) => ({ type: 'recent-subagent' as const, item }));
});

const allResults = computed<PaletteResult[]>(() => {
  const pages: PaletteResult[] = filteredPages.value.map((item) => ({ type: 'page', item }));
  const convos: PaletteResult[] = filteredConversations.value.map((item) => ({ type: 'conversation', item }));
  return [
    ...filteredCurrentSubagents.value,
    ...pages,
    ...convos,
    ...filteredRecentSubagents.value,
  ];
});

// Reset highlight on query change
watch(query, () => {
  highlightedIndex.value = 0;
});

export function relativeDate(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay <= 7) return `${diffDay}d ago`;

  const d = new Date(iso);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

/**
 * Command palette composable (singleton).
 *
 * Provides Cmd+K palette state, Fuse.js search, and keyboard navigation.
 * Pass a router instance for navigation (required in App.vue context).
 */
export function useCommandPalette(router?: Router) {
  async function open() {
    isOpen.value = true;
    query.value = '';
    highlightedIndex.value = 0;

    if (!conversationsLoaded) {
      loading.value = true;
      try {
        const res = await fetch(`${API_BASE}/api/analytics/conversations?limit=100&sort=date&order=desc`);
        if (res.ok) {
          const data = await res.json();
          conversations.value = (data.rows || []).map((r: any) => ({
            id: r.id,
            title: r.title || 'Untitled',
            agent: r.agent || '',
            project: r.project || '',
            date: r.date,
          }));
          fuseInstance = createFuseInstance(conversations.value);
          conversationsLoaded = true;
        }
      } catch {
        // Silently fail -- palette still works for pages
      } finally {
        loading.value = false;
      }
    }

    // IMPR-10: lazy-load recent sub-agents (parallel to conversations).
    if (!recentSubagentsLoaded) {
      try {
        const res = await fetch(`${API_BASE}/api/analytics/subagents/recent?limit=100`);
        if (res.ok) {
          recentSubagents.value = await res.json();
          recentSubagentsFuse = new Fuse(recentSubagents.value, {
            keys: [{ name: 'description', weight: 1 }],
            threshold: 0.4,
            includeMatches: false,
            minMatchCharLength: 2,
            ignoreLocation: true,
          });
          recentSubagentsLoaded = true;
        }
      } catch {
        // Silently fail -- palette still works without recent sub-agents.
      }
    }
  }

  /** Push the currently-open conversation's sub-agent list. Called by ConversationDetailPage. */
  function setCurrentConversationSubagents(list: CurrentSubagentItem[], conversationId: string | null) {
    currentConversationSubagents.value = list;
    currentConversationId.value = conversationId;
  }

  function close() {
    isOpen.value = false;
    query.value = '';
    highlightedIndex.value = 0;
  }

  function navigateUp() {
    highlightedIndex.value = Math.max(0, highlightedIndex.value - 1);
  }

  function navigateDown() {
    highlightedIndex.value = Math.min(allResults.value.length - 1, highlightedIndex.value + 1);
  }

  function select() {
    const result = allResults.value[highlightedIndex.value];
    if (!result) return;

    if (router) {
      if (result.type === 'page') {
        router.push(result.item.path);
      } else if (result.type === 'conversation') {
        router.push(`/conversations/${result.item.id}`);
      } else if (result.type === 'current-subagent') {
        // In-page jump: push ?jump= to current route; ConversationDetailPage consumes it.
        if (currentConversationId.value) {
          router.push({
            path: `/conversations/${currentConversationId.value}`,
            query: { jump: result.item.toolCallId },
          });
        }
      } else if (result.type === 'recent-subagent') {
        router.push({
          path: `/conversations/${result.item.conversationId}`,
          query: { jump: result.item.toolCallId },
        });
      }
    }
    close();
  }

  return {
    isOpen,
    query,
    loading,
    filteredPages,
    filteredConversations,
    filteredCurrentSubagents,
    filteredRecentSubagents,
    allResults,
    highlightedIndex,
    open,
    close,
    navigateUp,
    navigateDown,
    select,
    setCurrentConversationSubagents,
    relativeDate,
  };
}
