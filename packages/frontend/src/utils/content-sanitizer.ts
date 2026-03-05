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
 * Detect if a user message is a slash command (e.g. /clear, /gsd:execute-phase 11).
 *
 * These contain `<command-name>/something</command-name>` in raw content.
 */
export function isSlashCommand(content: string | null): boolean {
  if (!content) return false;
  return /<command-name>/.test(content);
}

/**
 * Extract clean command text from a slash command message.
 *
 * Raw: `<command-name>/gsd:execute-phase</command-name><command-args>11</command-args>`
 * Returns: `/gsd:execute-phase 11`
 */
export function extractCommandText(content: string): string {
  const nameMatch = content.match(/<command-name>(.*?)<\/command-name>/);
  const argsMatch = content.match(/<command-args>(.*?)<\/command-args>/s);

  const name = nameMatch?.[1]?.trim() || '';
  const args = argsMatch?.[1]?.trim() || '';

  return args ? `${name} ${args}` : name;
}

/**
 * Detect if a "user" message is actually system-injected content.
 *
 * Claude Code injects messages with role='user' that contain system prompts,
 * command metadata, and reminders wrapped in XML tags. These should be hidden
 * from the conversation view since the user didn't type them.
 *
 * Slash commands (/clear, /gsd:*) are NOT system-injected — they are user actions.
 */
export function isSystemInjected(content: string | null): boolean {
  if (!content) return true;
  const trimmed = content.trim();
  if (!trimmed) return true;

  // Slash commands are user actions, not system-injected
  if (isSlashCommand(trimmed)) return false;

  // Image attachments are user actions
  if (/\[Image: source:/.test(trimmed)) return false;

  // Messages that start with XML-tagged system content
  if (/^<(system-reminder|local-command|antml:)/.test(trimmed)) return true;

  // Skill/command expanded prompts — contain structured XML sections
  if (/<(objective|execution_context|context|process|success_criteria|files_to_read)>/.test(trimmed)) return true;

  // After stripping tags, if nothing meaningful remains, it's system content
  const cleaned = stripXmlTags(trimmed);
  if (!cleaned || !cleaned.trim()) return true;

  return false;
}

/**
 * Detect if a user message represents a /clear command.
 */
export function isClearCommand(content: string | null): boolean {
  if (!content) return false;
  if (!isSlashCommand(content)) return false;
  return extractCommandText(content).startsWith('/clear');
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
