import { describe, it, expect } from 'vitest';
import { FileText, Terminal, Pencil, FilePlus, Search, FolderSearch, Bot, Globe, Wrench } from 'lucide-vue-next';
import { getToolIcon } from '../../src/utils/tool-icons';

describe('getToolIcon', () => {
  it('returns FileText with sky color for Read', () => {
    const result = getToolIcon('Read');
    expect(result.icon).toBe(FileText);
    expect(result.colorClass).toBe('text-sky-400');
  });

  it('returns Terminal with emerald color for Bash', () => {
    const result = getToolIcon('Bash');
    expect(result.icon).toBe(Terminal);
    expect(result.colorClass).toBe('text-emerald-400');
  });

  it('returns Pencil with amber color for Edit', () => {
    const result = getToolIcon('Edit');
    expect(result.icon).toBe(Pencil);
    expect(result.colorClass).toBe('text-amber-400');
  });

  it('returns FilePlus with teal color for Write', () => {
    const result = getToolIcon('Write');
    expect(result.icon).toBe(FilePlus);
    expect(result.colorClass).toBe('text-teal-400');
  });

  it('returns Search with violet color for Grep', () => {
    const result = getToolIcon('Grep');
    expect(result.icon).toBe(Search);
    expect(result.colorClass).toBe('text-violet-400');
  });

  it('returns FolderSearch with rose color for Glob', () => {
    const result = getToolIcon('Glob');
    expect(result.icon).toBe(FolderSearch);
    expect(result.colorClass).toBe('text-rose-400');
  });

  it('returns Bot with fuchsia color for Agent', () => {
    const result = getToolIcon('Agent');
    expect(result.icon).toBe(Bot);
    expect(result.colorClass).toBe('text-fuchsia-400');
  });

  it('returns Globe with cyan color for WebSearch', () => {
    const result = getToolIcon('WebSearch');
    expect(result.icon).toBe(Globe);
    expect(result.colorClass).toBe('text-cyan-400');
  });

  it('returns Wrench with info color for unknown tools', () => {
    const result = getToolIcon('UnknownTool');
    expect(result.icon).toBe(Wrench);
    expect(result.colorClass).toBe('text-info');
  });

  it('returns fallback for TodoWrite (unknown tool)', () => {
    const result = getToolIcon('TodoWrite');
    expect(result.icon).toBe(Wrench);
    expect(result.colorClass).toBe('text-info');
  });
});
