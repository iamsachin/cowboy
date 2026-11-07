import { describe, it, expect } from 'vitest';
import { parseFrontmatter, linkWikilinks, resolveMemoryLink, projectLabel } from '../../src/utils/memory';

const files = [
  { name: 'MEMORY.md', content: '- [Ask](feedback_ask.md)' },
  { name: 'feedback_ask.md', content: '---\nname: ask-interactively\nmetadata:\n  type: feedback\n---\nBody [[MEMORY]]' },
];

describe('memory utils', () => {
  it('parses and flattens frontmatter', () => {
    const { meta, body } = parseFrontmatter(files[1].content);
    expect(meta).toEqual([['name', 'ask-interactively'], ['type', 'feedback']]);
    expect(body).toBe('Body [[MEMORY]]');
  });

  it('leaves content without frontmatter alone', () => {
    expect(parseFrontmatter('hi')).toEqual({ meta: [], body: 'hi' });
  });

  it('converts wikilinks to markdown links', () => {
    expect(linkWikilinks('see [[my note]]')).toBe('see [my note](my%20note)');
  });

  it('resolves by filename, stem, and frontmatter name', () => {
    expect(resolveMemoryLink('feedback_ask.md', files)?.name).toBe('feedback_ask.md');
    expect(resolveMemoryLink('MEMORY', files)?.name).toBe('MEMORY.md');
    expect(resolveMemoryLink('ask-interactively', files)?.name).toBe('feedback_ask.md');
    expect(resolveMemoryLink('nope', files)).toBeUndefined();
  });

  it('strips the home prefix from project dirs', () => {
    expect(projectLabel('-Users-me-Desktop-learn-cowboy')).toBe('Desktop-learn-cowboy');
    expect(projectLabel('-tmp-x')).toBe('-tmp-x');
  });
});
