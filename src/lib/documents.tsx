// The base's readable documents, fetched once per base and kept in memory for
// the Documents screen and the `@` mention picker. The server already filtered
// what the person may read (their own private documents included); the client
// only lists, filters and points at them. The cache lives in the ChatProvider,
// so a host remount (or a test render) starts clean.
import * as React from 'react';
import { ApiError, type ChatApi, type DocumentListItem } from './api';
import { useRealtime, type RealtimeEvent } from './realtime';

export type DocumentsEntry = {
  items: DocumentListItem[] | null;
  error: 'forbidden' | 'failed' | null;
  promise: Promise<void> | null;
};

export type DocumentsCache = {
  entries: Map<string, DocumentsEntry>;
  listeners: Set<() => void>;
  /** Pending coalesced reloads, one per base (spec 072: a burst of signals = one fetch). */
  timers: Map<string, ReturnType<typeof setTimeout>>;
};

export const createDocumentsCache = (): DocumentsCache => ({ entries: new Map(), listeners: new Set(), timers: new Map() });

export const RELOAD_DEBOUNCE_MS = 300;

const EMPTY: DocumentsEntry = { items: null, error: null, promise: null };

function notify(cache: DocumentsCache) {
  for (const l of cache.listeners) l();
}

/** Start (or reuse) the fetch for `kbId`; `force` drops the cached copy first. */
export function loadDocuments(cache: DocumentsCache, api: ChatApi, kbId: string, force = false): Promise<void> {
  const current = cache.entries.get(kbId);
  if (!force && current?.promise) return current.promise;
  if (!force && current?.items) return Promise.resolve();
  const promise = api
    .documents(kbId)
    .then(({ items }) => {
      cache.entries.set(kbId, { items, error: null, promise: null });
    })
    .catch((e: unknown) => {
      const silent = e instanceof ApiError && (e.status === 401 || e.code === 'chat_disabled');
      const error = silent ? null : e instanceof ApiError && e.status === 403 ? 'forbidden' : 'failed';
      cache.entries.set(kbId, { items: null, error, promise: null });
    })
    .finally(() => notify(cache));
  cache.entries.set(kbId, { items: force ? null : (current?.items ?? null), error: null, promise });
  notify(cache);
  return promise;
}

/** A reload of `kbId` within RELOAD_DEBOUNCE_MS; calls inside the window collapse into one fetch. */
export function scheduleReload(cache: DocumentsCache, api: ChatApi, kbId: string) {
  if (cache.timers.has(kbId)) return;
  cache.timers.set(
    kbId,
    setTimeout(() => {
      cache.timers.delete(kbId);
      void loadDocuments(cache, api, kbId, true);
    }, RELOAD_DEBOUNCE_MS),
  );
}

/** Signals that change what the list shows (a new, renamed, moved or deleted document; index/OCR status). */
export function affectsList(event: RealtimeEvent, kbId: string): boolean {
  if (event.type === 'resync') return true;
  const s = event.signal;
  if (!('kbId' in s) || s.kbId !== kbId) return false;
  return s.kind === 'kb.documents' || s.kind === 'doc.index' || s.kind === 'doc.ocr';
}

const DocumentsContext = React.createContext<DocumentsCache | null>(null);

export function DocumentsCacheProvider({ children }: { children: React.ReactNode }) {
  const cache = React.useRef<DocumentsCache | null>(null);
  if (!cache.current) cache.current = createDocumentsCache();
  return <DocumentsContext.Provider value={cache.current}>{children}</DocumentsContext.Provider>;
}

export function useDocumentsCache(): DocumentsCache {
  const ctx = React.useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments outside <ChatApp>');
  return ctx;
}

/** The documents of `kbId` (null while loading), the error if any, and a reload. */
export function useDocuments(api: ChatApi, kbId: string) {
  const cache = useDocumentsCache();
  const subscribe = React.useCallback(
    (cb: () => void) => {
      cache.listeners.add(cb);
      return () => {
        cache.listeners.delete(cb);
      };
    },
    [cache],
  );
  const entry = React.useSyncExternalStore(
    subscribe,
    () => cache.entries.get(kbId) ?? EMPTY,
    () => EMPTY,
  );
  React.useEffect(() => {
    void loadDocuments(cache, api, kbId);
  }, [cache, api, kbId]);
  useRealtime(api, kbId, (event) => {
    if (affectsList(event, kbId)) scheduleReload(cache, api, kbId);
  });
  const reload = React.useCallback(() => loadDocuments(cache, api, kbId, true), [cache, api, kbId]);
  return { items: entry.items, error: entry.error, loading: entry.promise !== null, reload };
}

/** Case- and accent-insensitive "contains" over title and parent title. */
export function filterDocuments(items: DocumentListItem[], query: string): DocumentListItem[] {
  const q = fold(query.trim());
  if (!q) return items;
  return items.filter((d) => fold(d.title).includes(q) || (d.parentTitle ? fold(d.parentTitle).includes(q) : false));
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * The `@` mention being typed, if the caret sits right after `@word` (no space
 * since the `@`, and the `@` starts a token). `start` is the index of the `@`.
 */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([^\s@]*)$/.exec(before);
  if (!m) return null;
  const query = m[2] ?? '';
  return { start: before.length - query.length - 1, query };
}
