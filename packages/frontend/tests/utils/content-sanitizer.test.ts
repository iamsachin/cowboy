import { describe, it, expect } from 'vitest';
import {
  isSystemInjected,
  isSlashCommand,
  stripXmlTags,
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
