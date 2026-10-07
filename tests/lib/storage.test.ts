import { describe, expect, it, vi } from 'vitest';
import { clearAll, clearToken, getPrefs, getToken, PREFS_KEY, setPrefs, setToken, TOKEN_KEY } from '@/lib/storage';

// T055 — token in IndexedDB with localStorage fallback, prefs in localStorage,
// clearAll keeps only the language, everything in try/catch. [TS-399]
describe('storage (T055, TS-399)', () => {
  it('stores and reads the token through the localStorage fallback when IndexedDB is absent', async () => {
    expect(typeof indexedDB).toBe('undefined');
    await setToken({ token: 'dct_chat_abc', expiresAt: 42, apiOrigin: 'https://s.test' });
    expect(await getToken()).toEqual({ token: 'dct_chat_abc', expiresAt: 42, apiOrigin: 'https://s.test' });
    expect(window.localStorage.getItem(TOKEN_KEY)).toContain('dct_chat_abc');
    await clearToken();
    expect(await getToken()).toBeNull();
  });

  it('prefers IndexedDB when it exists (minimal fake) and removes the localStorage copy', async () => {
    const store = new Map<string, unknown>();
    const req = <T,>(result: T) => {
      const r = { result, error: null, onsuccess: null as null | (() => void), onerror: null as null | (() => void) };
      queueMicrotask(() => r.onsuccess?.());
      return r;
    };
    const objectStore = {
      get: (k: string) => req(store.get(k)),
      put: (v: unknown, k: string) => {
        store.set(k, v);
        return req(undefined);
      },
      delete: (k: string) => {
        store.delete(k);
        return req(undefined);
      },
    };
    const db = {
      objectStoreNames: { contains: () => true },
      createObjectStore: () => objectStore,
      transaction: () => ({ objectStore: () => objectStore, oncomplete: null }),
      close: () => {},
    };
    vi.stubGlobal('indexedDB', {
      open: () => {
        const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null as null | (() => void), onerror: null, onblocked: null };
        queueMicrotask(() => r.onsuccess?.());
        return r;
      },
    });
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: 'stale' }));
    await setToken({ token: 'dct_chat_idb', expiresAt: 1, apiOrigin: 'x' });
    expect(store.get(TOKEN_KEY)).toMatchObject({ token: 'dct_chat_idb' });
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect((await getToken())?.token).toBe('dct_chat_idb');
  });

  it('merges prefs and clearAll keeps only the language', async () => {
    setPrefs({ language: 'es' });
    setPrefs({ lastKbId: 'kb1', iosHintDismissed: true });
    expect(getPrefs()).toEqual({ language: 'es', lastKbId: 'kb1', iosHintDismissed: true });
    await setToken({ token: 't', expiresAt: 1, apiOrigin: 'x' });
    window.sessionStorage.setItem('doctiling-chat:connect:state', 's');
    await clearAll();
    expect(await getToken()).toBeNull();
    expect(getPrefs()).toEqual({ language: 'es' });
    expect(window.sessionStorage.length).toBe(0);
  });

  it('never throws when storage is blocked', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceeded');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(() => setPrefs({ language: 'en' })).not.toThrow();
    expect(getPrefs()).toEqual({});
    await expect(setToken({ token: 't', expiresAt: 1, apiOrigin: 'x' })).resolves.toBeUndefined();
    expect(await getToken()).toBeNull();
    spy.mockRestore();
    vi.restoreAllMocks();
    expect(window.localStorage.getItem(PREFS_KEY)).toBeNull();
  });
});
