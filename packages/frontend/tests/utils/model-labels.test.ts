import { describe, it, expect } from 'vitest';
import { getModelBadge } from '../../src/utils/model-labels';

describe('getModelBadge', () => {
  it('returns Sonnet label for claude-3-5-sonnet model string', () => {
    const result = getModelBadge('claude-3-5-sonnet-20241022');
    expect(result.label).toBe('Sonnet');
    expect(result.cssClass).toBe('badge-model-sonnet');
  });

  it('returns Opus label for claude-3-opus model string', () => {
    const result = getModelBadge('claude-3-opus-20240229');
    expect(result.label).toBe('Opus');
    expect(result.cssClass).toBe('badge-model-opus');
  });

  it('returns Haiku label for claude-3-haiku model string', () => {
    const result = getModelBadge('claude-3-haiku-20240307');
    expect(result.label).toBe('Haiku');
    expect(result.cssClass).toBe('badge-model-haiku');
  });

  it('returns GPT-4o label (matched before gpt-4)', () => {
    const result = getModelBadge('gpt-4o-2024-08-06');
    expect(result.label).toBe('GPT-4o');
    expect(result.cssClass).toBe('badge-model-gpt4o');
  });

  it('returns GPT-4 label for gpt-4-turbo', () => {
    const result = getModelBadge('gpt-4-turbo');
    expect(result.label).toBe('GPT-4');
    expect(result.cssClass).toBe('badge-model-gpt4');
  });

  it('returns empty label with ghost class for null', () => {
    const result = getModelBadge(null);
    expect(result.label).toBe('');
    expect(result.cssClass).toBe('badge-ghost');
  });

  it('returns raw string with ghost class for unknown model', () => {
    const result = getModelBadge('unknown-model-v2');
    expect(result.label).toBe('unknown-model-v2');
    expect(result.cssClass).toBe('badge-ghost');
  });

  it('returns Gemini label for gemini model string', () => {
    const result = getModelBadge('gemini-1.5-pro');
    expect(result.label).toBe('Gemini');
    expect(result.cssClass).toBe('badge-model-gemini');
  });
});
