/**
 * In dev mode, Vite proxies /api to the backend.
 * In production (Tauri bundle), there's no proxy — use the full URL.
 */
export const API_BASE = import.meta.env.DEV ? '' : 'http://127.0.0.1:8123';
