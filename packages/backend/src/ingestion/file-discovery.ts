import { readdir, stat, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import type { DiscoveredFile } from './types.js';

const DEFAULT_BASE_DIR = join(homedir(), '.claude', 'projects');

/**
 * Recursively discover all .jsonl files under a base directory.
 * Each top-level subdirectory is treated as a project directory.
 * Files under /subagents/ paths are flagged accordingly.
 *
 * @param baseDir - Directory to scan (defaults to ~/.claude/projects/)
 * @returns Array of discovered JSONL files with metadata
 */
export async function discoverJsonlFiles(
  baseDir: string = DEFAULT_BASE_DIR,
): Promise<DiscoveredFile[]> {
  const files: DiscoveredFile[] = [];

  let projectDirs: string[];
  try {
    projectDirs = await readdir(baseDir);
  } catch {
    return files;
  }

  for (const projectDir of projectDirs) {
    const projectPath = join(baseDir, projectDir);

    let dirStat;
    try {
      dirStat = await stat(projectPath);
    } catch {
      continue;
    }

    if (!dirStat.isDirectory()) continue;

    // Recursively find all .jsonl files within this project directory
    let entries: string[];
    try {
      entries = await readdir(projectPath, { recursive: true }) as string[];
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.endsWith('.jsonl')) continue;

      const fullPath = join(projectPath, entry);
      const filename = basename(entry, '.jsonl');
      const isSubagent = entry.includes('subagents/') || entry.includes('subagents\\');

      // Strip "agent-" prefix for subagent files to get the session/agent ID
      const sessionId = isSubagent
        ? filename.replace(/^agent-/, '')
        : filename;

      files.push({
        filePath: fullPath,
        projectDir,
        isSubagent,
        sessionId,
      });
    }
  }

  return files;
}

/**
 * Derive a human-readable project name from a Claude Code directory name.
 *
 * Claude Code encodes absolute paths by replacing "/" with "-".
 * For example: /Users/sachin/Desktop/learn/cowboy -> -Users-sachin-Desktop-learn-cowboy
 *
 * Strategy:
 * 1. If the directory has sessions-index.json with originalPath, use path.basename of that
 * 2. If dirName starts with "-" (encoded absolute path), take the last segment
 * 3. Otherwise return dirName as-is (already a meaningful name)
 *
 * Note: This heuristic may be imperfect for hyphenated directory names.
 * Phase 9 adds user override for project name configuration.
 */
export function deriveProjectName(dirName: string): string {
  if (!dirName.startsWith('-')) {
    return dirName;
  }

  // Encoded absolute path: split on "-", filter empty, return last segment
  const segments = dirName.split('-').filter(Boolean);
  return segments[segments.length - 1] || dirName;
}

/**
 * Attempt to read sessions-index.json for a more accurate project name.
 * Falls back to the heuristic-based deriveProjectName if not available.
 */
export async function deriveProjectNameFromDir(
  baseDir: string,
  dirName: string,
): Promise<string> {
  try {
    const indexPath = join(baseDir, dirName, 'sessions-index.json');
    const content = await readFile(indexPath, 'utf-8');
    const index = JSON.parse(content);
    if (index.originalPath && typeof index.originalPath === 'string') {
      return basename(index.originalPath);
    }
  } catch {
    // sessions-index.json not available or invalid
  }

  return deriveProjectName(dirName);
}
