import { describe, it, expect } from 'vitest';
import {
  isSystemInjected,
  isSlashCommand,
  stripXmlTags,
  extractCommandParts,
  highlightSlashCommands,
} from '../../src/utils/content-sanitizer';

describe('isSystemInjected', () => {
  // CONV-08: null/empty content should NOT be classified as system-injected
  it('returns false for null content', () => {
    expect(isSystemInjected(null)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSystemInjected('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(isSystemInjected('   ')).toBe(false);
  });

  // CONV-05: skill prompt detection
  it('returns true for skill prompt with "Base directory for this skill:" prefix', () => {
    expect(
      isSystemInjected('Base directory for this skill: /path/to/skill\nMore instructions...')
    ).toBe(true);
  });

  // Normal user messages should NOT be system-injected
  it('returns false for normal user message', () => {
    expect(isSystemInjected('Hello, how are you?')).toBe(false);
  });

  // Existing behavior: system-reminder XML
  it('returns true for system-reminder XML content', () => {
    expect(
      isSystemInjected('<system-reminder>Remember to follow the rules.</system-reminder>')
    ).toBe(true);
  });

  // Existing behavior: slash commands are NOT system-injected
  it('returns false for slash command content', () => {
    expect(
      isSystemInjected('<command-name>/gsd:execute-phase</command-name><command-args>11</command-args>')
    ).toBe(false);
  });

  // Existing behavior: objective XML
  it('returns true for objective XML content', () => {
    expect(isSystemInjected('<objective>Complete the task</objective>')).toBe(true);
  });

  // Existing behavior: image attachments are user actions
  it('returns false for image attachment content', () => {
    expect(isSystemInjected('[Image: source: screenshot.png]')).toBe(false);
  });
});

describe('extractCommandParts', () => {
  it('extracts command and args from XML slash command with args', () => {
    const result = extractCommandParts(
      '<command-name>/gsd:quick</command-name><command-args>How are plans extracted?</command-args>'
    );
    expect(result).toEqual({ command: '/gsd:quick', args: 'How are plans extracted?' });
  });

  it('extracts command with empty args from XML slash command without args', () => {
    const result = extractCommandParts(
      '<command-name>/clear</command-name><command-args>clear</command-args>'
    );
    expect(result).toEqual({ command: '/clear', args: 'clear' });
  });

  it('returns null for non-slash-command content', () => {
    expect(extractCommandParts('Hello, how are you?')).toBeNull();
  });
});

describe('highlightSlashCommands', () => {
  it('highlights /command in middle of text', () => {
    const result = highlightSlashCommands('Use /research skill');
    expect(result).toContain('<span class="text-info font-mono font-semibold">/research</span>');
    expect(result).toContain('Use ');
    expect(result).toContain(' skill');
  });

  it('highlights multiple commands in text', () => {
    const result = highlightSlashCommands('Run /gsd:plan-phase and /commit');
    expect(result).toContain('<span class="text-info font-mono font-semibold">/gsd:plan-phase</span>');
    expect(result).toContain('<span class="text-info font-mono font-semibold">/commit</span>');
  });

  it('returns unchanged text when no commands present', () => {
    expect(highlightSlashCommands('No commands here')).toBe('No commands here');
  });

  it('does not highlight /path in URLs', () => {
    const result = highlightSlashCommands('Visit https://example.com/path');
    expect(result).not.toContain('<span');
  });

  it('highlights command at start of string', () => {
    const result = highlightSlashCommands('/research do some work');
    expect(result).toContain('<span class="text-info font-mono font-semibold">/research</span>');
  });
});
