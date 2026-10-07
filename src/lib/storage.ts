// Local storage of the chat: preferences only (last opened base, iOS hint
// dismissed). There is no token — the studio session cookie is the session —
// and nothing of business (conversations, bases, documents) is ever stored on
// the device. Every access is wrapped: private mode, blocked storage and old
// browsers must never crash the app.

export const PREFS_KEY = 'doctiling-chat:prefs';

export type Prefs = {
  lastKbId?: string;
  iosHintDismissed?: boolean;
};

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
    /* storage blocked: the preference simply does not survive a reload */
  }
}

export function getPrefs(): Prefs {
  return localGet<Prefs>(PREFS_KEY) ?? {};
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch };
  localSet(PREFS_KEY, next);
  return next;
}
