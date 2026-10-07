import { beforeEach, describe, expect, it } from 'vitest';
import { challengeFor, connectUrl, handleCallback, prepareConnect, STATE_KEY, startConnect, VERIFIER_KEY } from '@/lib/connect';
import { getToken } from '@/lib/storage';
import { API, headerOf, json, mockFetch, on, setConfig } from '../helpers/render';

const b64url = /^[A-Za-z0-9_-]+$/;

// T058 — hand-off: verifier/challenge/state, callback happy path, state mismatch, error mapping.
// [TS-381, TS-382, TS-422, TS-423]
describe('connect (T058)', () => {
  beforeEach(() => setConfig());

  it('generates a 43-char base64url verifier, an S256 challenge and a state, kept in sessionStorage (TS-422)', async () => {
    const start = await prepareConnect('es');
    expect(start.verifier).toMatch(b64url);
    expect(start.verifier).toHaveLength(43);
    expect(start.challenge).toMatch(b64url);
    expect(start.challenge).toHaveLength(43);
    expect(start.challenge).toBe(await challengeFor(start.verifier));
    expect(start.state).toMatch(b64url);
    expect(sessionStorage.getItem(VERIFIER_KEY)).toBe(start.verifier);
    expect(sessionStorage.getItem(STATE_KEY)).toBe(start.state);
    const url = new URL(start.url);
    expect(url.origin + url.pathname).toBe(`${API}/es/chat-connect`);
    expect(url.searchParams.get('challenge')).toBe(start.challenge);
    expect(url.searchParams.get('state')).toBe(start.state);
  });

  it('S256 is the RFC 7636 transform (known vector)', async () => {
    // RFC 7636 appendix B
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('startConnect navigates top-level to the studio', async () => {
    const seen: string[] = [];
    const start = await startConnect('en', (u) => seen.push(u));
    expect(seen).toEqual([start.url]);
    expect(connectUrl('en', 'c', 's')).toBe(`${API}/en/chat-connect?challenge=c&state=s`);
  });

  it('callback happy path: verifies state, exchanges code + verifier, stores the token, clears sessionStorage (TS-381, TS-423)', async () => {
    const start = await prepareConnect('en');
    const { calls } = mockFetch([
      {
        match: on('POST', '/api/chat/token'),
        respond: () => json({ token: 'dct_chat_new', expiresAt: 1234, me: { email: 'ana@tenant.test', name: null, role: 'guest', tenant: { host: 'studio.tenant.test', name: 'Tenant' }, limits: { tokenExpiresAt: 1234 } } }),
      },
    ]);
    const res = await handleCallback(`https://chat.tenant.test/connect/callback?code=CODE123&state=${start.state}`);
    expect(res.token).toBe('dct_chat_new');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ code: 'CODE123', codeVerifier: start.verifier });
    expect(headerOf(calls[0]!.init, 'authorization')).toBeNull();
    expect(await getToken()).toEqual({ token: 'dct_chat_new', expiresAt: 1234, apiOrigin: API });
    expect(sessionStorage.getItem(VERIFIER_KEY)).toBeNull();
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
  });

  it('state mismatch → no exchange, no token, material cleared (TS-422)', async () => {
    await prepareConnect('en');
    const { calls } = mockFetch([]);
    await expect(handleCallback('/connect/callback?code=X&state=forged')).rejects.toMatchObject({ code: 'state_mismatch' });
    expect(calls).toHaveLength(0);
    expect(await getToken()).toBeNull();
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
  });

  it('a callback without a prepared hand-off is a state mismatch too', async () => {
    const { calls } = mockFetch([]);
    await expect(handleCallback('/connect/callback?code=X&state=s')).rejects.toMatchObject({ code: 'state_mismatch' });
    expect(calls).toHaveLength(0);
  });

  it('maps API errors: invalid_code (400), rate_limited (429), chat_disabled (404), network', async () => {
    for (const [status, body, code] of [
      [400, { error: 'invalid_code' }, 'invalid_code'],
      [429, { error: 'rate_limited' }, 'rate_limited'],
      [404, null, 'chat_disabled'],
    ] as const) {
      const start = await prepareConnect('en');
      mockFetch([{ match: on('POST', '/api/chat/token'), respond: () => (body ? json(body, status) : new Response(null, { status })) }]);
      await expect(handleCallback(`/connect/callback?code=X&state=${start.state}`)).rejects.toMatchObject({ code });
      expect(await getToken()).toBeNull();
    }
    const start = await prepareConnect('en');
    mockFetch([{ match: on('POST', '/api/chat/token'), respond: () => Promise.reject(new TypeError('offline')) }]);
    await expect(handleCallback(`/connect/callback?code=X&state=${start.state}`)).rejects.toMatchObject({ code: 'network' });
  });
});
