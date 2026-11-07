export interface MemoryFile {
  name: string;
  content: string;
}

export interface ProjectMemory {
  project: string;
  path: string;
  files: MemoryFile[];
}

/** Splits a leading `---` YAML block into flat key/value pairs (nested keys are flattened). */
export function parseFrontmatter(content: string): { meta: [string, string][]; body: string } {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: [], body: content };
  const meta = m[1]
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([\w-]+):\s*(.*)$/))
    .filter((x): x is RegExpMatchArray => !!x && x[2] !== '')
    .map((x) => [x[1], x[2]] as [string, string]);
  return { meta, body: content.slice(m[0].length) };
}

/** Turns `[[name]]` into a markdown link so it renders as a clickable anchor. */
export function linkWikilinks(body: string): string {
  return body.replace(/\[\[([^\]\n]+)\]\]/g, (_, name) => `[${name}](${encodeURI(name)})`);
}

/** Resolves an href (`file.md`, `name`, or a frontmatter `name:`) to a file in the same project. */
export function resolveMemoryLink(href: string, files: MemoryFile[]): MemoryFile | undefined {
  const target = decodeURI(href).replace(/^\.\//, '');
  const stem = target.replace(/\.md$/, '');
  return (
    files.find((f) => f.name === target || f.name === `${stem}.md`) ??
    files.find((f) => parseFrontmatter(f.content).meta.some(([k, v]) => k === 'name' && v === stem))
  );
}

/** `-Users-me-Desktop-app` → `Desktop-app` (Claude encodes the cwd path with dashes). */
export function projectLabel(dir: string): string {
  return dir.replace(/^-(Users|home)-[^-]+-/, '') || dir;
}
