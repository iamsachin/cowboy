/**
 * Content sanitizer utility for stripping raw XML tags from conversation display text.
 *
 * User messages from Claude Code and Cursor often contain XML-structured system prompts,
 * planning contexts, and command metadata that render as unreadable walls of tagged text.
 * These functions strip those tags at render time to produce clean, readable content.
 */

/**
 * Remove XML/HTML-like tags from display text.
 *
 * Strips both opening tags (`<tag-name>`, `<tag-name attr="val">`) and closing tags (`</tag-name>`).
 * Self-closing tags (`<tag />`) are also removed.
 * After stripping, collapses runs of 3+ newlines down to 2 and trims whitespace.
 */
export function stripXmlTags(text: string): string {
  if (!text) return text;

  // Remove all XML-style tags: opening, closing, and self-closing
  const stripped = text.replace(/<\/?[a-zA-Z][a-zA-Z0-9_-]*(?:\s+[^>]*)?\s*\/?>/g, '');

  // Collapse runs of 3+ newlines down to 2
  const collapsed = stripped.replace(/\n{3,}/g, '\n\n');

  return collapsed.trim();
}

/**
 * Clean a conversation title for display.
 *
 * Applies XML tag stripping, handles empty results, and truncates long titles.
 */
export function cleanTitle(title: string): string {
  if (!title) return 'Untitled Conversation';

  const cleaned = stripXmlTags(title);

  if (!cleaned || !cleaned.trim()) {
    return 'Untitled Conversation';
  }

  if (cleaned.length > 200) {
    return cleaned.slice(0, 200) + '...';
  }

  return cleaned;
}
