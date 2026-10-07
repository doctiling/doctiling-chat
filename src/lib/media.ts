// Viewport-driven behaviour (never user agent): the UI decides by size. Pure
// layout goes through Tailwind `md:` classes; this hook is for the few places
// where behaviour differs (sheet vs side panel, Enter handling, which routes
// render both columns of the desktop shell).
import * as React from 'react';

/** Tailwind `md`: from here up the chat is a two-column desktop app. */
export const DESKTOP_QUERY = '(min-width: 768px)';

/**
 * SSR-safe `matchMedia`: `false` on the server and on the first client render
 * (hydration must match), the real value right after mount, then follows changes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const apply = () => setMatches(mql.matches);
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [query]);
  return matches;
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
