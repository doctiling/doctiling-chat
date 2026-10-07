import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOST, json, mockFetch, notEnabled, on, renderChatApp } from '../helpers/render';

const items = [{ id: 'kb-pol', name: 'Políticas', description: null, role: 'reader', documentCount: 2, updatedAt: 1, hasPending: false, isRunning: false }];

// jsdom's window.location.assign is "not implemented": swap the whole object for a recording stub.
function stubLocation(pathname: string, search = '') {
  const assign = vi.fn();
  const original = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...original, href: `${original.origin}${pathname}${search}`, pathname, search, assign, replace: vi.fn(), reload: vi.fn() },
  });
  return { assign, restore: () => Object.defineProperty(window, 'location', { configurable: true, value: original }) };
}

// T075 — the host contract: own router under basePath, locale from the host, 401 → studio sign-in with
// return URL, bare 404 → "not enabled" screen with a link to the studio. [TS-389, TS-396, FR-002, FR-027]
describe('ChatApp (T075)', () => {
  let restore: (() => void) | null = null;
  afterEach(() => {
    restore?.();
    restore = null;
  });

  it('renders the list under basePath in the host locale and routes to a base without leaving basePath', async () => {
    mockFetch([
      { match: on('GET', '/api/chat/knowledge-bases'), respond: () => json({ items }) },
      { match: on('GET', /\/session$/), respond: () => json({ turns: [], actions: [], pending: null, isRunning: false }) },
    ]);
    renderChatApp();
    expect(await screen.findByRole('heading', { name: 'Bases de conocimiento' })).toBeInTheDocument();
    await userEvent.setup().click(await screen.findByText('Políticas'));
    expect(window.location.pathname).toBe('/es/chat/kb/kb-pol');
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('a 401 from the API sends the person to signInHref with the current path as callbackUrl (TS-389)', async () => {
    const loc = stubLocation('/es/chat/kb', '?tab=1');
    restore = loc.restore;
    mockFetch([{ match: on('GET', '/api/chat/knowledge-bases'), respond: () => json({ error: 'unauthenticated' }, 401) }]);
    renderChatApp();
    await waitFor(() => expect(loc.assign).toHaveBeenCalledTimes(1));
    expect(loc.assign).toHaveBeenCalledWith(`${HOST.signInHref}?callbackUrl=${encodeURIComponent('/es/chat/kb?tab=1')}`);
    // No error is shown: the page is leaving.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a bare 404 from /api/chat/* shows the "not enabled" screen with a link to the studio (FR-027)', async () => {
    mockFetch([{ match: on('GET', '/api/chat/knowledge-bases'), respond: notEnabled }]);
    renderChatApp({ locale: 'en', basePath: '/en/chat', studioHref: '/en/kb' });
    const panel = await screen.findByTestId('not-enabled');
    expect(panel).toHaveTextContent('The chat is not enabled here');
    expect(screen.getByRole('link', { name: 'Go to the studio' })).toHaveAttribute('href', '/en/kb');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('reads the route from the URL on load (deep link to a conversation) and shows Settings with the version', async () => {
    window.history.replaceState(null, '', '/es/chat/settings');
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json({ email: 'ana@tenant.test', name: 'Ana', role: 'guest', tenant: { host: 'studio.tenant.test', name: 'Tenant Co' } }) }]);
    renderChatApp({ version: '9.9.9' });
    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeInTheDocument();
    expect(screen.getByTestId('version')).toHaveTextContent('9.9.9');
    expect(screen.getByTestId('sign-out')).toHaveAttribute('href', HOST.signOutHref);
  });
});
