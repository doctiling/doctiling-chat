import { describe, expect, it, vi } from 'vitest';
import { ApiError, createChatApi, readNdjson, signInUrl } from '../../src/lib/api';
import { API, headerOf, json, mockFetch, ndjson, notEnabled, on } from '../helpers/render';

const make = (over: Partial<Parameters<typeof createChatApi>[0]> = {}) =>
  createChatApi({ apiBase: API, signInHref: '/es/signin', navigateTo: vi.fn(), ...over });

// T057 — same-origin fetch with the session cookie, 401 → studio sign-in with return URL,
// bare 404 → chat disabled, NDJSON reader with partial lines, AbortController. [TS-389, TS-399, TS-411]
describe('api (T057)', () => {
  it('calls `${apiBase}${path}` with credentials and no bearer (TS-399)', async () => {
    const { calls } = mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json({ email: 'ana@tenant.test' }) }]);
    const me = await make().me();
    expect(me.email).toBe('ana@tenant.test');
    expect(calls[0]?.url).toBe(`${API}/api/chat/me`);
    expect(calls[0]?.init.credentials).toBe('same-origin');
    expect(headerOf(calls[0]!.init, 'authorization')).toBeNull();
  });

  it('a 401 sends the person to the studio sign-in with the current path as callbackUrl (TS-389)', async () => {
    window.history.replaceState(null, '', '/es/chat/kb/kb-pol?x=1');
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json({ error: 'unauthenticated' }, 401) }]);
    const navigateTo = vi.fn();
    await expect(make({ navigateTo }).me()).rejects.toMatchObject({ status: 401, code: 'unauthenticated' });
    expect(navigateTo).toHaveBeenCalledWith(`/es/signin?callbackUrl=${encodeURIComponent('/es/chat/kb/kb-pol?x=1')}`);
  });

  it('signInUrl appends with & when the sign-in href already has a query', () => {
    expect(signInUrl('/es/signin?from=chat', '/es/chat')).toBe('/es/signin?from=chat&callbackUrl=%2Fes%2Fchat');
  });

  it('a bare 404 on /api/chat/* means the chat is disabled: onDisabled once, code chat_disabled (FR-027)', async () => {
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: notEnabled }, { match: on('GET', '/api/chat/knowledge-bases'), respond: notEnabled }]);
    const onDisabled = vi.fn();
    const api = make({ onDisabled });
    await expect(api.me()).rejects.toMatchObject({ status: 404, code: 'chat_disabled' });
    await expect(api.knowledgeBases()).rejects.toMatchObject({ status: 404, code: 'chat_disabled' });
    expect(onDisabled).toHaveBeenCalledTimes(1);
  });

  it('a 404 WITH an error body is an ordinary not-found, and other codes are kept', async () => {
    mockFetch([
      { match: on('GET', /\/documents\/gone$/), respond: () => json({ error: 'not_found' }, 404) },
      { match: on('POST', /\/agent$/), respond: () => json({ error: 'runInProgress', messageKey: 'k' }, 409) },
    ]);
    const onDisabled = vi.fn();
    const api = make({ onDisabled });
    await expect(api.document('kb1', 'gone')).rejects.toMatchObject({ status: 404, code: 'not_found' });
    await expect(api.agent('kb1', { query: 'x' }, new AbortController().signal)).rejects.toMatchObject({ status: 409, code: 'runInProgress' });
    expect(onDisabled).not.toHaveBeenCalled();
  });

  it('turns fetch failures into network / aborted errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(make().me()).rejects.toMatchObject({ code: 'network' });
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' }))));
    await expect(make().me()).rejects.toMatchObject({ code: 'aborted' });
  });

  it('sets Content-Type for JSON bodies and throws ApiError instances', async () => {
    const { calls } = mockFetch([{ match: on('POST', /\/session\/clear$/), respond: () => json({ error: 'runInProgress' }, 409) }]);
    const err = await make().clearSession('kb1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(headerOf(calls[0]!.init, 'content-type')).toBeNull();
    mockFetch([{ match: on('POST', /\/agent$/), respond: () => ndjson([{ status: 'Done', role: 'system' }]) }]);
    await make().agent('kb1', { query: 'hi' }, new AbortController().signal);
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

  it('propagates the AbortSignal and the JSON body to fetch', async () => {
    const { calls } = mockFetch([{ match: on('POST', /\/agent$/), respond: () => ndjson([{ status: 'Done', role: 'system' }]) }]);
    const controller = new AbortController();
    await make().agent('kb1', { query: 'hi' }, controller.signal);
    expect(calls[0]!.init.signal).toBe(controller.signal);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ query: 'hi' });
    expect(headerOf(calls[0]!.init, 'content-type')).toBe('application/json');
  });

  it('[TS-461][TS-462] GET …/documents lists the base; referencedDocumentIds travel next to the query', async () => {
    const { calls } = mockFetch([
      { match: on('GET', /\/documents$/), respond: () => json({ items: [{ id: 'd1', title: 'T', type: 'text', visibility: 'shared', indexed: true }] }) },
      { match: on('POST', /\/agent$/), respond: () => ndjson([{ status: 'Done', role: 'system' }]) },
    ]);
    const api = make();
    const { items } = await api.documents('kb 1');
    expect(items).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${API}/api/chat/knowledge-bases/kb%201/documents`);
    await api.agent('kb1', { query: 'hi', referencedDocumentIds: ['d1', 'd2'] }, new AbortController().signal);
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ query: 'hi', referencedDocumentIds: ['d1', 'd2'] });
  });
});

// spec 054 T013 — create, convert, generate and index documents from the chat.
describe('api: documents from the chat (spec 054)', () => {
  it('createDocument posts JSON and returns the created item', async () => {
    const doc = { id: 'd1', title: 'Notas', type: 'text', visibility: 'shared', indexed: false };
    const { calls } = mockFetch([{ match: on('POST', '/api/chat/knowledge-bases/kb%201/documents'), respond: () => json({ document: doc }, 201) }]);
    const out = await make().createDocument('kb 1', { type: 'text', title: 'Notas' });
    expect(out).toEqual(doc);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ type: 'text', title: 'Notas' });
    expect(headerOf(calls[0]!.init, 'content-type')).toBe('application/json');
  });

  it('convertDocument sends the file as multipart, without forcing a JSON Content-Type', async () => {
    const { calls } = mockFetch([
      { match: on('POST', /\/kb1\/documents\/convert$/), respond: () => json({ kind: 'text', title: 'Plan', markdown: '# Plan' }) },
    ]);
    const file = new File(['%PDF'], 'Plan.pdf');
    const out = await make().convertDocument('kb1', file);
    expect(out).toEqual({ kind: 'text', title: 'Plan', markdown: '# Plan' });
    const body = calls[0]!.init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('file') as File).name).toBe('Plan.pdf');
    expect(headerOf(calls[0]!.init, 'content-type')).toBeNull();
  });

  it('convertDocument surfaces the server reason as the ApiError code', async () => {
    mockFetch([{ match: on('POST', /\/convert$/), respond: () => json({ error: 'unsupported_type' }, 415) }]);
    await expect(make().convertDocument('kb1', new File(['x'], 'a.exe'))).rejects.toMatchObject({ status: 415, code: 'unsupported_type' });
  });

  it('generateDocument returns the NDJSON stream for readNdjson', async () => {
    const { calls } = mockFetch([
      {
        match: on('POST', /\/kb1\/documents\/generate$/),
        respond: () => ndjson([{ status: 'Drafting', analysisChunk: '# A' }, { status: 'Saved', document: { id: 'd9' } }]),
      },
    ]);
    const res = await make().generateDocument('kb1', { topic: 'vacaciones', locale: 'es' }, new AbortController().signal);
    const events: { status: string }[] = [];
    for await (const e of readNdjson<{ status: string }>(res)) events.push(e);
    expect(events.map((e) => e.status)).toEqual(['Drafting', 'Saved']);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ topic: 'vacaciones', locale: 'es' });
  });

  it('indexDocuments posts the ids and returns a result per document', async () => {
    const results = [{ id: 'd1', ok: true }, { id: 'd2', ok: false, reason: 'forbidden' }];
    const { calls } = mockFetch([{ match: on('POST', /\/kb1\/documents\/index$/), respond: () => json({ results }) }]);
    expect(await make().indexDocuments('kb1', ['d1', 'd2'])).toEqual(results);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ documentIds: ['d1', 'd2'] });
  });
});
