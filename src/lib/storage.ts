import { useCallback, useEffect, useState } from 'react';

/**
 * localStorage helpers. Storage can be unavailable (private mode, blocked site data, quota),
 * so every access is wrapped and the app must work without it.
 */
const PREFIX = 'mir:'; // namespaced so keys never collide with other apps on localhost

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[storage] could not save "${key}"`, err);
    return false;
  }
}

export function removeKey(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* nothing to clean up */
  }
}

/** useState that persists to localStorage. `validate` guards against stale or hand-edited values. */
export function usePersistentState<T>(key: string, fallback: T, validate?: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(() => {
    const stored = readJson<unknown>(key, fallback);
    return validate && !validate(stored) ? fallback : (stored as T);
  });
  useEffect(() => {
    writeJson(key, value);
  }, [key, value]);
  return [value, useCallback((v: T | ((prev: T) => T)) => setValue(v), [])] as const;
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
