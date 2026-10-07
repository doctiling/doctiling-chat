// Minimal history router: the app has seven routes and no need for a library.
import * as React from 'react';

export type Route =
  | { name: 'connect' }
  | { name: 'callback' }
  | { name: 'kbs' }
  | { name: 'conversation'; kbId: string; docId?: string }
  | { name: 'settings' }
  | { name: 'offline' };

export function parseRoute(pathname: string): Route {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { name: 'connect' };
  if (parts[0] === 'connect') return parts[1] === 'callback' ? { name: 'callback' } : { name: 'connect' };
  if (parts[0] === 'kb') {
    if (!parts[1]) return { name: 'kbs' };
    if (parts[2] === 'doc' && parts[3]) return { name: 'conversation', kbId: parts[1], docId: parts[3] };
    return { name: 'conversation', kbId: parts[1] };
  }
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'offline') return { name: 'offline' };
  return { name: 'connect' };
}

export const paths = {
  connect: () => '/connect',
  kbs: () => '/kb',
  conversation: (kbId: string) => `/kb/${encodeURIComponent(kbId)}`,
  document: (kbId: string, docId: string) => `/kb/${encodeURIComponent(kbId)}/doc/${encodeURIComponent(docId)}`,
  settings: () => '/settings',
  offline: () => '/offline',
};

const listeners = new Set<() => void>();

export function navigate(to: string, { replace = false }: { replace?: boolean } = {}) {
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  for (const l of listeners) l();
}

export function useRoute(): Route {
  const subscribe = React.useCallback((cb: () => void) => {
    listeners.add(cb);
    window.addEventListener('popstate', cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener('popstate', cb);
    };
  }, []);
  const pathname = React.useSyncExternalStore(subscribe, () => window.location.pathname, () => '/');
  return React.useMemo(() => parseRoute(pathname), [pathname]);
}
