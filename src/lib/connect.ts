// The session hand-off (plan § A, contracts/chat-api.md § Traspaso): PKCE-style
// verifier/challenge generated here, `state` against CSRF, both only in
// sessionStorage while the hand-off is in flight.
import { config } from '@/config';
import { ApiError, apiFetch, type MeView } from './api';
import { setToken, type Language } from './storage';

export const VERIFIER_KEY = 'doctiling-chat:connect:verifier';
export const STATE_KEY = 'doctiling-chat:connect:state';

export function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomBase64url(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** S256: base64url(SHA-256(verifier)) with WebCrypto. */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export type ConnectStart = { verifier: string; challenge: string; state: string; url: string };

export function connectUrl(locale: Language, challenge: string, state: string): string {
  const params = new URLSearchParams({ challenge, state });
  return `${config().apiOrigin}/${locale}/chat-connect?${params.toString()}`;
}

/**
 * Generate the hand-off material, keep it in sessionStorage and return the
 * studio URL to navigate to (top-level; the studio redirects back to
 * /connect/callback?code&state).
 */
export async function prepareConnect(locale: Language): Promise<ConnectStart> {
  const verifier = randomBase64url(32); // 43 chars
  const challenge = await challengeFor(verifier);
  const state = randomBase64url(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  return { verifier, challenge, state, url: connectUrl(locale, challenge, state) };
}

export async function startConnect(locale: Language, navigate: (url: string) => void = (u) => window.location.assign(u)) {
  const start = await prepareConnect(locale);
  navigate(start.url);
  return start;
}

export type CallbackErrorCode = 'state_mismatch' | 'missing_code' | 'invalid_code' | 'rate_limited' | 'chat_disabled' | 'network' | 'unknown';

export class CallbackError extends Error {
  readonly code: CallbackErrorCode;
  constructor(code: CallbackErrorCode) {
    super(code);
    this.name = 'CallbackError';
    this.code = code;
  }
}

export type TokenResponse = { token: string; expiresAt: number; me: MeView };

function clearHandoff() {
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
}

/**
 * /connect/callback?code&state → verify state, exchange the code for the
 * token (POST /api/chat/token), store it, clear the hand-off material.
 */
export async function handleCallback(url: string | URL): Promise<TokenResponse> {
  const u = typeof url === 'string' ? new URL(url, window.location.origin) : url;
  const code = u.searchParams.get('code') ?? '';
  const state = u.searchParams.get('state') ?? '';
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!expectedState || !verifier || state !== expectedState) {
    clearHandoff();
    throw new CallbackError('state_mismatch');
  }
  if (!code) {
    clearHandoff();
    throw new CallbackError('missing_code');
  }
  try {
    const res = await apiFetch('/api/chat/token', {
      auth: false,
      method: 'POST',
      body: JSON.stringify({ code, codeVerifier: verifier }),
    });
    const data = (await res.json()) as TokenResponse;
    await setToken({ token: data.token, expiresAt: data.expiresAt, apiOrigin: config().apiOrigin });
    return data;
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.code === 'invalid_code' || e.code === 'rate_limited' || e.code === 'chat_disabled' || e.code === 'network') {
        throw new CallbackError(e.code);
      }
      throw new CallbackError('unknown');
    }
    throw new CallbackError('unknown');
  } finally {
    clearHandoff();
  }
}
