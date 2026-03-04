import { FastifyInstance } from 'fastify';
import { getSettings, updateAgentSettings, updateSyncSettings } from '../db/queries/settings.js';
import { stat, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Expand tilde (~) at the start of a path to the user's home directory.
 * Shell-style tilde expansion is not done automatically by Node.js fs APIs.
 */
function expandTilde(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return join(homedir(), p.slice(1));
  }
  return p;
}

/**
 * Validate an agent log directory path and count relevant files.
 */
async function validateAgentPath(dirPath: string, agent: string): Promise<{
  valid: boolean;
  fileCount: number;
  message: string;
}> {
  try {
    const dirStat = await stat(dirPath);
    if (!dirStat.isDirectory()) {
      return { valid: false, fileCount: 0, message: 'Path is not a directory' };
    }
    if (agent === 'claude-code') {
      const entries = await readdir(dirPath, { recursive: true });
      const jsonlFiles = (entries as string[]).filter(e => e.endsWith('.jsonl'));
      return { valid: true, fileCount: jsonlFiles.length, message: `Path exists: ${jsonlFiles.length} JSONL files found` };
    } else {
      // Cursor: check for state.vscdb
      const entries = await readdir(dirPath);
      const hasDb = (entries as string[]).some(e => e === 'state.vscdb');
      return {
        valid: true,
        fileCount: hasDb ? 1 : 0,
        message: hasDb ? 'Path exists: state.vscdb found' : 'Path exists but no state.vscdb found',
      };
    }
  } catch {
    return { valid: false, fileCount: 0, message: 'Path not found' };
  }
}

export default async function settingsRoutes(app: FastifyInstance) {
  // GET /settings -- return current settings (auto-seeds on first call)
  app.get('/settings', async () => {
    return getSettings();
  });

  // PUT /settings/agent -- update agent configuration
  app.put('/settings/agent', async (request) => {
    const body = request.body as {
      claudeCodePath: string;
      claudeCodeEnabled: boolean;
      cursorPath: string;
      cursorEnabled: boolean;
    };
    // Resolve tilde in paths before saving
    const updated = updateAgentSettings({
      claudeCodePath: expandTilde(body.claudeCodePath),
      claudeCodeEnabled: body.claudeCodeEnabled,
      cursorPath: expandTilde(body.cursorPath),
      cursorEnabled: body.cursorEnabled,
    });
    return updated;
  });

  // PUT /settings/sync -- update sync configuration
  app.put('/settings/sync', async (request) => {
    const body = request.body as {
      syncEnabled: boolean;
      syncUrl: string;
      syncFrequency: number;
      syncCategories: string[];
    };
    const updated = updateSyncSettings(body);
    return updated;
  });

  // POST /settings/validate-path -- check if a path is valid and count files
  app.post('/settings/validate-path', async (request) => {
    const { path: rawPath, agent } = request.body as { path: string; agent: string };
    const resolvedPath = expandTilde(rawPath);
    return validateAgentPath(resolvedPath, agent);
  });

  // POST /settings/test-sync -- test remote endpoint connectivity
  app.post('/settings/test-sync', async (request) => {
    const { url } = request.body as { url: string };
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
        signal: AbortSignal.timeout(10000),
      });
      return { success: response.ok, status: response.status };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // POST /settings/sync-now -- placeholder (Plan 02 will wire to sync scheduler)
  app.post('/settings/sync-now', async () => {
    return { message: 'Sync not configured' };
  });
}
