import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// T070 — public/sw.js in a fake ServiceWorkerGlobalScope: precache of the shell, navigation
// network-first → offline.html, /api/*, /connect/* and Authorization requests NEVER cached, static
// assets cache-first, SKIP_WAITING by message, no skipWaiting on install. [TS-398, TS-401]

const ORIGIN = 'https://chat.tenant.test';
const swSource = readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');

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

function makeScope() {
  const listeners = new Map<string, Listener[]>();
  const caches = new Map<string, FakeCache>();
  const scope = {
    location: new URL(`${ORIGIN}/sw.js`),
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
  vm.runInNewContext(swSource, scope, { filename: 'sw.js' });
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

describe('service worker (T070)', () => {
  let network: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    network = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return new Response(`net:${new URL(url).pathname}`, { status: 200, headers: { 'content-type': 'text/plain' } });
    });
    vi.stubGlobal('fetch', network);
  });

  it('install precaches the shell (incl. offline.html) and does NOT call skipWaiting (TS-401)', async () => {
    const { scope, caches, dispatch } = makeScope();
    await dispatch('install');
    const shell = [...caches.values()][0]!;
    expect([...shell.store.keys()]).toEqual(expect.arrayContaining(['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png']));
    expect(scope.skipWaiting).not.toHaveBeenCalled();
  });

  it('SKIP_WAITING message → skipWaiting; other messages ignored (TS-401)', async () => {
    const { scope, dispatch } = makeScope();
    await dispatch('message', { data: { type: 'OTHER' } });
    expect(scope.skipWaiting).not.toHaveBeenCalled();
    await dispatch('message', { data: { type: 'SKIP_WAITING' } });
    expect(scope.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('navigation is network-first and falls back to offline.html without network (TS-398)', async () => {
    const { dispatch } = makeScope();
    await dispatch('install');
    const online = await dispatch('fetch', { request: req('/kb/abc', { mode: 'navigate' }) });
    expect(await online!.text()).toBe('net:/kb/abc');
    network.mockImplementation(async () => Promise.reject(new TypeError('offline')));
    const offline = await dispatch('fetch', { request: req('/kb/abc', { mode: 'navigate' }) });
    expect(await offline!.text()).toBe('net:/offline.html');
  });

  it('never intercepts /api/*, /connect/* or a request with Authorization, so nothing of them is ever cached (TS-398)', async () => {
    const { caches, dispatch } = makeScope();
    await dispatch('install');
    const before = [...caches.values()].flatMap((c) => [...c.store.keys()]);
    for (const r of [
      req('/api/chat/me'),
      req('/api/chat/knowledge-bases/kb/session'),
      req('/connect/callback?code=x&state=y', { mode: 'navigate' }),
      req('/assets/app.js', { headers: { Authorization: 'Bearer dct_chat_x' } }),
      req('/api/chat/knowledge-bases/kb/agent', { method: 'POST', body: '{}' }),
    ]) {
      const res = await dispatch('fetch', { request: r });
      expect(res, r.url).toBeNull(); // no respondWith → browser goes to the network untouched
    }
    const after = [...caches.values()].flatMap((c) => [...c.store.keys()]);
    expect(after).toEqual(before);
    expect(after.some((k) => k.startsWith('/api/') || k.startsWith('/connect/'))).toBe(false);
  });

  it('cross-origin requests (the tenant API) are left alone', async () => {
    const { dispatch } = makeScope();
    const res = await dispatch('fetch', { request: new Request('https://studio.tenant.test/api/chat/me') });
    expect(res).toBeNull();
  });

  it('static assets are cache-first and versioned by the cache name', async () => {
    const { caches, dispatch } = makeScope();
    const first = await dispatch('fetch', { request: req('/assets/index-abc123.js') });
    expect(await first!.text()).toBe('net:/assets/index-abc123.js');
    expect(network).toHaveBeenCalledTimes(1);
    const second = await dispatch('fetch', { request: req('/assets/index-abc123.js') });
    expect(await second!.text()).toBe('net:/assets/index-abc123.js');
    expect(network).toHaveBeenCalledTimes(1);
    expect([...caches.keys()].every((k) => k.startsWith('doctiling-chat-') && k.includes('__SW_VERSION__'))).toBe(true);
  });

  it('activate drops caches of other versions and claims clients', async () => {
    const { scope, caches, dispatch } = makeScope();
    await scope.caches.open('doctiling-chat-shell-old');
    await scope.caches.open('unrelated');
    await dispatch('install');
    await dispatch('activate');
    expect(caches.has('doctiling-chat-shell-old')).toBe(false);
    expect(caches.has('unrelated')).toBe(true);
    expect(scope.clients.claim).toHaveBeenCalled();
  });
});
