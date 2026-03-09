/**
 * Check if an element is an editable field (input, textarea, contentEditable).
 * Used to suppress single-key shortcuts when the user is typing.
 */
export function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/** Handler for a keyboard shortcut. Return true to stop further dispatch. */
export type ShortcutHandler = (e: KeyboardEvent) => boolean | void;
