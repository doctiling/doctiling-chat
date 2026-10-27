import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { THEME_KEY } from '../../src/lib/theme';
import { Settings, timeZoneOptions } from '../../src/screens/Settings';
import { json, mockFetch, on, renderApp } from '../helpers/render';

const me = { email: 'ana@tenant.test', name: 'Ana', role: 'guest', tenant: { host: 'studio.tenant.test', name: 'Tenant Co' } };
const tz = (timezone: string | null) => ({ timezone, instanceTimezone: 'America/Bogota', effective: timezone ?? 'America/Bogota' });

// spec 068 US6 (doctiling-web): theme = device preference, applied at once; time zone = studio-wide
// preference through GET/PUT /api/me/timezone, "instance" = null. [FR-028..030]
describe('Settings — theme (spec 068)', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
  });

  it('offers light / dark / device, marks the active one and switches without a reload', async () => {
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json(me) }, { match: on('GET', '/api/me/timezone'), respond: () => json(tz(null)) }]);
    renderApp(<Settings />);
    const group = screen.getByRole('group', { name: 'Theme' });
    const buttons = ['Light', 'Dark', 'Device'].map((n) => screen.getByRole('button', { name: n }));
    expect(buttons).toHaveLength(3);
    for (const b of buttons) expect(group).toContainElement(b);
    expect(buttons[2]).toHaveAttribute('aria-pressed', 'true');
    expect(buttons[2]).toHaveAttribute('aria-current', 'true');
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(buttons[1]!);
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(buttons[2]).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');

    fireEvent.click(buttons[0]!);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('starts on the stored choice and each option carries a tooltip (es)', async () => {
    window.localStorage.setItem(THEME_KEY, 'dark');
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json(me) }, { match: on('GET', '/api/me/timezone'), respond: () => json(tz(null)) }]);
    renderApp(<Settings />, { language: 'es' });
    const dark = screen.getByRole('button', { name: 'Oscuro' });
    expect(dark).toHaveAttribute('aria-pressed', 'true');
    act(() => screen.getByRole('button', { name: 'Dispositivo' }).focus());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/dispositivo/i);
  });
});

describe('Settings — time zone (spec 068 US6)', () => {
  it('loads the person\'s zone from the API and shows the effective one', async () => {
    mockFetch([{ match: on('GET', '/api/chat/me'), respond: () => json(me) }, { match: on('GET', '/api/me/timezone'), respond: () => json(tz('Europe/Madrid')) }]);
    renderApp(<Settings />);
    const select = (await screen.findByTestId('timezone-select')) as HTMLSelectElement;
    await waitFor(() => expect(select).not.toBeDisabled());
    expect(select.value).toBe('Europe/Madrid');
    expect(screen.getByTestId('timezone-effective')).toHaveTextContent('Effective: Europe/Madrid');
    expect(screen.getByRole('option', { name: 'Instance zone (America/Bogota)' })).toBeInTheDocument();
  });

  it('saving calls PUT with the chosen zone, and null for "instance"', async () => {
    let stored: string | null = null;
    const { calls } = mockFetch([
      { match: on('GET', '/api/chat/me'), respond: () => json(me) },
      { match: on('GET', '/api/me/timezone'), respond: () => json(tz(stored)) },
      {
        match: on('PUT', '/api/me/timezone'),
        respond: (_url, init) => {
          stored = (JSON.parse(String(init.body)) as { timezone: string | null }).timezone;
          return json(tz(stored));
        },
      },
    ]);
    renderApp(<Settings />, { language: 'es' });
    const select = (await screen.findByTestId('timezone-select')) as HTMLSelectElement;
    await waitFor(() => expect(select).not.toBeDisabled());
    expect(select.value).toBe('');

    fireEvent.change(select, { target: { value: 'America/Lima' } });
    await waitFor(() => expect(screen.getByTestId('timezone-effective')).toHaveTextContent('En uso: America/Lima'));
    const puts = calls.filter((c) => c.init.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0]!.url).toBe('https://studio.tenant.test/api/me/timezone');
    expect(JSON.parse(String(puts[0]!.init.body))).toEqual({ timezone: 'America/Lima' });
    expect(select.value).toBe('America/Lima');

    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(screen.getByTestId('timezone-effective')).toHaveTextContent('En uso: America/Bogota'));
    expect(JSON.parse(String(calls.filter((c) => c.init.method === 'PUT')[1]!.init.body))).toEqual({ timezone: null });
    expect(select.value).toBe('');
  });

  it('a rejected zone (400 invalid_timezone) shows an error, never an alert', async () => {
    mockFetch([
      { match: on('GET', '/api/chat/me'), respond: () => json(me) },
      { match: on('GET', '/api/me/timezone'), respond: () => json(tz(null)) },
      { match: on('PUT', '/api/me/timezone'), respond: () => json({ error: 'invalid_timezone' }, 400) },
    ]);
    renderApp(<Settings />);
    const select = (await screen.findByTestId('timezone-select')) as HTMLSelectElement;
    await waitFor(() => expect(select).not.toBeDisabled());
    fireEvent.change(select, { target: { value: 'UTC' } });
    expect(await screen.findByText('Your time zone could not be saved. Try again.')).toHaveAttribute('role', 'alert');
  });

  it('a missing studio route (bare 404 on /api/me/*) is a load error, not a disabled chat', async () => {
    let disabled = false;
    mockFetch([
      { match: on('GET', '/api/chat/me'), respond: () => json(me) },
      { match: on('GET', '/api/me/timezone'), respond: () => new Response(null, { status: 404 }) },
    ]);
    renderApp(<Settings />, { api: { onDisabled: () => (disabled = true) } });
    expect(await screen.findByText('Your time zone could not be loaded.')).toBeInTheDocument();
    expect(disabled).toBe(false);
  });

  it('timeZoneOptions lists IANA zones from Intl, with the instance zone among them', () => {
    const zones = timeZoneOptions();
    expect(zones.length).toBeGreaterThan(10);
    expect(zones).toContain('America/Bogota');
  });
});
