import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Node ≥ 22 exposes a native `localStorage` that, without --localstorage-file, is an
// object with no methods and shadows jsdom's. Replace it with an in-memory Storage so
// the suite behaves the same on Node 20 (CI / image) and on a newer local Node.
if (typeof (globalThis as { localStorage?: { clear?: unknown } }).localStorage?.clear !== 'function') {
  class MemoryStorage {
    #m = new Map<string, string>();
    get length() {
      return this.#m.size;
    }
    key(i: number) {
      return [...this.#m.keys()][i] ?? null;
    }
    getItem(k: string) {
      return this.#m.has(k) ? this.#m.get(k)! : null;
    }
    setItem(k: string, v: string) {
      this.#m.set(String(k), String(v));
    }
    removeItem(k: string) {
      this.#m.delete(k);
    }
    clear() {
      this.#m.clear();
    }
  }
  Object.defineProperty(globalThis, 'Storage', { value: MemoryStorage, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: new MemoryStorage(), configurable: true, writable: true });
}

// Every test starts without a token, without prefs and without a runtime config.
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  delete (window as unknown as { __DOCTILING_CHAT__?: unknown }).__DOCTILING_CHAT__;
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// jsdom gaps that Radix Dialog and the screens touch.
if (!('ResizeObserver' in window)) {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}
