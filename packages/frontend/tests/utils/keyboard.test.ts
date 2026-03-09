import { describe, it, expect } from 'vitest';
import { isEditableElement } from '../../src/utils/keyboard';

describe('isEditableElement', () => {
  it('returns true for INPUT elements', () => {
    const el = document.createElement('input');
    expect(isEditableElement(el)).toBe(true);
  });

  it('returns true for TEXTAREA elements', () => {
    const el = document.createElement('textarea');
    expect(isEditableElement(el)).toBe(true);
  });

  it('returns true for contentEditable elements', () => {
    const el = document.createElement('div');
    el.contentEditable = 'true';
    expect(isEditableElement(el)).toBe(true);
  });

  it('returns false for regular DIV elements', () => {
    const el = document.createElement('div');
    expect(isEditableElement(el)).toBe(false);
  });

  it('returns false for BUTTON elements', () => {
    const el = document.createElement('button');
    expect(isEditableElement(el)).toBe(false);
  });

  it('returns false for BODY element', () => {
    expect(isEditableElement(document.body)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isEditableElement(null)).toBe(false);
  });
});
