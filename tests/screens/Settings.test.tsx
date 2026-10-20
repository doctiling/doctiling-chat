import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SpeechProvider } from '../../src/lib/speech';
import { Settings, localeHref } from '../../src/screens/Settings';
import { HOST, json, mockFetch, on, renderApp } from '../helpers/render';

const me = { email: 'ana@tenant.test', name: 'Ana', role: 'guest', tenant: { host: 'studio.tenant.test', name: 'Tenant Co' } };

// T068 — account from /me (no token limits), language = link to the other locale's basePath, version,
// sign out = plain link to the studio's signOutHref (one session). [TS-399, TS-434]
describe('Settings (T068)', () => {
  it('shows the account, organisation, role and version', async () => {
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json(me) }]);
    renderApp(<Settings />);
    expect(await screen.findByText('Ana · ana@tenant.test')).toBeInTheDocument();
    expect(screen.getByText(/Tenant Co \(studio.tenant.test\) · Guest/)).toBeInTheDocument();
    expect(screen.getByTestId('version')).toHaveTextContent(HOST.version);
    expect(screen.getByRole('link', { name: /open the studio/i })).toHaveAttribute('href', HOST.studioHref);
  });

  it('going to the studio is remembered as the choice, so the phone stops sending the person back to the chat', async () => {
    window.localStorage.clear();
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json(me) }]);
    renderApp(<Settings />);
    await screen.findByText('Ana · ana@tenant.test');
    const link = screen.getByRole('link', { name: /open the studio/i });
    link.addEventListener('click', (e) => e.preventDefault()); // jsdom cannot navigate
    fireEvent.click(link);
    expect(JSON.parse(window.localStorage.getItem('doctiling-chat:prefs') ?? '{}').entry).toBe('studio');
  });

  it('the language toggle links to the same route under the other locale, the current one is not a link', async () => {
    window.history.replaceState(null, '', '/es/chat/settings');
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json(me) }]);
    renderApp(<Settings />, { language: 'es' });
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument();
    const en = screen.getByTestId('language-en');
    expect(en).toHaveAttribute('href', '/en/chat/settings');
    expect(en).toHaveAttribute('hreflang', 'en');
    expect(screen.queryByTestId('language-es')).not.toBeInTheDocument();
    expect(screen.getByText('Español')).toHaveAttribute('aria-current', 'true');
  });

  it('localeHref swaps only the locale segment of basePath and keeps the sub-route', () => {
    expect(localeHref('/es/chat', '/es/chat/kb/x', 'en')).toBe('/en/chat/kb/x');
    expect(localeHref('/en/chat', '/en/chat', 'es')).toBe('/es/chat');
    expect(localeHref('/en/chat', '/en/chat', 'en')).toBeNull();
    expect(localeHref('/chat', '/chat/settings', 'en')).toBeNull();
  });

  it('Sign out is a link to the studio signOutHref with a tooltip, no API call (TS-399, TS-434)', async () => {
    const { calls } = mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json(me) }]);
    renderApp(<Settings />, { language: 'es' });
    await screen.findByText('Ana · ana@tenant.test');
    const link = screen.getByTestId('sign-out');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', HOST.signOutHref);
    expect(link).toHaveTextContent('Cerrar sesión');
    act(() => link.focus());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/sesión del estudio/i);
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(0);
  });

  it('a failed /me (not 401, not disabled) shows the account error', async () => {
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json({ error: 'unknown' }, 500) }]);
    renderApp(<Settings />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i);
  });
});

// spec 057 US5: voice mode is a device preference, offered only where the browser can speak.
describe('Settings — voice mode', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'speechSynthesis');
    window.localStorage.clear();
  });

  it('lets the person turn on reading new replies aloud and remembers it', async () => {
    Object.defineProperty(window, 'speechSynthesis', { value: { speak() {}, cancel() {}, pause() {}, resume() {}, getVoices: () => [] }, configurable: true });
    mockFetch([]);
    renderApp(
      <SpeechProvider language="en">
        <Settings />
      </SpeechProvider>,
    );
    const toggle = screen.getByRole('switch', { name: 'Read new replies aloud' });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(JSON.parse(window.localStorage.getItem('doctiling-chat:prefs') ?? '{}').voiceReplies).toBe(true);
  });

  it('says so, with no switch, when the browser cannot read aloud', () => {
    Reflect.deleteProperty(window, 'speechSynthesis');
    mockFetch([]);
    renderApp(<Settings />);
    expect(screen.getByText('This browser cannot read aloud.')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
