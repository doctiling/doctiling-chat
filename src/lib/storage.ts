// Local storage of the chat (data-model.md § chat): the token lives in
// IndexedDB (fallback localStorage), preferences in localStorage. Nothing of
// business (conversations, bases, documents) is ever stored on the device.
// Every access is wrapped: private mode, blocked storage and old browsers must
// never crash the app.

export const TOKEN_KEY = 'doctiling-chat:token';
export const PREFS_KEY = 'doctiling-chat:prefs';

export type StoredToken = {
  token: string;
  expiresAt: number;
  apiOrigin: string;
};

export type Language = 'en' | 'es';

export type Prefs = {
  language?: Language;
  lastKbId?: string;
  iosHintDismissed?: boolean;
};

const DB_NAME = 'doctiling-chat';
const STORE = 'kv';

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null && typeof indexedDB.open === 'function';
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
    req.onblocked = () => reject(new Error('indexedDB blocked'));
  });
}

function idbRequest<T>(run: (store: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'));
        tx.oncomplete = () => db.close();
      }),
  );
}

function localGet<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function localSet(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: the session simply does not survive a reload */
  }
}

function localRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export async function getToken(): Promise<StoredToken | null> {
  if (hasIndexedDb()) {
    try {
      const v = await idbRequest<StoredToken | undefined>((s) => s.get(TOKEN_KEY), 'readonly');
      if (v) return v;
    } catch {
      /* fall through to localStorage */
    }
  }
  return localGet<StoredToken>(TOKEN_KEY);
}

export async function setToken(value: StoredToken): Promise<void> {
  if (hasIndexedDb()) {
    try {
      await idbRequest((s) => s.put(value, TOKEN_KEY), 'readwrite');
      localRemove(TOKEN_KEY);
      return;
    } catch {
      /* fall through */
    }
  }
  localSet(TOKEN_KEY, value);
}

export async function clearToken(): Promise<void> {
  if (hasIndexedDb()) {
    try {
      await idbRequest((s) => s.delete(TOKEN_KEY), 'readwrite');
    } catch {
      /* ignore */
    }
  }
  localRemove(TOKEN_KEY);
}

export function getPrefs(): Prefs {
  return localGet<Prefs>(PREFS_KEY) ?? {};
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch };
  localSet(PREFS_KEY, next);
  return next;
}

/** Sign-out: everything goes except the language (data-model.md). */
export async function clearAll(): Promise<void> {
  const { language } = getPrefs();
  await clearToken();
  localRemove(PREFS_KEY);
  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }
  if (language) localSet(PREFS_KEY, { language });
}
