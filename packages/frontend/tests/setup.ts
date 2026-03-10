/**
 * Vitest setup file for the frontend package.
 * Polyfills browser APIs that happy-dom may not fully implement.
 */

// happy-dom v20 provides a localStorage object but without standard methods.
// Polyfill with a Map-backed implementation if getItem is missing.
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.getItem !== 'function') {
  const store = new Map<string, string>();

  const storage = {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    get length(): number {
      return store.size;
    },
    key(index: number): string | null {
      const keys = [...store.keys()];
      return keys[index] ?? null;
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  });
}
