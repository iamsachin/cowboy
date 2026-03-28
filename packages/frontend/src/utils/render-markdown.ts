import { marked, Renderer } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';

// Custom renderer with syntax highlighting for code blocks
const renderer = new Renderer();
renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  let highlighted: string;
  if (lang && hljs.getLanguage(lang)) {
    highlighted = hljs.highlight(text, { language: lang }).value;
  } else {
    highlighted = hljs.highlightAuto(text).value;
  }
  return `<pre><code class="hljs">${highlighted}</code></pre>`;
};

// Configure marked for thinking content rendering
marked.setOptions({
  breaks: true,
  gfm: true,
  renderer,
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
  'span',
];

/**
 * Converts markdown text to sanitized HTML.
 * Used for rendering thinking content from Claude conversations.
 */
export function renderMarkdown(text: string): string {
  const html = marked.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ['class'] });
}
