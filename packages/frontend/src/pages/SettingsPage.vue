<template>
  <div class="p-4 max-w-3xl mx-auto space-y-8">
    <h1 class="text-2xl font-bold">Settings</h1>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="w-6 h-6 animate-spin opacity-60" />
    </div>

    <template v-else-if="settings">
      <!-- Agent Configuration Section -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">
            <Bot class="w-5 h-5" />
            Agent Configuration
          </h2>
          <div class="divider mt-0"></div>

          <!-- Claude Code -->
          <div class="space-y-2">
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                class="toggle toggle-primary"
                v-model="form.claudeCodeEnabled"
              />
              <span class="font-medium">Claude Code</span>
            </div>
            <div class="form-control">
              <input
                type="text"
                class="input input-bordered w-full"
                placeholder="Log directory path"
                v-model="form.claudeCodePath"
                :disabled="!form.claudeCodeEnabled"
              />
              <label class="label" v-if="pathValidation['claude-code']">
                <span
                  class="label-text-alt"
                  :class="pathValidation['claude-code'].valid ? 'text-success' : 'text-error'"
                >
                  {{ pathValidation['claude-code'].message }}
                </span>
              </label>
            </div>
          </div>

          <!-- Cursor -->
          <div class="space-y-2 mt-4">
            <div class="flex items-center gap-3">
              <input
                type="checkbox"
                class="toggle toggle-primary"
                v-model="form.cursorEnabled"
              />
              <span class="font-medium">Cursor</span>
            </div>
            <div class="form-control">
              <input
                type="text"
                class="input input-bordered w-full"
                placeholder="Log directory path"
                v-model="form.cursorPath"
                :disabled="!form.cursorEnabled"
              />
              <label class="label" v-if="pathValidation['cursor']">
                <span
                  class="label-text-alt"
                  :class="pathValidation['cursor'].valid ? 'text-success' : 'text-error'"
                >
                  {{ pathValidation['cursor'].message }}
                </span>
              </label>
            </div>
          </div>

          <div class="card-actions justify-end mt-4">
            <button
              class="btn btn-primary"
              :disabled="saving"
              @click="handleSaveAgent"
            >
              <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
              Save Agent Settings
            </button>
          </div>
        </div>
      </div>

      <!-- Data Management Section -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">
            <Database class="w-5 h-5" />
            Data Management
          </h2>
          <div class="divider mt-0"></div>

          <!-- Stats summary -->
          <div v-if="dbStats" class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div class="stat bg-base-300 rounded-lg p-3">
              <div class="stat-title text-xs">Conversations</div>
              <div class="stat-value text-lg">{{ dbStats.total.conversations }}</div>
            </div>
            <div class="stat bg-base-300 rounded-lg p-3">
              <div class="stat-title text-xs">Messages</div>
              <div class="stat-value text-lg">{{ dbStats.total.messages }}</div>
            </div>
            <div class="stat bg-base-300 rounded-lg p-3">
              <div class="stat-title text-xs">Tool Calls</div>
              <div class="stat-value text-lg">{{ dbStats.total.toolCalls }}</div>
            </div>
            <div class="stat bg-base-300 rounded-lg p-3">
              <div class="stat-title text-xs">Plans</div>
              <div class="stat-value text-lg">{{ dbStats.total.plans }}</div>
            </div>
          </div>

          <div v-if="dbStats && Object.keys(dbStats.byAgent).length > 0" class="flex flex-wrap gap-3 text-sm opacity-70 mt-1">
            <span v-for="(count, agent) in dbStats.byAgent" :key="agent">
              {{ agent === 'claude-code' ? 'Claude Code' : agent === 'cursor' ? 'Cursor' : agent }}: {{ count }} conversations
            </span>
          </div>

          <!-- Danger Zone -->
          <div class="border border-error rounded-lg p-4 mt-4 space-y-3">
            <h3 class="text-sm font-semibold text-error">Danger Zone</h3>

            <div class="flex flex-wrap gap-2">
              <button
                class="btn btn-sm"
                :class="confirmAction === 'clear-all' ? 'btn-error' : 'btn-error btn-outline'"
                :disabled="clearing"
                @click="handleConfirmAction('clear-all', () => clearDatabase())"
              >
                <span v-if="clearing" class="loading loading-spinner loading-xs"></span>
                <Trash2 v-else class="w-4 h-4" />
                {{ confirmAction === 'clear-all' ? 'Confirm Clear All?' : 'Clear All Data' }}
              </button>

              <button
                class="btn btn-sm"
                :class="confirmAction === 'refresh-all' ? 'btn-warning' : 'btn-warning btn-outline'"
                :disabled="clearing"
                @click="handleConfirmAction('refresh-all', () => refreshDatabase())"
              >
                <span v-if="clearing" class="loading loading-spinner loading-xs"></span>
                <RotateCcw v-else class="w-4 h-4" />
                {{ confirmAction === 'refresh-all' ? 'Confirm Refresh All?' : 'Refresh All Data' }}
              </button>
            </div>
          </div>

          <!-- Per-Agent Actions -->
          <div v-if="dbStats && Object.keys(dbStats.byAgent).length > 0" class="mt-4 space-y-2">
            <h3 class="text-sm font-semibold">Per-Agent Actions</h3>
            <div
              v-for="(count, agent) in dbStats.byAgent"
              :key="agent"
              class="flex items-center justify-between bg-base-300 rounded-lg px-4 py-2"
            >
              <span class="text-sm">
                {{ agent === 'claude-code' ? 'Claude Code' : agent === 'cursor' ? 'Cursor' : agent }}
                <span class="opacity-60">-- {{ count }} conversations</span>
              </span>
              <div class="flex gap-1">
                <button
                  class="btn btn-ghost btn-xs"
                  :disabled="clearing"
                  @click="refreshDatabase(agent as string)"
                >
                  <RotateCcw class="w-3 h-3" />
                  Refresh
                </button>
                <button
                  class="btn btn-ghost btn-xs text-error"
                  :class="confirmAction === `clear-${agent}` ? 'btn-active' : ''"
                  :disabled="clearing"
                  @click="handleConfirmAction(`clear-${agent}`, () => clearDatabase(agent as string))"
                >
                  <Trash2 class="w-3 h-3" />
                  {{ confirmAction === `clear-${agent}` ? 'Confirm?' : 'Clear' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Result feedback -->
          <div
            v-if="dataActionResult"
            class="alert mt-4"
            :class="dataActionResult.success ? 'alert-success' : 'alert-error'"
          >
            <span>{{ dataActionResult.message }}</span>
          </div>
        </div>
      </div>

      <!-- Remote Sync Section -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">
            <Wifi class="w-5 h-5" />
            Remote Sync
          </h2>
          <div class="divider mt-0"></div>

          <!-- Master toggle -->
          <div class="flex items-center gap-3">
            <input
              type="checkbox"
              class="toggle toggle-primary"
              v-model="form.syncEnabled"
            />
            <span class="font-medium">Enable Remote Sync</span>
          </div>

          <!-- URL + Test Connection -->
          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">Sync Endpoint URL</span>
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                class="input input-bordered flex-1"
                placeholder="https://your-server.com/api/sync"
                v-model="form.syncUrl"
                :disabled="!form.syncEnabled"
              />
              <button
                class="btn btn-sm btn-outline self-center"
                :disabled="!form.syncEnabled || !form.syncUrl"
                @click="handleTestConnection"
              >
                Test Connection
              </button>
            </div>
            <label class="label" v-if="testResult">
              <span
                class="label-text-alt flex items-center gap-1"
                :class="testResult.success ? 'text-success' : 'text-error'"
              >
                <Check v-if="testResult.success" class="w-3 h-3" />
                <X v-else class="w-3 h-3" />
                {{ testResult.success ? `Connection successful (${testResult.status})` : `Connection failed: ${testResult.error || 'Unknown error'}` }}
              </span>
            </label>
          </div>

          <!-- Frequency -->
          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">Sync Frequency</span>
            </label>
            <select
              class="select select-bordered"
              v-model.number="form.syncFrequency"
              :disabled="!form.syncEnabled"
            >
              <option :value="300">Every 5 minutes</option>
              <option :value="900">Every 15 minutes</option>
              <option :value="3600">Every hour</option>
            </select>
          </div>

          <!-- Data categories -->
          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">Data Categories</span>
            </label>
            <div class="flex flex-wrap gap-4">
              <label
                v-for="cat in allCategories"
                :key="cat.value"
                class="flex items-center gap-2 cursor-pointer"
                :class="{ 'opacity-40': !form.syncEnabled }"
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                  :value="cat.value"
                  v-model="form.syncCategories"
                  :disabled="!form.syncEnabled"
                />
                <span class="label-text">{{ cat.label }}</span>
              </label>
            </div>
          </div>

          <!-- Sync Now -->
          <div class="mt-4">
            <button
              class="btn btn-sm btn-ghost"
              :disabled="!form.syncEnabled || !form.syncUrl"
              @click="handleSyncNow"
            >
              <RefreshCw class="w-4 h-4" />
              Sync Now
            </button>
            <span
              v-if="syncNowResult"
              class="text-sm ml-2 opacity-60"
            >
              {{ syncNowResult.message }}
            </span>
          </div>

          <!-- Sync status -->
          <div
            v-if="settings.lastSyncAt"
            class="text-sm opacity-60 mt-4 space-y-1"
          >
            <div class="flex items-center gap-1">
              <span>Last sync: {{ formatRelativeTime(settings.lastSyncAt) }}</span>
              <Check v-if="settings.lastSyncSuccess" class="w-3 h-3 text-success" />
            </div>
            <div v-if="settings.lastSyncError" class="text-error">
              Error: {{ settings.lastSyncError }}
            </div>
            <div>Next sync: ~{{ frequencyLabel(settings.syncFrequency) }}</div>
          </div>

          <div class="card-actions justify-end mt-4">
            <button
              class="btn btn-primary"
              :disabled="saving"
              @click="handleSaveSync"
            >
              <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
              Save Sync Settings
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSettings } from '../composables/useSettings';
import {
  Bot,
  Wifi,
  RefreshCw,
  Check,
  X,
  Loader2,
  Database,
  Trash2,
  RotateCcw,
} from 'lucide-vue-next';

const {
  settings,
  loading,
  saving,
  pathValidation,
  testResult,
  syncNowResult,
  dbStats,
  clearing,
  dataActionResult,
  saveAgentSettings,
  saveSyncSettings,
  validatePath,
  testConnection,
  triggerSyncNow,
  clearDatabase,
  refreshDatabase,
} = useSettings();

// Data management confirmation state
const confirmAction = ref<string | null>(null);
const confirmTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

function handleConfirmAction(actionKey: string, action: () => void) {
  if (confirmAction.value === actionKey) {
    confirmAction.value = null;
    if (confirmTimeout.value) clearTimeout(confirmTimeout.value);
    action();
  } else {
    confirmAction.value = actionKey;
    if (confirmTimeout.value) clearTimeout(confirmTimeout.value);
    confirmTimeout.value = setTimeout(() => { confirmAction.value = null; }, 3000);
  }
}

// Auto-dismiss data action result after 5 seconds
watch(dataActionResult, (val) => {
  if (val) setTimeout(() => { dataActionResult.value = null; }, 5000);
});

// Local form state
const form = ref({
  claudeCodePath: '',
  claudeCodeEnabled: true,
  cursorPath: '',
  cursorEnabled: false,
  syncEnabled: false,
  syncUrl: '',
  syncFrequency: 300,
  syncCategories: [] as string[],
});

const allCategories = [
  { value: 'conversations', label: 'Conversations' },
  { value: 'messages', label: 'Messages' },
  { value: 'toolCalls', label: 'Tool Calls' },
  { value: 'tokenUsage', label: 'Token Usage' },
  { value: 'plans', label: 'Plans' },
];

// Populate form when settings are loaded
watch(settings, (val) => {
  if (val) {
    form.value = {
      claudeCodePath: val.claudeCodePath,
      claudeCodeEnabled: val.claudeCodeEnabled,
      cursorPath: val.cursorPath,
      cursorEnabled: val.cursorEnabled,
      syncEnabled: val.syncEnabled,
      syncUrl: val.syncUrl,
      syncFrequency: val.syncFrequency,
      syncCategories: [...val.syncCategories],
    };
  }
});

// Debounced path validation
let claudeCodeDebounce: ReturnType<typeof setTimeout> | null = null;
let cursorDebounce: ReturnType<typeof setTimeout> | null = null;

watch(() => form.value.claudeCodePath, (val) => {
  if (claudeCodeDebounce) clearTimeout(claudeCodeDebounce);
  if (!val || !form.value.claudeCodeEnabled) return;
  claudeCodeDebounce = setTimeout(() => {
    validatePath(val, 'claude-code');
  }, 500);
});

watch(() => form.value.cursorPath, (val) => {
  if (cursorDebounce) clearTimeout(cursorDebounce);
  if (!val || !form.value.cursorEnabled) return;
  cursorDebounce = setTimeout(() => {
    validatePath(val, 'cursor');
  }, 500);
});

// Handlers
function handleSaveAgent() {
  saveAgentSettings({
    claudeCodePath: form.value.claudeCodePath,
    claudeCodeEnabled: form.value.claudeCodeEnabled,
    cursorPath: form.value.cursorPath,
    cursorEnabled: form.value.cursorEnabled,
  });
}

function handleSaveSync() {
  saveSyncSettings({
    syncEnabled: form.value.syncEnabled,
    syncUrl: form.value.syncUrl,
    syncFrequency: form.value.syncFrequency,
    syncCategories: form.value.syncCategories,
  });
}

function handleTestConnection() {
  testConnection(form.value.syncUrl);
}

function handleSyncNow() {
  triggerSyncNow();
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function frequencyLabel(seconds: number): string {
  if (seconds <= 300) return 'every 5 minutes';
  if (seconds <= 900) return 'every 15 minutes';
  return 'every hour';
}
</script>
