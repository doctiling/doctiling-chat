import type { Turn } from './api';

// Spec 074 (doctiling-web) FR-010: a visitor's conversation with a public chat
// lives only in their own browser, one per public link. localStorage first; if
// the browser refuses (private mode, blocked site data) it is kept in memory
// for the visit and simply not remembered.

export const PUBLIC_HISTORY_MAX_TURNS = 100;

const KEY = (slug: string) => `doctiling-public-chat:${slug}`;
const VISITOR_KEY = 'doctiling-public-chat:visitor';

export type PublicHistory = {
  load: (slug: string) => Promise<Turn[]>;
  save: (slug: string, turns: Turn[]) => Promise<void>;
  clear: (slug: string) => Promise<void>;
};

function isTurn(value: unknown): value is Turn {
  const t = value as Turn;
  return !!t && typeof t === 'object' && typeof t.id === 'string' && (t.role === 'user' || t.role === 'agent') && typeof t.content === 'string';
}

// What is stored: the turns as shown, without the client-only `@` references.
function storable(turns: Turn[]): Turn[] {
  return turns.slice(-PUBLIC_HISTORY_MAX_TURNS).map(({ references: _references, ...rest }) => rest);
}

export function createPublicHistory(): PublicHistory {
  const memory = new Map<string, Turn[]>();
  return {
    async load(slug) {
      if (memory.has(slug)) return memory.get(slug)!;
      try {
        const raw = window.localStorage.getItem(KEY(slug));
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter(isTurn) : [];
      } catch {
        return [];
      }
    },
    async save(slug, turns) {
      const kept = storable(turns);
      try {
        window.localStorage.setItem(KEY(slug), JSON.stringify(kept));
        memory.delete(slug);
      } catch {
        memory.set(slug, kept);
      }
    },
    async clear(slug) {
      memory.delete(slug);
      try {
        window.localStorage.removeItem(KEY(slug));
      } catch {
        /* nothing stored */
      }
    },
  };
}

let memoryVisitor: string | null = null;

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** An anonymous, per-browser id sent with each question (never tied to a person). */
export function visitorId(): string {
  try {
    const stored = window.localStorage.getItem(VISITOR_KEY);
    if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) return stored;
    const fresh = randomId();
    window.localStorage.setItem(VISITOR_KEY, fresh);
    return fresh;
  } catch {
    memoryVisitor ??= randomId();
    return memoryVisitor;
  }
}
