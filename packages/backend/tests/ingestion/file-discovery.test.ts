import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  discoverJsonlFiles,
  deriveProjectName,
} from '../../src/ingestion/file-discovery.js';

describe('discoverJsonlFiles', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cowboy-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('finds .jsonl files at the root of project directories', async () => {
    // Create: tempDir/project-a/session-001.jsonl
    const projectDir = join(tempDir, 'project-a');
    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 'session-001.jsonl'), '{"test": true}\n');

    const files = await discoverJsonlFiles(tempDir);
    expect(files).toHaveLength(1);
    expect(files[0].filePath).toContain('session-001.jsonl');
    expect(files[0].projectDir).toBe('project-a');
    expect(files[0].isSubagent).toBe(false);
    expect(files[0].sessionId).toBe('session-001');
  });

  it('finds .jsonl files in nested subagent directories', async () => {
    // Create: tempDir/project-b/session-uuid/subagents/agent-sub1.jsonl
    const subagentDir = join(tempDir, 'project-b', 'session-uuid', 'subagents');
    await mkdir(subagentDir, { recursive: true });
    await writeFile(join(subagentDir, 'agent-sub1.jsonl'), '{"test": true}\n');

    const files = await discoverJsonlFiles(tempDir);
    expect(files).toHaveLength(1);
    expect(files[0].isSubagent).toBe(true);
    expect(files[0].sessionId).toBe('sub1');
  });

  it('sets isSubagent=true only for files under /subagents/ paths', async () => {
    const projectDir = join(tempDir, 'project-c');
    const subagentDir = join(projectDir, 'ses-uuid', 'subagents');
    await mkdir(projectDir, { recursive: true });
    await mkdir(subagentDir, { recursive: true });

    // Root-level session file
    await writeFile(join(projectDir, 'ses-uuid.jsonl'), '{"test": true}\n');
    // Subagent file
    await writeFile(join(subagentDir, 'agent-abc.jsonl'), '{"test": true}\n');

    const files = await discoverJsonlFiles(tempDir);
    expect(files).toHaveLength(2);

    const rootFile = files.find((f) => !f.isSubagent);
    const subFile = files.find((f) => f.isSubagent);

    expect(rootFile).toBeDefined();
    expect(rootFile!.isSubagent).toBe(false);
    expect(rootFile!.sessionId).toBe('ses-uuid');

    expect(subFile).toBeDefined();
    expect(subFile!.isSubagent).toBe(true);
    expect(subFile!.sessionId).toBe('abc');
  });

  it('extracts sessionId from filename (strips .jsonl and agent- prefix)', async () => {
    const projectDir = join(tempDir, 'project-d');
    const subDir = join(projectDir, 'parent-session', 'subagents');
    await mkdir(subDir, { recursive: true });

    // Regular file: sessionId = uuid-123
    await writeFile(join(projectDir, 'uuid-123.jsonl'), '{"t": 1}\n');
    // Subagent file: sessionId = hash456 (strips agent- prefix)
    await writeFile(join(subDir, 'agent-hash456.jsonl'), '{"t": 1}\n');

    const files = await discoverJsonlFiles(tempDir);
    const regular = files.find((f) => !f.isSubagent)!;
    const subagent = files.find((f) => f.isSubagent)!;

    expect(regular.sessionId).toBe('uuid-123');
    expect(subagent.sessionId).toBe('hash456');
  });

  it('extracts projectDir from the parent project directory name', async () => {
    const projectDir = join(tempDir, '-Users-sachin-Desktop-myapp');
    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 'session.jsonl'), '{"t": 1}\n');

    const files = await discoverJsonlFiles(tempDir);
    expect(files[0].projectDir).toBe('-Users-sachin-Desktop-myapp');
  });

  it('ignores non-.jsonl files', async () => {
    const projectDir = join(tempDir, 'project-e');
    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 'readme.txt'), 'hello');
    await writeFile(join(projectDir, 'data.json'), '{}');
    await writeFile(join(projectDir, 'session.jsonl'), '{"t": 1}\n');

    const files = await discoverJsonlFiles(tempDir);
    expect(files).toHaveLength(1);
    expect(files[0].filePath).toContain('session.jsonl');
  });

  it('returns empty array for empty base directory', async () => {
    const files = await discoverJsonlFiles(tempDir);
    expect(files).toEqual([]);
  });

  it('handles non-directory entries in base path gracefully', async () => {
    // Create a file (not directory) inside tempDir
    await writeFile(join(tempDir, 'stray-file.txt'), 'hello');
    const projectDir = join(tempDir, 'project-f');
    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 'session.jsonl'), '{"t": 1}\n');

    const files = await discoverJsonlFiles(tempDir);
    expect(files).toHaveLength(1);
  });
});

describe('deriveProjectName', () => {
  it('extracts last segment from encoded absolute path', () => {
    expect(deriveProjectName('-Users-sachin-Desktop-learn-cowboy')).toBe(
      'cowboy',
    );
  });

  it('extracts last segment from shorter encoded path', () => {
    expect(deriveProjectName('-Users-sachin-Desktop-myapp')).toBe('myapp');
  });

  it('returns literal name when no leading dash (not an encoded path)', () => {
    expect(deriveProjectName('simple-project')).toBe('simple-project');
  });

  it('handles single-segment encoded path', () => {
    expect(deriveProjectName('-Users')).toBe('Users');
  });
});
