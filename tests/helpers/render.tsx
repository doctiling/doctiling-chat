import * as React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { ToastProvider } from '@/components/Toast';
import { LanguageProvider } from '@/i18n/use-language';
import { resetConfigForTests } from '@/config';
import { TOKEN_KEY, type Language } from '@/lib/storage';

export const API = 'https://studio.tenant.test';

/** Inject the runtime config the way server/serve.mjs does and reset the cache. */
export function setConfig(partial: Partial<{ apiOrigin: string; chatHost: string; version: string }> = {}) {
  window.__DOCTILING_CHAT__ = { apiOrigin: API, chatHost: 'chat.tenant.test', version: '0.1.0-test', ...partial };
  resetConfigForTests();
}

/** jsdom has no IndexedDB, so the storage module uses the localStorage fallback: seed it directly. */
export function seedToken(token = 'dct_chat_test-token') {
  window.localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt: Date.now() + 86_400_000, apiOrigin: API }));
  return token;
}

export function renderApp(ui: React.ReactElement, { language = 'en', ...options }: RenderOptions & { language?: Language } = {}) {
  const wrap = (node: React.ReactElement) => (
    <LanguageProvider initial={language}>
      <ToastProvider>{node}</ToastProvider>
    </LanguageProvider>
  );
  const result = render(wrap(ui), options);
  return { ...result, rerender: (next: React.ReactElement) => result.rerender(wrap(next)) };
}

/** A GET …/session mock whose turns follow what the agent mock appends (the server persists turns). */
export function sessionStore(initial: unknown[] = [], extra: Record<string, unknown> = {}) {
  const state = { turns: [...initial], pending: null as unknown, isRunning: false, ...extra };
  return {
    state,
    route: (): Route => ({ match: on('GET', /\/session$/), respond: () => json({ turns: state.turns, actions: [], pending: state.pending, isRunning: state.isRunning }) }),
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

/** Install a fetch mock routed by predicate; returns the recorded calls. */
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
