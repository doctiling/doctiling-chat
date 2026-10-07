// The only door to the tenant's API (contracts/chat-api.md). Adds the bearer,
// turns any 401 into a sign-out, and reads NDJSON streams line by line.
import { config } from '@/config';
import { clearToken, getToken } from './storage';

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

export type SignOutReason = 'invalid' | 'expired' | 'revoked' | 'chat_disabled' | 'self' | 'unknown';

type SignOutListener = (reason: SignOutReason) => void;
const listeners = new Set<SignOutListener>();

export function onSignOut(listener: SignOutListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Forget the token and tell the app to go back to Connect. */
export async function signOut(reason: SignOutReason): Promise<void> {
  await clearToken();
  for (const l of listeners) l(reason);
}

async function parseError(res: Response): Promise<ApiErrorBody> {
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    if (body && typeof body.error === 'string') return { error: body.error, messageKey: body.messageKey };
  } catch {
    /* no JSON body */
  }
  return { error: res.status === 404 ? 'chat_disabled' : 'unknown' };
}

const SIGN_OUT_REASONS: SignOutReason[] = ['invalid', 'expired', 'revoked', 'chat_disabled'];

export type ApiFetchInit = RequestInit & { auth?: boolean };

/**
 * fetch against `${apiOrigin}${path}`. With `auth` (default true) the bearer is
 * attached; a missing token or any 401 ends the session (FR-005, FR-006).
 * Non-2xx responses throw ApiError with the body's `error` code.
 */
export async function apiFetch(path: string, init: ApiFetchInit = {}): Promise<Response> {
  const { auth = true, headers, ...rest } = init;
  const h = new Headers(headers);
  if (auth) {
    const stored = await getToken();
    if (!stored) {
      await signOut('invalid');
      throw new ApiError(401, 'invalid');
    }
    h.set('Authorization', `Bearer ${stored.token}`);
  }
  if (rest.body && !h.has('Content-Type')) h.set('Content-Type', 'application/json');
  let res: Response;
  try {
    res = await fetch(`${config().apiOrigin}${path}`, { ...rest, headers: h });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw new ApiError(0, 'aborted');
    throw new ApiError(0, 'network');
  }
  if (res.ok) return res;
  const body = await parseError(res);
  if (res.status === 401 && auth) {
    const reason = SIGN_OUT_REASONS.includes(body.error as SignOutReason) ? (body.error as SignOutReason) : 'invalid';
    await signOut(reason);
  }
  throw new ApiError(res.status, body.error, body.messageKey);
}

export async function apiJson<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
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
  limits: { tokenExpiresAt: number };
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

export const api = {
  me: () => apiJson<MeView>('/api/chat/me'),
  knowledgeBases: () => apiJson<{ items: KnowledgeBaseItem[] }>('/api/chat/knowledge-bases'),
  session: (kbId: string) => apiJson<SessionView>(`/api/chat/knowledge-bases/${encodeURIComponent(kbId)}/session`),
  clearSession: (kbId: string) =>
    apiFetch(`/api/chat/knowledge-bases/${encodeURIComponent(kbId)}/session/clear`, { method: 'POST' }),
  document: (kbId: string, docId: string) =>
    apiJson<DocumentView>(
      `/api/chat/knowledge-bases/${encodeURIComponent(kbId)}/documents/${encodeURIComponent(docId)}`,
    ),
  /** NDJSON stream; the caller iterates with readNdjson and aborts with the signal. */
  agent: (kbId: string, body: { query: string } | { resume: { pendingId: string; approved: boolean } }, signal: AbortSignal) =>
    apiFetch(`/api/chat/knowledge-bases/${encodeURIComponent(kbId)}/agent`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    }),
  revoke: () => apiFetch('/api/chat/token/revoke', { method: 'POST' }),
};
