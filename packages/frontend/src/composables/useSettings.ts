import { ref, onMounted } from 'vue';

export interface SettingsResponse {
  id: number;
  claudeCodePath: string;
  claudeCodeEnabled: boolean;
  cursorPath: string;
  cursorEnabled: boolean;
  syncEnabled: boolean;
  syncUrl: string;
  syncFrequency: number;
  syncCategories: string[];
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastSyncSuccess: boolean | null;
  syncCursor: string | null;
  serverPort: number;
}

export interface PathValidationResult {
  valid: boolean;
  fileCount: number;
  message: string;
}

export interface TestSyncResult {
  success: boolean;
  status?: number;
  error?: string;
}

export interface SyncNowResult {
  message: string;
}

export interface DbStats {
  total: {
    conversations: number;
    messages: number;
    toolCalls: number;
    tokenUsage: number;
    plans: number;
  };
  byAgent: Record<string, number>;
}

export interface DataActionResult {
  success: boolean;
  message: string;
}

export function useSettings() {
  const settings = ref<SettingsResponse | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const pathValidation = ref<Record<string, PathValidationResult>>({});
  const testResult = ref<TestSyncResult | null>(null);
  const syncNowResult = ref<SyncNowResult | null>(null);

  // Data management state
  const dbStats = ref<DbStats | null>(null);
  const clearing = ref(false);
  const dataActionResult = ref<DataActionResult | null>(null);

  async function fetchDbStats(): Promise<void> {
    try {
      const res = await fetch('/api/settings/db-stats');
      if (!res.ok) throw new Error(`DB stats fetch failed: ${res.status}`);
      dbStats.value = await res.json();
    } catch (e) {
      console.error('Failed to fetch db stats:', e);
    }
  }

  async function fetchSettings(): Promise<void> {
    loading.value = true;
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error(`Settings fetch failed: ${res.status}`);
      settings.value = await res.json();
      // Load db stats after settings
      await fetchDbStats();
    } catch (e) {
      console.error('Failed to fetch settings:', e);
    } finally {
      loading.value = false;
    }
  }

  async function clearDatabase(agent?: string): Promise<boolean> {
    clearing.value = true;
    dataActionResult.value = null;
    try {
      const url = agent ? `/api/settings/clear-db?agent=${encodeURIComponent(agent)}` : '/api/settings/clear-db';
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Clear database failed: ${res.status}`);
      dataActionResult.value = {
        success: true,
        message: agent ? `Cleared all ${agent} data` : 'Cleared all data',
      };
      await fetchDbStats();
      return true;
    } catch (e) {
      console.error('Failed to clear database:', e);
      dataActionResult.value = {
        success: false,
        message: `Failed to clear database: ${(e as Error).message}`,
      };
      return false;
    } finally {
      clearing.value = false;
    }
  }

  async function refreshDatabase(agent?: string): Promise<boolean> {
    clearing.value = true;
    dataActionResult.value = null;
    try {
      const url = agent ? `/api/settings/refresh-db?agent=${encodeURIComponent(agent)}` : '/api/settings/refresh-db';
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) throw new Error(`Refresh database failed: ${res.status}`);
      dataActionResult.value = {
        success: true,
        message: agent ? `Refreshing ${agent} data...` : 'Refreshing all data...',
      };
      await fetchDbStats();
      return true;
    } catch (e) {
      console.error('Failed to refresh database:', e);
      dataActionResult.value = {
        success: false,
        message: `Failed to refresh database: ${(e as Error).message}`,
      };
      return false;
    } finally {
      clearing.value = false;
    }
  }

  async function saveAgentSettings(data: {
    claudeCodePath: string;
    claudeCodeEnabled: boolean;
    cursorPath: string;
    cursorEnabled: boolean;
  }): Promise<boolean> {
    saving.value = true;
    try {
      const res = await fetch('/api/settings/agent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Save agent settings failed: ${res.status}`);
      settings.value = await res.json();
      return true;
    } catch (e) {
      console.error('Failed to save agent settings:', e);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function saveSyncSettings(data: {
    syncEnabled: boolean;
    syncUrl: string;
    syncFrequency: number;
    syncCategories: string[];
  }): Promise<boolean> {
    saving.value = true;
    try {
      const res = await fetch('/api/settings/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Save sync settings failed: ${res.status}`);
      settings.value = await res.json();
      return true;
    } catch (e) {
      console.error('Failed to save sync settings:', e);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function savePortSettings(data: { serverPort: number }): Promise<boolean> {
    saving.value = true;
    try {
      const res = await fetch('/api/settings/port', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Save port settings failed: ${res.status}`);
      settings.value = await res.json();
      return true;
    } catch (e) {
      console.error('Failed to save port settings:', e);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function validatePath(path: string, agent: string): Promise<void> {
    try {
      const res = await fetch('/api/settings/validate-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, agent }),
      });
      if (!res.ok) throw new Error(`Path validation failed: ${res.status}`);
      pathValidation.value[agent] = await res.json();
    } catch (e) {
      console.error('Failed to validate path:', e);
      pathValidation.value[agent] = { valid: false, fileCount: 0, message: 'Validation request failed' };
    }
  }

  async function testConnection(url: string): Promise<void> {
    testResult.value = null;
    try {
      const res = await fetch('/api/settings/test-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(`Test connection failed: ${res.status}`);
      testResult.value = await res.json();
    } catch (e) {
      console.error('Failed to test connection:', e);
      testResult.value = { success: false, error: (e as Error).message };
    }
  }

  async function triggerSyncNow(): Promise<void> {
    syncNowResult.value = null;
    try {
      const res = await fetch('/api/settings/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Sync now failed: ${res.status}`);
      syncNowResult.value = await res.json();
    } catch (e) {
      console.error('Failed to trigger sync:', e);
      syncNowResult.value = { message: (e as Error).message };
    }
  }

  onMounted(() => {
    fetchSettings();
  });

  return {
    settings,
    loading,
    saving,
    pathValidation,
    testResult,
    syncNowResult,
    dbStats,
    clearing,
    dataActionResult,
    fetchSettings,
    saveAgentSettings,
    saveSyncSettings,
    savePortSettings,
    validatePath,
    testConnection,
    triggerSyncNow,
    fetchDbStats,
    clearDatabase,
    refreshDatabase,
  };
}
