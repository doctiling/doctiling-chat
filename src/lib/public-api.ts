import type { Language } from '../i18n';
import {
  ApiError,
  type Activity,
  type AgentEvent,
  type ChatApi,
  type DocumentView,
  type KnowledgeBaseItem,
  type SessionView,
  type Turn,
} from './api';
import { visitorId as browserVisitorId, type PublicHistory } from './public-history';

// Spec 074 (doctiling-web): the same ChatApi the conversation screen uses, for a
// visitor of one public chat. The server keeps nothing: the session is the
// browser's history, each question carries its recent turns, and the answer is
// saved back in the browser as it finishes streaming.

export type PublicChatApiConfig = {
  apiBase?: string;
  slug: string;
  locale: Language;
  history: PublicHistory;
  /** A fresh human-check token per question (the host owns the captcha); undefined when none is configured. */
  getHumanToken?: () => Promise<string | undefined>;
  visitorId?: () => string;
};

/** Turns sent with a question; matches the server's cap. */
export const PUBLIC_QUESTION_TURNS = 12;

let turnCounter = 0;
const turnId = () => `public-${Date.now().toString(36)}-${(turnCounter++).toString(36)}`;

const notForVisitors = () => Promise.reject(new ApiError(403, 'forbidden'));

export function createPublicChatApi(config: PublicChatApiConfig): ChatApi {
  const base = `${(config.apiBase ?? '').replace(/\/+$/, '')}/api/public/chat/${encodeURIComponent(config.slug)}`;
  const visitor = config.visitorId ?? browserVisitorId;

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        ...init,
        headers: { Accept: 'application/json, application/x-ndjson', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
        credentials: 'omit',
      });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw new ApiError(0, 'aborted');
      throw new ApiError(0, 'network');
    }
    if (res.ok) return res;
    let code = 'unknown';
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === 'string') code = body.error;
    } catch {
      /* no JSON body */
    }
    throw new ApiError(res.status, code);
  }

  // Passes the NDJSON through untouched and, when it ends, stores the question
  // and the answer the visitor saw (text + activity) in the browser.
  function persistWhileStreaming(res: Response, prior: Turn[], query: string): Response {
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    const activity: Activity[] = [];
    const read = (line: string) => {
      if (!line.trim()) return;
      try {
        const ev = JSON.parse(line) as AgentEvent;
        if (ev.status === 'Tool' && ev.activity) {
          activity.push(ev.activity as Activity);
          if (text && !/\n\s*$/.test(text)) text += '\n\n';
        }
        if (ev.status === 'Streaming' && ev.analysisChunk) text += ev.analysisChunk;
      } catch {
        /* a partial or foreign line */
      }
    };
    const stamp = () => new Date().toISOString();
    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.forEach(read);
        controller.enqueue(chunk);
      },
      async flush() {
        read(buffer);
        const turns: Turn[] = [...prior, { id: turnId(), role: 'user', content: query, timestamp: stamp() }];
        if (text.trim() || activity.length) {
          turns.push({ id: turnId(), role: 'agent', content: text, activity, timestamp: stamp() });
        }
        await config.history.save(config.slug, turns);
      },
    });
    return new Response(res.body!.pipeThrough(transform), { status: res.status, headers: res.headers });
  }

  return {
    fetch: (path, init) => call(path, init),
    realtimeUrl: () => '',
    me: notForVisitors,
    timezone: notForVisitors,
    setTimezone: notForVisitors,
    knowledgeBases: async () => {
      const { name } = (await (await call('')).json()) as { name: string };
      const item: KnowledgeBaseItem = {
        id: config.slug,
        name,
        description: null,
        role: 'reader',
        documentCount: 0,
        updatedAt: Date.now(),
        hasPending: false,
        isRunning: false,
      };
      return { items: [item] };
    },
    session: async (): Promise<SessionView> => ({
      turns: await config.history.load(config.slug),
      actions: [],
      pending: null,
      isRunning: false,
      access: { role: 'reader', canWrite: false },
    }),
    clearSession: async () => {
      await config.history.clear(config.slug);
      return new Response(null, { status: 204 });
    },
    document: async (_kbId, docId) => (await (await call(`/documents/${encodeURIComponent(docId)}`)).json()) as DocumentView,
    // FR-008: no document list for visitors — sources open from citations only.
    documents: async () => ({ items: [] }),
    agent: async (_kbId, body, signal) => {
      if (!('query' in body)) throw new ApiError(400, 'unknown');
      const prior = await config.history.load(config.slug);
      const recaptchaToken = await config.getHumanToken?.();
      const res = await call('/agent', {
        method: 'POST',
        signal,
        body: JSON.stringify({
          query: body.query,
          // The server reads the last turns only (doctiling-web PUBLIC_HISTORY); sending more is waste.
          history: prior.slice(-PUBLIC_QUESTION_TURNS).map((t) => ({ role: t.role, content: t.content })),
          visitorId: visitor(),
          ...(recaptchaToken ? { recaptchaToken } : {}),
          locale: config.locale,
        }),
      });
      return persistWhileStreaming(res, prior, body.query);
    },
    createDocument: notForVisitors,
    convertDocument: notForVisitors,
    generateDocument: notForVisitors,
    indexDocuments: notForVisitors,
  };
}
