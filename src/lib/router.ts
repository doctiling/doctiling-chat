// Minimal history router under the host's basePath (e.g. /es/chat): five
// routes and no need for a library. The host (Next) serves every path under
// basePath with the same page; this router decides what the page shows.
import * as React from 'react';

export type Route =
  | { name: 'kbs' }
  | { name: 'conversation'; kbId: string; docId?: string }
  | { name: 'settings' }
  | { name: 'offline' };

const trimSlashes = (s: string) => s.replace(/\/+$/, '');

/** Path relative to basePath ('/kb/x' for '/es/chat/kb/x'); '/' when outside it. */
export function stripBasePath(pathname: string, basePath: string): string {
  const base = trimSlashes(basePath);
  if (!base) return pathname || '/';
  if (pathname === base) return '/';
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length) || '/';
  return '/';
}

export function parseRoute(pathname: string, basePath = ''): Route {
  const rel = stripBasePath(pathname, basePath);
  const parts = trimSlashes(rel).split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { name: 'kbs' };
  if (parts[0] === 'kb') {
    if (!parts[1]) return { name: 'kbs' };
    if (parts[2] === 'doc' && parts[3]) return { name: 'conversation', kbId: parts[1], docId: parts[3] };
    return { name: 'conversation', kbId: parts[1] };
  }
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'offline') return { name: 'offline' };
  return { name: 'kbs' };
}

export type Paths = {
  kbs: () => string;
  conversation: (kbId: string) => string;
  document: (kbId: string, docId: string) => string;
  settings: () => string;
  offline: () => string;
};

export function makePaths(basePath: string): Paths {
  const base = trimSlashes(basePath);
  return {
    kbs: () => `${base}/kb`,
    conversation: (kbId: string) => `${base}/kb/${encodeURIComponent(kbId)}`,
    document: (kbId: string, docId: string) => `${base}/kb/${encodeURIComponent(kbId)}/doc/${encodeURIComponent(docId)}`,
    settings: () => `${base}/settings`,
    offline: () => `${base}/offline`,
  };
}

const listeners = new Set<() => void>();

export function navigate(to: string, { replace = false }: { replace?: boolean } = {}) {
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  for (const l of listeners) l();
}

export function useRoute(basePath: string): Route {
  const subscribe = React.useCallback((cb: () => void) => {
    listeners.add(cb);
    window.addEventListener('popstate', cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener('popstate', cb);
    };
  }, []);
  const pathname = React.useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
    () => basePath,
  );
  return React.useMemo(() => parseRoute(pathname, basePath), [pathname, basePath]);
}
