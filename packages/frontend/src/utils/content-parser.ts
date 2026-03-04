import { stripXmlTags } from './content-sanitizer';

export interface ContentBlock {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

/**
 * Parse raw message content into structured blocks of text and code.
 *
 * Extracts fenced code blocks (```lang ... ```) and wraps surrounding
 * text through stripXmlTags for clean display. Returns an array of
 * ContentBlock objects suitable for rendering.
 */
export function parseContent(raw: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    // Text before the code block
    if (match.index > lastIndex) {
      const text = stripXmlTags(raw.slice(lastIndex, match.index));
      if (text) {
        blocks.push({ type: 'text', content: text });
      }
    }
    blocks.push({
      type: 'code',
      content: match[2],
      language: match[1] || undefined,
    });
    lastIndex = regex.lastIndex;
  }

  // Remaining text after last code block
  if (lastIndex < raw.length) {
    const text = stripXmlTags(raw.slice(lastIndex));
    if (text) {
      blocks.push({ type: 'text', content: text });
    }
  }

  // If no blocks were created, return the whole content as text
  if (blocks.length === 0) {
    const cleaned = stripXmlTags(raw);
    if (cleaned) {
      blocks.push({ type: 'text', content: cleaned });
    }
  }

  return blocks;
}

/**
 * Format an ISO date string to a localized time string (HH:MM).
 */
export function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
