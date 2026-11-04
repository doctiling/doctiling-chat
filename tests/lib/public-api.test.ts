// Spec 074 (doctiling-web) — the chat's public mode talks to /api/public/chat/{slug} (TS-020, TS-023, TS-030, TS-031).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, readNdjson } from '../../src/lib/api';
import { PUBLIC_QUESTION_TURNS, createPublicChatApi } from '../../src/lib/public-api';
import { createPublicHistory } from '../../src/lib/public-history';
import { API, json, mockFetch, ndjson, on } from '../helpers/render';

const SLUG = 'AbCdEfGhIjKlMnOpQrStUvWx';
const BASE = `/api/public/chat/${SLUG}`;

function make(over: Partial<Parameters<typeof createPublicChatApi>[0]> = {}) {
  const history = createPublicHistory();
  const api = createPublicChatApi({ apiBase: API, slug: SLUG, locale: 'es', history, getHumanToken: async () => 'human-token', ...over });
  return { api, history };
}

async function drain(res: Response) {
  const out: unknown[] = [];
  for await (const e of readNdjson(res)) out.push(e);
  return out;
}

beforeEach(() => window.localStorage.clear());

describe('public chat api', () => {
  it('names the single base from the link', async () => {
    mockFetch([{ match: on('GET', BASE), respond: () => json({ name: 'Tech Day' }) }]);
    const { api } = make();
    const { items } = await api.knowledgeBases();
    expect(items).toEqual([expect.objectContaining({ id: SLUG, name: 'Tech Day', role: 'reader' })]);
  });

  it('[TS-020] the session is the browser history, read-only', async () => {
    const { api, history } = make();
    await history.save(SLUG, [{ id: '1', role: 'user', content: 'hola' }]);
    const s = await api.session(SLUG);
    expect(s.turns.map((t) => t.content)).toEqual(['hola']);
    expect(s).toMatchObject({ pending: null, isRunning: false, access: { role: 'reader', canWrite: false } });
  });

  it('[TS-023] a question carries the recent text turns, the visitor id and the human-check token; the answer is saved in the browser', async () => {
    const { calls } = mockFetch([
      {
        match: on('POST', `${BASE}/agent`),
        respond: () =>
          ndjson([
            { status: 'Tool', role: 'tools', activity: { toolName: 'search_knowledge_base', labelKey: 'kbAgent.activity.search' } },
            { status: 'Streaming', role: 'agent', analysisChunk: 'El sábado ' },
            { status: 'Streaming', role: 'agent', analysisChunk: '21.' },
            { status: 'Done', role: 'agent' },
          ]),
      },
    ]);
    const { api, history } = make();
    await history.save(SLUG, [
      { id: '1', role: 'user', content: 'hola', activity: [{ toolName: 'x', labelKey: 'y' }] },
      { id: '2', role: 'agent', content: '¡Hola!' },
    ]);
    const events = await drain(await api.agent(SLUG, { query: '¿Cuándo es?' }, new AbortController().signal));
    expect(events).toHaveLength(4);

    const sent = JSON.parse(String(calls[0]!.init.body));
    expect(sent).toMatchObject({
      query: '¿Cuándo es?',
      history: [
        { role: 'user', content: 'hola' },
        { role: 'agent', content: '¡Hola!' },
      ],
      recaptchaToken: 'human-token',
      locale: 'es',
    });
    expect(sent.visitorId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);

    const saved = await history.load(SLUG);
    expect(saved.map((t) => [t.role, t.content])).toEqual([
      ['user', 'hola'],
      ['agent', '¡Hola!'],
      ['user', '¿Cuándo es?'],
      ['agent', 'El sábado 21.'],
    ]);
    expect(saved[3]!.activity).toEqual([{ toolName: 'search_knowledge_base', labelKey: 'kbAgent.activity.search' }]);
  });

  it.each([
    [403, 'human_check'],
    [429, 'rate_limited'],
    [429, 'daily_cap'],
    [404, 'unavailable'],
  ])('[TS-030/TS-031] a %s %s refusal surfaces as an ApiError and saves nothing', async (status, code) => {
    mockFetch([{ match: on('POST', `${BASE}/agent`), respond: () => json({ error: code, retryAfterSeconds: 30 }, status) }]);
    const { api, history } = make();
    const err = await api.agent(SLUG, { query: 'x' }, new AbortController().signal).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status, code });
    expect(await history.load(SLUG)).toEqual([]);
  });

  it('an answer that streamed nothing is not saved as an empty turn', async () => {
    mockFetch([{ match: on('POST', `${BASE}/agent`), respond: () => ndjson([{ status: 'Error', role: 'system', error: { code: 'unavailable' } }]) }]);
    const { api, history } = make();
    await drain(await api.agent(SLUG, { query: 'x' }, new AbortController().signal));
    expect((await history.load(SLUG)).map((t) => t.role)).toEqual(['user']);
  });

  it('clearing the conversation deletes it from the browser only', async () => {
    const { calls } = mockFetch([]);
    const { api, history } = make();
    await history.save(SLUG, [{ id: '1', role: 'user', content: 'a' }]);
    await api.clearSession(SLUG);
    expect(await history.load(SLUG)).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('opens a cited source through the public endpoint and lists no documents', async () => {
    mockFetch([{ match: on('GET', `${BASE}/documents/doc-1`), respond: () => json({ id: 'doc-1', title: 'Agenda', type: 'text', markdown: '#', updatedAt: null }) }]);
    const { api } = make();
    expect((await api.document(SLUG, 'doc-1')).title).toBe('Agenda');
    expect(await api.documents(SLUG)).toEqual({ items: [] });
  });

  it('refuses everything a visitor cannot do (resume a confirmation, write, account calls)', async () => {
    const { api } = make();
    await expect(api.agent(SLUG, { resume: { pendingId: 'p', approved: true } }, new AbortController().signal)).rejects.toBeInstanceOf(ApiError);
    await expect(api.createDocument(SLUG, { kind: 'empty', title: 'x' } as never)).rejects.toBeInstanceOf(ApiError);
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
    expect(api.realtimeUrl(SLUG)).toBe('');
  });

  it('sends only the last turns the server reads', async () => {
    const { calls } = mockFetch([{ match: on('POST', `${BASE}/agent`), respond: () => ndjson([{ status: 'Done', role: 'agent' }]) }]);
    const { api, history } = make();
    await history.save(SLUG, Array.from({ length: 40 }, (_, i) => ({ id: String(i), role: i % 2 ? 'agent' : 'user', content: `t${i}` }) as const));
    await drain(await api.agent(SLUG, { query: 'q' }, new AbortController().signal));
    const sent = JSON.parse(String(calls[0]!.init.body));
    expect(sent.history).toHaveLength(PUBLIC_QUESTION_TURNS);
    expect(sent.history.at(-1).content).toBe('t39');
  });

  it('asks for the human-check token on every question', async () => {
    mockFetch([{ match: on('POST', `${BASE}/agent`), respond: () => ndjson([{ status: 'Done', role: 'agent' }]) }]);
    const getHumanToken = vi.fn(async () => 'tok');
    const { api } = make({ getHumanToken });
    await drain(await api.agent(SLUG, { query: 'a' }, new AbortController().signal));
    await drain(await api.agent(SLUG, { query: 'b' }, new AbortController().signal));
    expect(getHumanToken).toHaveBeenCalledTimes(2);
  });
});

describe('no realtime for visitors', () => {
  it('subscribing with the public api opens no stream', async () => {
    const { subscribeRealtime, resetRealtime } = await import('../../src/lib/realtime');
    const opened = vi.fn();
    const Original = globalThis.EventSource;
    globalThis.EventSource = vi.fn(() => {
      opened();
      return { addEventListener: vi.fn(), close: vi.fn(), readyState: 0 };
    }) as never;
    try {
      const { api } = make();
      const off = subscribeRealtime(api, SLUG, () => {});
      off();
      expect(opened).not.toHaveBeenCalled();
    } finally {
      globalThis.EventSource = Original;
      resetRealtime();
    }
  });
});
