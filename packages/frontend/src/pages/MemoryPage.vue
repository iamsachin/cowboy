<template>
  <div class="px-4 pt-2 pb-4 space-y-4">
    <div class="flex items-center gap-3">
      <h1 class="text-2xl font-bold">Memory</h1>
      <button class="btn btn-ghost btn-sm btn-square" aria-label="Reload memory" @click="load">
        <RefreshCw class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
      </button>
    </div>

    <div v-if="error" class="alert alert-error text-sm">{{ error }}</div>
    <div v-else-if="!loading && projects.length === 0" class="text-sm text-base-content/60">
      No project memory found. Claude Code writes it to <code>~/.claude/projects/&lt;project&gt;/memory/</code>.
    </div>

    <div v-else class="flex gap-4 min-h-0">
      <!-- Projects + files -->
      <ul class="menu menu-sm bg-base-200 rounded-box w-64 shrink-0 self-start">
        <template v-for="p in projects" :key="p.project">
          <li class="menu-title truncate" :title="p.path">{{ projectLabel(p.project) }}</li>
          <li v-for="f in p.files" :key="f.name">
            <a
              :class="{ active: selected?.project === p.project && selected?.file === f.name }"
              @click="select(p.project, f.name)"
            >
              <FileText class="w-3.5 h-3.5 shrink-0" />
              <span class="truncate">{{ f.name }}</span>
            </a>
          </li>
        </template>
      </ul>

      <!-- Selected file -->
      <div v-if="current" class="flex-1 min-w-0 card bg-base-200">
        <div class="card-body p-4 gap-3">
          <div class="text-xs text-base-content/50 font-mono break-all">{{ currentProject?.path }}/{{ current.name }}</div>
          <div v-if="parsed.meta.length" class="flex flex-wrap gap-2">
            <span v-for="[k, v] in parsed.meta" :key="k" class="badge badge-ghost badge-sm gap-1">
              <span class="text-base-content/50">{{ k }}</span>{{ v }}
            </span>
          </div>
          <div class="thinking-content memory-content" v-html="html" @click="onLinkClick"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { FileText, RefreshCw } from 'lucide-vue-next';
import { API_BASE } from '../utils/api-base';
import { renderMarkdown } from '../utils/render-markdown';
import {
  type ProjectMemory, parseFrontmatter, linkWikilinks, resolveMemoryLink, projectLabel,
} from '../utils/memory';

const projects = ref<ProjectMemory[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const selected = ref<{ project: string; file: string } | null>(null);

const currentProject = computed(() => projects.value.find((p) => p.project === selected.value?.project));
const current = computed(() => currentProject.value?.files.find((f) => f.name === selected.value?.file));
const parsed = computed(() => parseFrontmatter(current.value?.content ?? ''));
const html = computed(() => renderMarkdown(linkWikilinks(parsed.value.body), true));

function select(project: string, file: string) {
  selected.value = { project, file };
}

function onLinkClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest('a');
  if (!a) return;
  e.preventDefault(); // never let a link navigate the app webview
  const href = a.getAttribute('href') ?? '';
  const target = currentProject.value && resolveMemoryLink(href, currentProject.value.files);
  if (target) select(currentProject.value!.project, target.name);
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch(`${API_BASE}/api/memory`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    projects.value = await res.json();
    const first = projects.value[0];
    if (!current.value && first) select(first.project, first.files[0].name);
  } catch (err) {
    error.value = `Failed to load memory: ${err instanceof Error ? err.message : err}`;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style>
@import '../styles/markdown-content.css';
.memory-content { font-size: 0.875rem; }
.memory-content a { color: var(--color-info); text-decoration: underline; cursor: pointer; }
</style>
