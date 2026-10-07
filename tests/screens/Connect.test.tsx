import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Callback } from '@/screens/Callback';
import { Connect } from '@/screens/Connect';
import { prepareConnect } from '@/lib/connect';
import { API, json, mockFetch, on, renderApp, setConfig } from '../helpers/render';

// T059 — Connect screen (button with tooltip, double-tap guard, explanation) and the callback screen
// (progress, error mapping, "Open in the app" when not standalone). [TS-381, TS-436, TS-396]
describe('Connect screen (T059)', () => {
  beforeEach(() => setConfig());

  it('explains the tenant account is used and starts the hand-off once on a double tap (TS-381)', async () => {
    const navigate = vi.fn();
    renderApp(<Connect navigate={navigate} />);
    expect(screen.getByText(/uses your account in studio.tenant.test/i)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Connect' });
    expect(button).toHaveAttribute('aria-describedby');
    expect(screen.getByRole('tooltip')).toHaveTextContent(/confirm it is you/i);
    const user = userEvent.setup();
    await user.dblClick(button);
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    const url = new URL(navigate.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe(`${API}/en/chat-connect`);
    expect(url.searchParams.get('challenge')).toHaveLength(43);
    expect(button).toBeDisabled();
  });

  it('shows the reason when the person was signed out, in Spanish too', () => {
    renderApp(<Connect reason="revoked" />, { language: 'es' });
    expect(screen.getByRole('status')).toHaveTextContent('Tu acceso fue retirado');
    expect(screen.getByRole('button', { name: 'Conectar' })).toBeInTheDocument();
  });

  it('unfolds the three steps on "How does it work?"', async () => {
    renderApp(<Connect navigate={() => {}} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /how does it work/i }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('Callback screen (T059, T073)', () => {
  beforeEach(() => setConfig());

  it('shows progress, exchanges the code and calls onConnected', async () => {
    const start = await prepareConnect('en');
    mockFetch([{ match: on('POST', '/api/chat/token'), respond: () => json({ token: 't', expiresAt: 1, me: {} }) }]);
    const onConnected = vi.fn();
    renderApp(<Callback url={`/connect/callback?code=C&state=${start.state}`} onConnected={onConnected} standalone />);
    expect(screen.getByRole('status')).toHaveTextContent(/checking your access/i);
    await waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('open-in-app')).not.toBeInTheDocument();
  });

  it.each([
    ['invalid_code', 400, /no longer valid/i],
    ['rate_limited', 429, /too many attempts/i],
    ['chat_disabled', 404, /not enabled/i],
  ])('translates the %s error (TS-436)', async (error, status, text) => {
    const start = await prepareConnect('en');
    mockFetch([{ match: on('POST', '/api/chat/token'), respond: () => (status === 404 ? new Response(null, { status }) : json({ error }, status)) }]);
    renderApp(<Callback url={`/connect/callback?code=C&state=${start.state}`} onConnected={() => {}} standalone />);
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('a forged state is refused without calling the API', async () => {
    const { calls } = mockFetch([]);
    renderApp(<Callback url="/connect/callback?code=C&state=nope" onConnected={() => {}} standalone />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/did not start from this device/i);
    expect(calls).toHaveLength(0);
  });

  it('offers "Open in the app" when not running standalone (iOS fallback, T073)', async () => {
    mockFetch([]);
    renderApp(<Callback url="/connect/callback?code=C&state=nope" onConnected={() => {}} standalone={false} />);
    expect(await screen.findByTestId('open-in-app')).toHaveTextContent('Open in the app');
  });
});
