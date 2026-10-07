import * as React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { ChatApp, type ChatAppProps } from '../../src/ChatApp';
import { ToastProvider } from '../../src/components/Toast';
import { LanguageProvider } from '../../src/i18n/use-language';
import type { Language } from '../../src/i18n';
import { createChatApi, type ChatApiConfig } from '../../src/lib/api';
import { ChatProvider, type ChatContextValue } from '../../src/lib/chat-context';
import { makePaths } from '../../src/lib/router';

/** The chat is same-origin: paths are relative. Tests pass an origin as apiBase so URLs are absolute and easy to match. */
export const API = 'https://studio.tenant.test';

/** What the host (doctiling-web) passes to <ChatApp> for the Spanish studio. */
export const HOST: Required<ChatAppProps> = {
  basePath: '/es/chat',
  locale: 'es',
  apiBase: API,
  signInHref: '/es/signin',
  studioHref: '/es/kb',
  signOutHref: '/es/auth/signout',
  version: '0.2.0-test',
};

/** The two viewports the chat distinguishes (Tailwind `md` = 768 px). Default in tests: mobile (tests/setup.ts). */
export const VIEWPORTS = { mobile: 375, desktop: 1280 } as const;

type Listener = (e: MediaQueryListEvent) => void;
const viewport: { width: number; lists: Set<{ update: () => void }> } = { width: VIEWPORTS.mobile, lists: new Set() };
const OURS = Symbol('viewport-matchMedia');

const evaluate = (query: string) => {
  const min = /\(min-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query);
  const max = /\(max-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query);
  if (!min && !max) return false;
  return (!min || viewport.width >= Number(min[1])) && (!max || viewport.width <= Number(max[1]));
};

class FakeMediaQueryList extends EventTarget {
  media: string;
  matches: boolean;
  onchange: Listener | null = null;
  constructor(query: string) {
    super();
    this.media = query;
    this.matches = evaluate(query);
    viewport.lists.add(this);
  }
  update() {
    const next = evaluate(this.media);
    if (next === this.matches) return;
    this.matches = next;
    const ev = new Event('change') as MediaQueryListEvent;
    Object.defineProperty(ev, 'matches', { value: next });
    Object.defineProperty(ev, 'media', { value: this.media });
    this.dispatchEvent(ev);
    this.onchange?.(ev);
  }
  addListener(cb: Listener) {
    this.addEventListener('change', cb as EventListener);
  }
  removeListener(cb: Listener) {
    this.removeEventListener('change', cb as EventListener);
  }
}

/**
 * A `matchMedia` that answers `(min-width: Npx)` / `(max-width: Npx)` against a viewport width and fires
 * `change` when the viewport changes within a test. Anything else (`display-mode`…) is false. Installed with
 * `vi.stubGlobal`, so `afterEach` (`vi.unstubAllGlobals`) brings every test back to the mobile default.
 */
export function setViewport(name: keyof typeof VIEWPORTS) {
  viewport.width = VIEWPORTS[name];
  const installed = (window.matchMedia as unknown as { [OURS]?: true } | undefined)?.[OURS];
  if (!installed) {
    viewport.lists.clear();
    const fn = (query: string) => new FakeMediaQueryList(query) as unknown as MediaQueryList;
    (fn as unknown as { [OURS]?: true })[OURS] = true;
    vi.stubGlobal('matchMedia', fn);
    return;
  }
  for (const l of viewport.lists) l.update();
}

/** Render the whole app as the host does (own router under basePath). */
export function renderChatApp(overrides: Partial<ChatAppProps> = {}) {
  return render(<ChatApp {...HOST} {...overrides} />);
}

type ScreenOptions = RenderOptions & { language?: Language; host?: Partial<ChatContextValue>; api?: Partial<ChatApiConfig> };

/** Render one screen inside the providers ChatApp would give it (a configured API, paths under basePath). */
export function renderApp(ui: React.ReactElement, { language = 'en', host = {}, api: apiCfg = {}, ...options }: ScreenOptions = {}) {
  const basePath = host.basePath ?? HOST.basePath;
  const api = createChatApi({ apiBase: API, signInHref: HOST.signInHref, navigateTo: vi.fn(), ...apiCfg });
  const value: ChatContextValue = {
    basePath,
    locale: language,
    signInHref: HOST.signInHref,
    studioHref: HOST.studioHref,
    signOutHref: HOST.signOutHref,
    version: HOST.version,
    api,
    paths: makePaths(basePath),
    ...host,
  };
  const wrap = (node: React.ReactElement) => (
    <ChatProvider value={value}>
      <LanguageProvider language={language}>
        <ToastProvider>{node}</ToastProvider>
      </LanguageProvider>
    </ChatProvider>
  );
  const result = render(wrap(ui), options);
  return { ...result, api, rerender: (next: React.ReactElement) => result.rerender(wrap(next)) };
}

/** A GET …/session mock whose turns follow what the agent mock appends (the server persists turns). */
export function sessionStore(initial: unknown[] = [], extra: Record<string, unknown> = {}) {
  const state = { turns: [...initial], pending: null as unknown, isRunning: false, access: undefined as unknown, ...extra };
  return {
    state,
    route: (): Route => ({
      match: on('GET', /\/session$/),
      respond: () => json({ turns: state.turns, actions: [], pending: state.pending, isRunning: state.isRunning, access: state.access }),
    }),
    append: (...turns: unknown[]) => state.turns.push(...turns),
  };
}

export type Call = { url: string; init: RequestInit & { headers?: HeadersInit } };

export type Route = {
  match: (url: string, init: RequestInit) => boolean;
  respond: (url: string, init: RequestInit) => Response | Promise<Response>;
};

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

export const empty = (status = 204) => new Response(null, { status });

/** What doctiling-web answers on every /api/chat/* route when the chat is not enabled (FR-027). */
export const notEnabled = () => new Response(null, { status: 404 });

/** NDJSON stream, one line per event, optionally split across odd chunk boundaries. */
export function ndjson(events: unknown[], { chunkSize, delayMs = 0, signal }: { chunkSize?: number; delayMs?: number; signal?: AbortSignal } = {}) {
  const text = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  const enc = new TextEncoder();
  const chunks: string[] = [];
  if (chunkSize) for (let i = 0; i < text.length; i += chunkSize) chunks.push(text.slice(i, i + chunkSize));
  else chunks.push(...text.split(/(?<=\n)/));
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const c of chunks) {
        if (signal?.aborted) {
          controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          return;
        }
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        controller.enqueue(enc.encode(c));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
}

/** Install a fetch mock routed by predicate; returns the recorded calls. Unmatched → 404 with a body (a missing resource, not a disabled chat). */
export function mockFetch(routes: Route[]) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    if (init.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    const route = routes.find((r) => r.match(url, init));
    if (!route) return json({ error: 'not_found' }, 404);
    return route.respond(url, init);
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}

export const headerOf = (init: RequestInit, name: string) => new Headers(init.headers).get(name);

export const on = (method: string, path: string | RegExp) => (url: string, init: RequestInit) =>
  (init.method ?? 'GET').toUpperCase() === method && (typeof path === 'string' ? url === `${API}${path}` : path.test(url));

export const flush = () => new Promise((r) => setTimeout(r, 0));
