/**
 * Shared title derivation utilities for normalizers.
 *
 * Provides unified skip logic so both Claude Code and Cursor normalizers
 * apply the same rules when choosing a conversation title.
 */

/**
 * Determine whether a user message should be skipped when deriving a title.
 *
 * Skip order (first match wins):
 * 1. Empty or whitespace-only
 * 2. Slash commands (starts with "/")
 * 3. System caveats (starts with "Caveat:")
 * 4. Interrupted requests (starts with "[Request interrupted")
 * 5. XML/system messages (starts with "<")
 */
export function shouldSkipForTitle(content: string): boolean {
  const trimmed = content.trim();

  // Empty / whitespace
  if (trimmed.length === 0) return true;

  // Slash commands
  if (trimmed.startsWith('/')) return true;

  // System caveats
  if (trimmed.startsWith('Caveat:')) return true;

  // Interrupted requests
  if (trimmed.startsWith('[Request interrupted')) return true;

  // XML / system messages
  if (trimmed.startsWith('<')) return true;

  return false;
}

function stripXmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.substring(0, maxLen) : text;
}

/**
 * Derive a conversation title from user messages with an optional assistant-text fallback.
 *
 * Fallback chain:
 * 1. First non-skippable user message content (truncated to 100 chars)
 * 2. First XML-stripped user message with >10 chars of cleaned text
 * 3. First non-null assistant text snippet (truncated to 100 chars)
 * 4. null
 */
export function deriveConversationTitle(
  userMessages: Array<{ content: string | null }>,
  assistantTextSnippets?: Array<string | null>,
): string | null {
  // First pass: find first non-skippable user message
  for (const msg of userMessages) {
    if (msg.content && msg.content.trim().length > 0) {
      if (shouldSkipForTitle(msg.content)) continue;
      return truncate(msg.content, 100);
    }
  }

  // Second pass: XML fallback -- strip tags from XML messages and use first with >10 chars
  for (const msg of userMessages) {
    if (msg.content && msg.content.trim().startsWith('<')) {
      const stripped = stripXmlTags(msg.content);
      if (stripped.length > 10) {
        return truncate(stripped, 100);
      }
    }
  }

  // Third pass: assistant text fallback
  if (assistantTextSnippets) {
    for (const snippet of assistantTextSnippets) {
      if (snippet && snippet.trim().length > 0) {
        return truncate(snippet, 100);
      }
    }
  }

  return null;
}
