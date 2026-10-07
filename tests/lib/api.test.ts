import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, apiFetch, onSignOut, readNdjson } from '@/lib/api';
import { getToken } from '@/lib/storage';
import { API, headerOf, json, mockFetch, ndjson, on, seedToken, setConfig } from '../helpers/render';

// T057 — bearer header, any 401 → signOut, NDJSON reader with partial lines, AbortController. [TS-389, TS-399, TS-411]
describe('api (T057)', () => {
  beforeEach(() => setConfig());

  it('sends Authorization: Bearer <token> against the configured origin (TS-399)', async () => {
    const token = seedToken('dct_chat_abc123');
    const { calls } = mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json({ email: 'ana@tenant.test' }) }]);
    const me = await api.me();
    expect(me.email).toBe('ana@tenant.test');
    expect(calls[0]?.url).toBe(`${API}/api/chat/me`);
    expect(headerOf(calls[0]!.init, 'authorization')).toBe(`Bearer ${token}`);
  });

  it('any 401 clears the token and notifies sign-out with the server reason (TS-389)', async () => {
    seedToken();
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json({ error: 'revoked', messageKey: 'x' }, 401) }]);
    const seen: string[] = [];
    const off = onSignOut((r) => seen.push(r));
    await expect(api.me()).rejects.toMatchObject({ status: 401, code: 'revoked' });
    expect(seen).toEqual(['revoked']);
    expect(await getToken()).toBeNull();
    off();
  });

  it('a 401 with an unknown body still signs out as invalid', async () => {
    seedToken();
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => new Response('nope', { status: 401 }) }]);
    const seen: string[] = [];
    const off = onSignOut((r) => seen.push(r));
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    expect(seen).toEqual(['invalid']);
    off();
  });

  it('without a stored token an authenticated call signs out instead of calling the server', async () => {
    const { calls } = mockFetch([]);
    const seen: string[] = [];
    const off = onSignOut((r) => seen.push(r));
    await expect(api.knowledgeBases()).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(0);
    expect(seen).toEqual(['invalid']);
    off();
  });

  it('maps a 404 without body to chat_disabled and keeps other codes', async () => {
    seedToken();
    mockFetch([
      { match: on('GET', '/api/chat/me'), respond: () => new Response(null, { status: 404 }) },
      { match: on('POST', /\/agent$/), respond: () => json({ error: 'runInProgress', messageKey: 'k' }, 409) },
    ]);
    await expect(api.me()).rejects.toMatchObject({ status: 404, code: 'chat_disabled' });
    await expect(api.agent('kb1', { query: 'x' }, new AbortController().signal)).rejects.toMatchObject({ status: 409, code: 'runInProgress' });
  });

  it('turns fetch failures into network / aborted errors', async () => {
    seedToken();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(api.me()).rejects.toMatchObject({ code: 'network' });
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' }))));
    await expect(api.me()).rejects.toMatchObject({ code: 'aborted' });
  });

  it('auth:false never attaches a bearer and does not sign out on 401', async () => {
    const { calls } = mockFetch([{ match: on('POST', '/api/chat/token'), respond: () => json({ error: 'invalid_code' }, 400) }]);
    const seen: string[] = [];
    const off = onSignOut((r) => seen.push(r));
    await expect(apiFetch('/api/chat/token', { auth: false, method: 'POST', body: '{}' })).rejects.toMatchObject({ code: 'invalid_code' });
    expect(headerOf(calls[0]!.init, 'authorization')).toBeNull();
    expect(headerOf(calls[0]!.init, 'content-type')).toBe('application/json');
    expect(seen).toEqual([]);
    off();
  });

  it('readNdjson parses lines split across chunks and ignores blank or malformed lines (TS-411)', async () => {
    const events = [{ status: 'Thinking', role: 'model' }, { status: 'Streaming', role: 'model', analysisChunk: 'héllo wörld' }, { status: 'Done', role: 'system' }];
    const res = ndjson(events, { chunkSize: 7 });
    const out: unknown[] = [];
    for await (const e of readNdjson(res)) out.push(e);
    expect(out).toEqual(events);

    const dirty = new Response('{"a":1}\n\nnot json\n{"b":2}', { status: 200 });
    const out2: unknown[] = [];
    for await (const e of readNdjson(dirty)) out2.push(e);
    expect(out2).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('propagates the AbortSignal to fetch', async () => {
    seedToken();
    const { calls } = mockFetch([{ match: on('POST', /\/agent$/), respond: () => ndjson([{ status: 'Done', role: 'system' }]) }]);
    const controller = new AbortController();
    await api.agent('kb1', { query: 'hi' }, controller.signal);
    expect(calls[0]!.init.signal).toBe(controller.signal);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ query: 'hi' });
  });
});
