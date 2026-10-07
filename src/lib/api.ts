// The only door to the tenant's API (contracts/chat-api.md). Same origin, the
// studio session cookie is the credential: a 401 sends the person to the
// studio's sign-in with a return URL; a bare 404 on /api/chat/* means the chat
// is not enabled for this tenant. NDJSON streams are read line by line.

export type ApiErrorBody = { error: string; messageKey?: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? `${status} ${code}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type ChatApiConfig = {
  /** Prefix of the API, '' for the same origin (default) or an origin in tests. */
  apiBase?: string;
  /** Studio sign-in page; gets `?callbackUrl=<current path>` appended on 401. */
  signInHref: string;
  /** Called once when a /api/chat/* route answers 404 without a body (chat disabled, FR-027). */
  onDisabled?: () => void;
  /** Top-level navigation (default window.location.assign); injectable for tests. */
  navigateTo?: (url: string) => void;
};

async function parseError(res: Response): Promise<ApiErrorBody | null> {
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    if (body && typeof body.error === 'string') return { error: body.error, messageKey: body.messageKey };
  } catch {
    /* no JSON body */
  }
  return null;
}

export function signInUrl(signInHref: string, currentUrl: string): string {
  const sep = signInHref.includes('?') ? '&' : '?';
  return `${signInHref}${sep}callbackUrl=${encodeURIComponent(currentUrl)}`;
}

/** Port of doctiling-web `readNdjson`: one JSON per line, partial lines buffered. */
export async function* readNdjson<T>(response: Response): AsyncGenerator<T> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const parse = (line: string): T | undefined => {
    const trimmed = line.trim();
    if (!trimmed) return undefined;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return undefined;
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const parsed = parse(line);
      if (parsed !== undefined) yield parsed;
    }
  }
  const tail = parse(buffer);
  if (tail !== undefined) yield tail;
}

// ---- Typed endpoints -------------------------------------------------------

export type MeView = {
  email: string;
  name: string | null;
  role: 'admin' | 'collaborator' | 'guest';
  tenant: { host: string; name: string };
};

export type KnowledgeBaseItem = {
  id: string;
  name: string;
  description: string | null;
  role: 'owner' | 'admin' | 'collaborator' | 'reader';
  documentCount: number;
  updatedAt: number;
  hasPending: boolean;
  isRunning: boolean;
};

export type Activity = { toolName: string; labelKey: string; target?: string };

export type Turn = {
  id: string;
  role: 'user' | 'agent';
  content: string;
  activity?: Activity[];
  timestamp?: string;
  createdAt?: string;
};

export type Pending = {
  id: string;
  toolName: string;
  summaryKey: string;
  summaryValues: Record<string, string>;
  turnId?: string;
  createdAt?: string;
};

export type SessionView = {
  turns: Turn[];
  actions: unknown[];
  pending: Pending | null;
  isRunning: boolean;
  config?: unknown;
};

export type AgentEvent = {
  status: 'Thinking' | 'Tool' | 'Applied' | 'Streaming' | 'Confirm' | 'Truncated' | 'Notice' | 'Done' | 'Error';
  role: 'model' | 'tools' | 'system';
  analysisChunk?: string;
  activity?: Activity;
  action?: unknown;
  pending?: Pending;
  noticeKey?: string;
  error?: { code: string; message?: string };
};

export type DocumentView = {
  id: string;
  title: string;
  type: 'text' | 'database' | 'graph';
  markdown: string;
  updatedAt: number | null;
};

export type AgentBody = { query: string } | { resume: { pendingId: string; approved: boolean } };

export type ChatApi = {
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  me: () => Promise<MeView>;
  knowledgeBases: () => Promise<{ items: KnowledgeBaseItem[] }>;
  session: (kbId: string) => Promise<SessionView>;
  clearSession: (kbId: string) => Promise<Response>;
  document: (kbId: string, docId: string) => Promise<DocumentView>;
  /** NDJSON stream; the caller iterates with readNdjson and aborts with the signal. */
  agent: (kbId: string, body: AgentBody, signal: AbortSignal) => Promise<Response>;
};

export function createChatApi({ apiBase = '', signInHref, onDisabled, navigateTo }: ChatApiConfig): ChatApi {
  const base = apiBase.replace(/\/+$/, '');
  const go = navigateTo ?? ((url: string) => window.location.assign(url));
  let disabledSeen = false;

  /**
   * fetch against `${apiBase}${path}` with the session cookie. 401 → studio
   * sign-in with return (FR-002); bare 404 → chat disabled (FR-027). Other
   * non-2xx responses throw ApiError with the body's `error` code.
   */
  async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { headers, ...rest } = init;
    const h = new Headers(headers);
    h.set('Accept', h.get('Accept') ?? 'application/json, application/x-ndjson');
    if (rest.body && !h.has('Content-Type')) h.set('Content-Type', 'application/json');
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, { ...rest, headers: h, credentials: 'same-origin' });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw new ApiError(0, 'aborted');
      throw new ApiError(0, 'network');
    }
    if (res.ok) return res;
    const body = await parseError(res);
    if (res.status === 401) {
      go(signInUrl(signInHref, `${window.location.pathname}${window.location.search}`));
      throw new ApiError(401, body?.error ?? 'unauthenticated', body?.messageKey);
    }
    if (res.status === 404 && !body) {
      if (!disabledSeen) {
        disabledSeen = true;
        onDisabled?.();
      }
      throw new ApiError(404, 'chat_disabled');
    }
    throw new ApiError(res.status, body?.error ?? 'unknown', body?.messageKey);
  }

  async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(path, init);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const kb = (kbId: string) => `/api/chat/knowledge-bases/${encodeURIComponent(kbId)}`;

  return {
    fetch: apiFetch,
    me: () => apiJson<MeView>('/api/chat/me'),
    knowledgeBases: () => apiJson<{ items: KnowledgeBaseItem[] }>('/api/chat/knowledge-bases'),
    session: (kbId) => apiJson<SessionView>(`${kb(kbId)}/session`),
    clearSession: (kbId) => apiFetch(`${kb(kbId)}/session/clear`, { method: 'POST' }),
    document: (kbId, docId) => apiJson<DocumentView>(`${kb(kbId)}/documents/${encodeURIComponent(docId)}`),
    agent: (kbId, body, signal) => apiFetch(`${kb(kbId)}/agent`, { method: 'POST', body: JSON.stringify(body), signal }),
  };
}
