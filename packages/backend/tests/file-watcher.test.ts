import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Dynamic import of the file watcher plugin
const { default: fileWatcherPlugin } = await import('../src/plugins/file-watcher.js');

describe('File Watcher Plugin', () => {
  let app: FastifyInstance;
  let tempDir: string;
  let onFilesChanged: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Create a fresh temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cowboy-fw-test-'));
    onFilesChanged = vi.fn().mockResolvedValue(undefined);

    app = Fastify({ logger: false });
    await app.register(fileWatcherPlugin, {
      basePath: tempDir,
      onFilesChanged,
    });
    await app.ready();
  });

  afterAll(async () => {
    // Cleanup happens in each test via app.close()
  });

  it('triggers onFilesChanged when a new .jsonl file is created', async () => {
    const filePath = path.join(tempDir, 'test-session.jsonl');
    fs.writeFileSync(filePath, '{"type":"test"}\n');

    // Wait for debounce (1s) + buffer for chokidar event propagation
    await new Promise((resolve) => setTimeout(resolve, 3000));

    expect(onFilesChanged).toHaveBeenCalledTimes(1);

    await app.close();
    // Cleanup
    try { fs.rmSync(tempDir, { recursive: true }); } catch { /* ok */ }
  }, 10000);

  it('triggers onFilesChanged when an existing .jsonl file is modified', async () => {
    // Create the file first
    const filePath = path.join(tempDir, 'existing.jsonl');
    fs.writeFileSync(filePath, '{"type":"initial"}\n');

    // Wait for chokidar to detect the add (but debounce blocks the first call)
    await new Promise((resolve) => setTimeout(resolve, 2500));
    onFilesChanged.mockClear();

    // Now modify the file
    fs.appendFileSync(filePath, '{"type":"modified"}\n');

    // Wait for debounce + propagation
    await new Promise((resolve) => setTimeout(resolve, 3000));

    expect(onFilesChanged).toHaveBeenCalledTimes(1);

    await app.close();
    try { fs.rmSync(tempDir, { recursive: true }); } catch { /* ok */ }
  }, 10000);

  it('does NOT trigger for non-.jsonl files', async () => {
    const filePath = path.join(tempDir, 'readme.txt');
    fs.writeFileSync(filePath, 'This is not a jsonl file');

    // Wait for debounce + propagation
    await new Promise((resolve) => setTimeout(resolve, 3000));

    expect(onFilesChanged).not.toHaveBeenCalled();

    await app.close();
    try { fs.rmSync(tempDir, { recursive: true }); } catch { /* ok */ }
  }, 10000);

  it('debounces rapid file changes into a single callback', async () => {
    // Create multiple files rapidly
    for (let i = 0; i < 5; i++) {
      const filePath = path.join(tempDir, `rapid-${i}.jsonl`);
      fs.writeFileSync(filePath, `{"index":${i}}\n`);
      // Small delay between writes to ensure events fire
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Wait for debounce (1s after last write) + buffer
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Should have been called exactly once due to global debounce
    expect(onFilesChanged).toHaveBeenCalledTimes(1);

    await app.close();
    try { fs.rmSync(tempDir, { recursive: true }); } catch { /* ok */ }
  }, 10000);
});
