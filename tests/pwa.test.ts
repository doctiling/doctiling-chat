import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lightColors } from '@doctiling/brand';
import { manifestFor, offlineHtml, serviceWorkerSource } from '../src/pwa';

const root = path.resolve(__dirname, '..');

// T069 — manifest: own identity, icons, colors from the brand tokens, scope/start under /{locale}/chat (FR-021). [TS-396, TS-402]
describe('manifestFor (T069)', () => {
  const m = manifestFor('es', { startUrl: '/es/chat', scope: '/es/chat/', iconsBase: '/chat/icons' });

  it('declares the chat identity: name, short_name, standalone, own scope = id, launch_handler (TS-402)', () => {
    expect(m.name).toBe('Doctiling Chat');
    expect(m.short_name).toBe('Chat');
    expect(m.display).toBe('standalone');
    expect(m.scope).toBe('/es/chat/');
    expect(m.id).toBe('/es/chat/');
    expect(m.start_url).toBe('/es/chat');
    expect(m.lang).toBe('es');
    expect(m.launch_handler).toEqual({ client_mode: 'navigate-existing' });
    expect(manifestFor('en', { startUrl: '/en/chat', scope: '/en/chat' }).scope).toBe('/en/chat/');
  });

  it('ships its own icons (any + maskable, 192 and 512) under iconsBase and they exist in public/icons', () => {
    const purposes = (p: string) => m.icons.filter((i) => i.purpose === p).map((i) => i.sizes).sort();
    expect(purposes('any')).toEqual(['192x192', '512x512']);
    expect(purposes('maskable')).toEqual(['192x192', '512x512']);
    for (const icon of m.icons) {
      expect(icon.src.startsWith('/chat/icons/')).toBe(true);
      const file = path.join(root, 'public', 'icons', path.basename(icon.src));
      expect(existsSync(file), icon.src).toBe(true);
      expect([...readFileSync(file).subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    }
  });

  it('colors come from the brand tokens and the offline page agrees on theme-color (TS-396)', () => {
    expect(m.theme_color.toLowerCase()).toBe(lightColors.primary.toLowerCase());
    expect(m.background_color.toLowerCase()).toBe(lightColors.background.toLowerCase());
    expect(offlineHtml('en')).toContain(`<meta name="theme-color" content="${m.theme_color}" />`);
  });
});

// T070 — the generated worker in a fake ServiceWorkerGlobalScope: precache of the offline page,
// navigation inside the scope network-first → offline page, /api/* and Authorization requests NEVER cached,
// static assets cache-first, SKIP_WAITING by message, no skipWaiting on install. [TS-398, TS-401]
const ORIGIN = 'https://studio.tenant.test';
const SW_OPTS = { scope: '/es/chat/', offlineUrl: '/es/chat/offline.html', version: '0.2.0', precache: ['/chat/icons/icon-192.png'] };

type Listener = (event: FakeEvent) => void;
type FakeEvent = { request?: Request; data?: unknown; waitUntil: (p: Promise<unknown>) => void; respondWith: (r: Response | Promise<Response>) => void };

class FakeCache {
  store = new Map<string, Response>();
  async add(req: Request | string) {
    const r = typeof req === 'string' ? new Request(new URL(req, ORIGIN).toString()) : req;
    const res = await fetch(r);
    this.store.set(new URL(r.url).pathname, res.clone());
  }
  async match(req: Request | string) {
    const key = typeof req === 'string' ? new URL(req, ORIGIN).pathname : new URL(req.url).pathname;
    const hit = this.store.get(key);
    return hit ? hit.clone() : undefined;
  }
  async put(req: Request | string, res: Response) {
    const key = typeof req === 'string' ? new URL(req, ORIGIN).pathname : new URL(req.url).pathname;
    this.store.set(key, res);
  }
}

// In a real worker, `new Request('/x')` resolves against the scope's location; Node's needs an absolute URL.
class ScopedRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === 'string' ? new URL(input, ORIGIN).toString() : input, init);
  }
}

function makeScope(source = serviceWorkerSource(SW_OPTS)) {
  const listeners = new Map<string, Listener[]>();
  const caches = new Map<string, FakeCache>();
  const scope = {
    location: new URL(`${ORIGIN}/es/chat/sw.js`),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}) },
    addEventListener: (type: string, fn: Listener) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    caches: {
      open: async (name: string) => {
        if (!caches.has(name)) caches.set(name, new FakeCache());
        return caches.get(name)!;
      },
      keys: async () => [...caches.keys()],
      delete: async (name: string) => caches.delete(name),
    },
    Request: ScopedRequest,
    Response,
    URL,
    Promise,
    console,
    fetch: (...args: Parameters<typeof fetch>) => (globalThis.fetch as typeof fetch)(...args),
  };
  (scope as unknown as { self: unknown }).self = scope;
  vm.runInNewContext(source, scope, { filename: 'sw.js' });
  const dispatch = async (type: string, init: Partial<FakeEvent> = {}) => {
    const pending: Promise<unknown>[] = [];
    let response: Promise<Response> | null = null;
    const event: FakeEvent = {
      ...init,
      waitUntil: (p) => pending.push(p),
      respondWith: (r) => {
        response = Promise.resolve(r);
      },
    };
    for (const fn of listeners.get(type) ?? []) fn(event);
    await Promise.all(pending);
    return response as Promise<Response> | null;
  };
  return { scope, caches, dispatch };
}

// Node's Request refuses mode 'navigate' (browser-only): set it after construction.
const req = (p: string, { mode, ...init }: RequestInit & { mode?: RequestMode } = {}) => {
  const r = new Request(`${ORIGIN}${p}`, init);
  if (mode) Object.defineProperty(r, 'mode', { value: mode });
  return r;
};

describe('serviceWorkerSource (T070)', () => {
  let network: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    network = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return new Response(`net:${new URL(url).pathname}`, { status: 200, headers: { 'content-type': 'text/plain' } });
    });
    vi.stubGlobal('fetch', network);
  });

  it('is plain JavaScript that embeds the version, the scope and the offline URL, and never mentions a vendor', () => {
    const src = serviceWorkerSource(SW_OPTS);
    expect(src).toContain(`const VERSION = "0.2.0";`);
    expect(src).toContain(`const SCOPE = "/es/chat/";`);
    expect(src).toContain(`const OFFLINE_URL = "/es/chat/offline.html";`);
    expect(() => new vm.Script(src)).not.toThrow();
    expect(src).not.toMatch(/\bskipWaiting\(\)\s*;?\s*\/\/\s*install/);
  });

  it('install precaches the offline page and icons and does NOT call skipWaiting (TS-401)', async () => {
    const { scope, caches, dispatch } = makeScope();
    await dispatch('install');
    const shell = [...caches.values()][0]!;
    expect([...shell.store.keys()]).toEqual(expect.arrayContaining(['/es/chat/offline.html', '/chat/icons/icon-192.png']));
    expect(scope.skipWaiting).not.toHaveBeenCalled();
  });

  it('SKIP_WAITING message → skipWaiting; other messages ignored (TS-401)', async () => {
    const { scope, dispatch } = makeScope();
    await dispatch('message', { data: { type: 'OTHER' } });
    expect(scope.skipWaiting).not.toHaveBeenCalled();
    await dispatch('message', { data: { type: 'SKIP_WAITING' } });
    expect(scope.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('a navigation inside the scope is network-first and falls back to the offline page without network (TS-398)', async () => {
    const { dispatch } = makeScope();
    await dispatch('install');
    const online = await dispatch('fetch', { request: req('/es/chat/kb/abc', { mode: 'navigate' }) });
    expect(await online!.text()).toBe('net:/es/chat/kb/abc');
    network.mockImplementation(async () => Promise.reject(new TypeError('offline')));
    const offline = await dispatch('fetch', { request: req('/es/chat/kb/abc', { mode: 'navigate' }) });
    expect(await offline!.text()).toBe('net:/es/chat/offline.html');
  });

  it('a navigation to the studio (outside the scope) is left to the browser', async () => {
    const { dispatch } = makeScope();
    expect(await dispatch('fetch', { request: req('/es/kb', { mode: 'navigate' }) })).toBeNull();
    expect(await dispatch('fetch', { request: req('/es/chatty', { mode: 'navigate' }) })).toBeNull();
  });

  it('never intercepts /api/*, non-GET or a request with Authorization, so nothing of them is ever cached (TS-398)', async () => {
    const { caches, dispatch } = makeScope();
    await dispatch('install');
    const before = [...caches.values()].flatMap((c) => [...c.store.keys()]);
    for (const r of [
      req('/api/chat/me'),
      req('/api/chat/knowledge-bases/kb/session'),
      req('/api/auth/session'),
      req('/_next/static/chunks/app.js', { headers: { Authorization: 'Bearer x' } }),
      req('/api/chat/knowledge-bases/kb/agent', { method: 'POST', body: '{}' }),
      req('/es/chat/sw.js'),
    ]) {
      const res = await dispatch('fetch', { request: r });
      expect(res, r.url).toBeNull(); // no respondWith → browser goes to the network untouched
    }
    const after = [...caches.values()].flatMap((c) => [...c.store.keys()]);
    expect(after).toEqual(before);
    expect(after.some((k) => k.startsWith('/api/'))).toBe(false);
  });

  it('cross-origin requests are left alone', async () => {
    const { dispatch } = makeScope();
    expect(await dispatch('fetch', { request: new Request('https://cdn.example.test/x.js') })).toBeNull();
  });

  it('static assets (/_next/static, /chat/icons) are cache-first and versioned by the cache name', async () => {
    const { caches, dispatch } = makeScope();
    const first = await dispatch('fetch', { request: req('/_next/static/chunks/app-abc123.js') });
    expect(await first!.text()).toBe('net:/_next/static/chunks/app-abc123.js');
    expect(network).toHaveBeenCalledTimes(1);
    const second = await dispatch('fetch', { request: req('/_next/static/chunks/app-abc123.js') });
    expect(await second!.text()).toBe('net:/_next/static/chunks/app-abc123.js');
    expect(network).toHaveBeenCalledTimes(1);
    await dispatch('fetch', { request: req('/chat/icons/icon-512.png') });
    expect([...caches.keys()].every((k) => k.startsWith('doctiling-chat-') && k.includes('0.2.0'))).toBe(true);
    // A chat page (HTML) is never a static asset even under a static prefix.
    expect(await dispatch('fetch', { request: req('/chat/anything') })).toBeNull();
  });

  it('activate drops caches of other versions and claims clients', async () => {
    const { scope, caches, dispatch } = makeScope();
    await scope.caches.open('doctiling-chat-shell-0.1.0');
    await scope.caches.open('unrelated');
    await dispatch('install');
    await dispatch('activate');
    expect(caches.has('doctiling-chat-shell-0.1.0')).toBe(false);
    expect(caches.has('unrelated')).toBe(true);
    expect(scope.clients.claim).toHaveBeenCalled();
  });
});

describe('offlineHtml', () => {
  it.each([
    ['en', 'No connection', 'Retry'],
    ['es', 'Sin conexión', 'Reintentar'],
  ] as const)('renders the %s page with its lang, copy and a reload button', (locale, title, retry) => {
    const html = offlineHtml(locale);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain(`<html lang="${locale}">`);
    expect(html).toContain(`<h1>${title}</h1>`);
    expect(html).toContain(`>${retry}</button>`);
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain("addEventListener('online'");
  });
});
