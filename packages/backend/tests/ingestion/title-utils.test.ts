import { describe, it, expect } from 'vitest';
import { shouldSkipForTitle, deriveConversationTitle } from '../../src/ingestion/title-utils.js';

describe('shouldSkipForTitle', () => {
  it('returns true for empty string', () => {
    expect(shouldSkipForTitle('')).toBe(true);
  });

  it('returns true for whitespace-only string', () => {
    expect(shouldSkipForTitle('  ')).toBe(true);
    expect(shouldSkipForTitle('\t\n')).toBe(true);
  });

  it('returns true for slash commands', () => {
    expect(shouldSkipForTitle('/clear')).toBe(true);
    expect(shouldSkipForTitle('/gsd:plan-phase')).toBe(true);
    expect(shouldSkipForTitle('/help')).toBe(true);
  });

  it('returns true for "Caveat:" system caveats', () => {
    expect(shouldSkipForTitle('Caveat: The messages below were sent during a previous conversation.')).toBe(true);
    expect(shouldSkipForTitle('Caveat: Some other caveat text')).toBe(true);
  });

  it('returns true for "[Request interrupted..." messages', () => {
    expect(shouldSkipForTitle('[Request interrupted by user for tool use]')).toBe(true);
    expect(shouldSkipForTitle('[Request interrupted for some other reason]')).toBe(true);
  });

  it('returns true for XML/system messages starting with "<"', () => {
    expect(shouldSkipForTitle('<system-reminder>Today is March 5</system-reminder>')).toBe(true);
    expect(shouldSkipForTitle('<local-command-caveat>Warning text</local-command-caveat>')).toBe(true);
  });

  it('returns false for normal user messages', () => {
    expect(shouldSkipForTitle('How do I configure ESLint?')).toBe(false);
    expect(shouldSkipForTitle('Fix the login bug')).toBe(false);
    expect(shouldSkipForTitle('What is TypeScript?')).toBe(false);
  });
});

describe('deriveConversationTitle', () => {
  it('returns first non-skippable user message', () => {
    const result = deriveConversationTitle([
      { content: '<system-reminder>context</system-reminder>' },
      { content: 'How do I configure ESLint?' },
    ]);
    expect(result).toBe('How do I configure ESLint?');
  });

  it('skips Caveat, interrupted, slash, and picks real message', () => {
    const result = deriveConversationTitle([
      { content: 'Caveat: The messages below were sent during a previous conversation.' },
      { content: '[Request interrupted by user for tool use]' },
      { content: '/clear' },
      { content: 'Fix the login bug' },
    ]);
    expect(result).toBe('Fix the login bug');
  });

  it('truncates long titles to 100 characters', () => {
    const result = deriveConversationTitle([
      { content: 'A'.repeat(200) },
    ]);
    expect(result).toHaveLength(100);
  });

  it('falls back to XML-stripped content when all user messages start with "<"', () => {
    const result = deriveConversationTitle([
      { content: '<local-command-caveat>Warning text about local commands that is long enough</local-command-caveat>' },
    ]);
    expect(result).toBe('Warning text about local commands that is long enough');
  });

  it('uses assistant text snippet when all user messages are skippable and XML fallback fails', () => {
    const result = deriveConversationTitle(
      [
        { content: 'Caveat: The messages below were sent during a previous conversation.' },
        { content: '/gsd:plan-phase' },
      ],
      ['Here is the assistant response text'],
    );
    expect(result).toBe('Here is the assistant response text');
  });

  it('truncates assistant fallback text to 100 chars', () => {
    const result = deriveConversationTitle(
      [{ content: '/clear' }],
      ['B'.repeat(200)],
    );
    expect(result).toHaveLength(100);
  });

  it('skips null assistant snippets and uses first non-null', () => {
    const result = deriveConversationTitle(
      [{ content: '/clear' }],
      [null, null, 'Third assistant text'],
    );
    expect(result).toBe('Third assistant text');
  });

  it('returns null when all user messages skippable and no assistant text', () => {
    const result = deriveConversationTitle(
      [
        { content: 'Caveat: stuff' },
        { content: '/clear' },
      ],
    );
    expect(result).toBeNull();
  });

  it('returns null when all user messages skippable, assistant snippets all null', () => {
    const result = deriveConversationTitle(
      [{ content: '/clear' }],
      [null, null],
    );
    expect(result).toBeNull();
  });

  it('handles null content in user messages', () => {
    const result = deriveConversationTitle([
      { content: null },
      { content: 'Real question' },
    ]);
    expect(result).toBe('Real question');
  });

  it('returns first non-skippable message even when mixed with XML', () => {
    const result = deriveConversationTitle([
      { content: '<system-reminder>Today is March 5 2026</system-reminder>' },
      { content: '<objective>Fix the build pipeline</objective>' },
      { content: 'How do I configure ESLint?' },
    ]);
    expect(result).toBe('How do I configure ESLint?');
  });
});
