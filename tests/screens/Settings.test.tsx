import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Settings } from '@/screens/Settings';
import { onSignOut } from '@/lib/api';
import { getPrefs, getToken, setPrefs } from '@/lib/storage';
import { empty, headerOf, json, mockFetch, on, renderApp, seedToken, setConfig } from '../helpers/render';

const me = { email: 'ana@tenant.test', name: 'Ana', role: 'guest', tenant: { host: 'studio.tenant.test', name: 'Tenant Co' }, limits: { tokenExpiresAt: Date.UTC(2026, 10, 6) } };

// T068 — account from /me, language, version, sign out → revoke + clearAll → Connect. [TS-399, TS-434]
describe('Settings (T068)', () => {
  beforeEach(() => {
    setConfig({ version: '0.1.0-test' });
    seedToken('dct_chat_me');
  });

  it('shows the account, organisation, role and version', async () => {
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json(me) }]);
    renderApp(<Settings />);
    expect(await screen.findByText('Ana · ana@tenant.test')).toBeInTheDocument();
    expect(screen.getByText(/Tenant Co \(studio.tenant.test\) · Guest/)).toBeInTheDocument();
    expect(screen.getByTestId('version')).toHaveTextContent('0.1.0-test');
  });

  it('switches the language and persists it', async () => {
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json(me) }]);
    renderApp(<Settings />);
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Español' }));
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument();
    expect(getPrefs().language).toBe('es');
  });

  it('Sign out revokes on the server with the bearer, clears everything but the language, and signs out (TS-399, TS-434)', async () => {
    setPrefs({ language: 'es', lastKbId: 'kb1', iosHintDismissed: true });
    const { calls } = mockFetch([
      { match: on('GET', '/api/chat/me'), respond: () => json(me) },
      { match: on('POST', '/api/chat/token/revoke'), respond: () => empty(204) },
    ]);
    const reasons: string[] = [];
    const off = onSignOut((r) => reasons.push(r));
    renderApp(<Settings />, { language: 'es' });
    await screen.findByText('Ana · ana@tenant.test');
    const button = screen.getByTestId('sign-out');
    expect(button).toHaveAttribute('aria-describedby');
    await userEvent.setup().dblClick(button);
    await waitFor(() => expect(reasons).toEqual(['self']));
    const revoke = calls.filter((c) => c.url.endsWith('/api/chat/token/revoke'));
    expect(revoke).toHaveLength(1);
    expect(headerOf(revoke[0]!.init, 'authorization')).toBe('Bearer dct_chat_me');
    expect(await getToken()).toBeNull();
    expect(getPrefs()).toEqual({ language: 'es' });
    off();
  });

  it('still clears locally when the revoke call fails', async () => {
    mockFetch([
      { match: on('GET', '/api/chat/me'), respond: () => json(me) },
      { match: on('POST', '/api/chat/token/revoke'), respond: () => json({ error: 'unknown' }, 500) },
    ]);
    const reasons: string[] = [];
    const off = onSignOut((r) => reasons.push(r));
    renderApp(<Settings />);
    await screen.findByText('Ana · ana@tenant.test');
    await userEvent.setup().click(screen.getByTestId('sign-out'));
    await waitFor(() => expect(reasons).toEqual(['self']));
    expect(await getToken()).toBeNull();
    off();
  });
});
