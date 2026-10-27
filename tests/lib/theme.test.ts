import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, DARK_QUERY, getThemePreference, setThemePreference, THEME_KEY, watchSystemTheme } from '../../src/lib/theme';

// spec 068 (doctiling-web) FR-028..030: light / dark / follow the device, a device preference applied
// without a reload; blocked storage keeps the choice for the session and never crashes the chat.

type Listener = (e: Event) => void;

/** A `(prefers-color-scheme: dark)` list whose answer the test flips. */
function fakeDarkQuery(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    media: DARK_QUERY,
    matches: initial,
    onchange: null,
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
    addListener: (cb: Listener) => listeners.add(cb),
    removeListener: (cb: Listener) => listeners.delete(cb),
    dispatchEvent: () => false,
  };
  vi.stubGlobal('matchMedia', (query: string) => (query === DARK_QUERY ? mql : { matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
  return {
    flip(matches: boolean) {
      mql.matches = matches;
      for (const cb of listeners) cb(new Event('change'));
    },
    listeners,
  };
}

describe('theme (spec 068 FR-028..030)', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
    setThemePreference('system');
    window.localStorage.clear();
  });

  it('defaults to "system" when nothing (or something invalid) is stored', () => {
    expect(getThemePreference()).toBe('system');
    window.localStorage.setItem(THEME_KEY, 'purple');
    expect(getThemePreference()).toBe('system');
  });

  it('applies and remembers an explicit choice: dark adds the class, light removes it', () => {
    fakeDarkQuery(false);
    expect(setThemePreference('dark')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(getThemePreference()).toBe('dark');

    setThemePreference('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(window.localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('"system" follows the device, and a change of the media query re-applies without a reload', () => {
    const q = fakeDarkQuery(true);
    setThemePreference('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    const stop = watchSystemTheme();
    expect(q.listeners.size).toBe(1);
    q.flip(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    q.flip(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    stop();
    expect(q.listeners.size).toBe(0);
  });

  it('a fixed choice ignores the device even while the watcher is on', () => {
    const q = fakeDarkQuery(false);
    setThemePreference('light');
    const stop = watchSystemTheme();
    q.flip(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    stop();
  });

  it('storage that throws never crashes: the choice holds for the session, a fresh read falls back to "system"', () => {
    fakeDarkQuery(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceeded');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(() => setThemePreference('dark')).not.toThrow();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(getThemePreference()).toBe('dark');
    expect(() => applyTheme()).not.toThrow();
    vi.restoreAllMocks();
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull();
    // Nothing was persisted; the session-only memory is cleared by the afterEach reset.
  });

  it('applyTheme() with nothing stored reads the device and updates <meta name="theme-color"> from the page background', () => {
    fakeDarkQuery(true);
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#798A75');
    document.head.appendChild(meta);
    document.body.style.backgroundColor = 'rgb(17, 24, 39)';
    expect(applyTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(meta.getAttribute('content')).toBe('rgb(17, 24, 39)');
    document.body.style.backgroundColor = '';
    meta.remove();
  });
});
