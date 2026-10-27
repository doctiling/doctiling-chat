// Theme preference of the chat (doctiling-web spec 068, FR-028..030): light, dark or
// "follow the device". A device preference only — it lives in localStorage under its own
// key, never on the server. The host (doctiling-web globals.css) keys its dark tokens on
// the `dark` class of <html>; this module only toggles that class, the tokens do the rest.
// Every storage access is wrapped: a blocked storage keeps the choice for the session.

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_KEY = 'doctiling-chat:theme';
export const THEME_PREFERENCES: ThemePreference[] = ['light', 'dark', 'system'];
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Set when storage is blocked, so the choice still holds until the page is closed. */
let sessionPreference: ThemePreference | null = null;

const isPreference = (v: unknown): v is ThemePreference => typeof v === 'string' && (THEME_PREFERENCES as string[]).includes(v);

export function getThemePreference(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    if (isPreference(raw)) return raw;
  } catch {
    /* storage blocked: fall through to the session value */
  }
  return sessionPreference ?? 'system';
}

function systemPrefersDark(): boolean {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

/** What the page shows for a preference: the preference itself, or the device's answer for 'system'. */
export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

/** The browser chrome (address bar, task switcher) follows the page background after the tokens switch. */
function updateThemeColor() {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  try {
    const bg = getComputedStyle(document.body).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') meta.setAttribute('content', bg);
  } catch {
    /* no layout (tests, SSR): keep whatever the host wrote */
  }
}

/** Apply `pref` to the document: `dark` class + color-scheme on <html>, then the theme-color meta. */
export function applyTheme(pref: ThemePreference = getThemePreference()): 'light' | 'dark' {
  const resolved = resolveTheme(pref);
  if (typeof document === 'undefined') return resolved;
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  root.dataset.themePreference = pref;
  updateThemeColor();
  return resolved;
}

/** Remember `pref` (storage when it works, this session otherwise) and apply it right away. */
export function setThemePreference(pref: ThemePreference): 'light' | 'dark' {
  sessionPreference = pref;
  try {
    window.localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* storage blocked: the choice holds for this session only */
  }
  return applyTheme(pref);
}

/**
 * Follow the device while the preference is 'system': re-applies on every change of the media
 * query, no reload. A fixed preference ignores the device. Returns the unsubscribe.
 */
export function watchSystemTheme(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  let mql: MediaQueryList;
  try {
    mql = window.matchMedia(DARK_QUERY);
  } catch {
    return () => {};
  }
  const onChange = () => {
    if (getThemePreference() === 'system') applyTheme('system');
  };
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }
  mql.addListener(onChange);
  return () => mql.removeListener(onChange);
}
