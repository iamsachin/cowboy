/**
 * Maps file extensions to highlight.js language names.
 * Only includes languages registered in the project's highlight.js setup (12 languages).
 * Returns undefined for unregistered languages (triggers plaintext fallback).
 */

const EXT_MAP: Record<string, string> = {
  // JavaScript
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  // TypeScript
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  // Python
  '.py': 'python',
  // Bash/Shell
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  // JSON
  '.json': 'json',
  // XML/HTML
  '.html': 'xml',
  '.htm': 'xml',
  '.xml': 'xml',
  '.svg': 'xml',
  '.vue': 'xml',
  // CSS
  '.css': 'css',
  '.scss': 'css',
  // Markdown
  '.md': 'markdown',
  '.mdx': 'markdown',
  // YAML
  '.yml': 'yaml',
  '.yaml': 'yaml',
  // Go
  '.go': 'go',
  // Rust
  '.rs': 'rust',
  // SQL
  '.sql': 'sql',
};

const FILENAME_MAP: Record<string, string> = {
  'Makefile': 'bash',
  'Dockerfile': 'bash',
  '.env': 'bash',
  '.gitignore': 'bash',
};

export function getLanguageFromPath(filePath: string): string | undefined {
  const filename = filePath.split('/').pop() || '';

  // Check filename first (handles extensionless files like Makefile)
  if (FILENAME_MAP[filename]) return FILENAME_MAP[filename];

  // Check extension
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return undefined;
  const ext = filename.slice(dotIndex).toLowerCase();
  return EXT_MAP[ext];
}
