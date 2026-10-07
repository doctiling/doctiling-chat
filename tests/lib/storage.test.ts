import { describe, expect, it, vi } from 'vitest';
import { getPrefs, PREFS_KEY, setPrefs } from '../../src/lib/storage';

// T055 — preferences only (no token: the studio session is the session), in
// localStorage, everything in try/catch. [TS-399]
describe('storage (T055, TS-399)', () => {
  it('merges prefs and persists them', () => {
    setPrefs({ lastKbId: 'kb1' });
    setPrefs({ iosHintDismissed: true });
    expect(getPrefs()).toEqual({ lastKbId: 'kb1', iosHintDismissed: true });
    expect(JSON.parse(window.localStorage.getItem(PREFS_KEY)!)).toEqual({ lastKbId: 'kb1', iosHintDismissed: true });
  });

  it('never stores a token or anything of business under its key', () => {
    setPrefs({ lastKbId: 'kb1' });
    expect(Object.keys(getPrefs())).toEqual(['lastKbId']);
    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.key(0)).toBe(PREFS_KEY);
  });

  it('never throws when storage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceeded');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(() => setPrefs({ lastKbId: 'x' })).not.toThrow();
    expect(getPrefs()).toEqual({});
    spy.mockRestore();
    vi.restoreAllMocks();
    expect(window.localStorage.getItem(PREFS_KEY)).toBeNull();
  });
});
