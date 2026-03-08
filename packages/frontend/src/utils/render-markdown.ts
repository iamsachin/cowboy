import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for thinking content rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

const ALLOWED_TAGS = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'strong', 'em', 'del',
  'code', 'pre',
  'blockquote',
  'a', 'br', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img',
];

/**
 * Converts markdown text to sanitized HTML.
 * Used for rendering thinking content from Claude conversations.
 */
export function renderMarkdown(text: string): string {
  const html = marked.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(html, { ALLOWED_TAGS });
}
