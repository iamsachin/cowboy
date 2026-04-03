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

export type PaletteResult =
  | { type: 'page'; item: PageItem }
  | { type: 'conversation'; item: ConversationItem };

const PAGES: PageItem[] = [
  { name: 'Overview', path: '/overview', icon: 'LayoutDashboard' },
  { name: 'Conversations', path: '/conversations', icon: 'MessageSquare' },
  { name: 'Agents', path: '/agents', icon: 'Bot' },
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

const allResults = computed<PaletteResult[]>(() => {
  const pages: PaletteResult[] = filteredPages.value.map((item) => ({ type: 'page', item }));
  const convos: PaletteResult[] = filteredConversations.value.map((item) => ({ type: 'conversation', item }));
  return [...pages, ...convos];
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
      } else {
        router.push(`/conversations/${result.item.id}`);
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
    allResults,
    highlightedIndex,
    open,
    close,
    navigateUp,
    navigateDown,
    select,
    relativeDate,
  };
}
