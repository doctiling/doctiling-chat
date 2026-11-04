// Spec 074 (doctiling-web) — the chat's public mode: one base, no sign-in, browser history (TS-020, TS-023, TS-030).
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockFetch, ndjson, on, renderChatApp } from '../helpers/render';

const SLUG = 'AbCdEfGhIjKlMnOpQrStUvWx';
const BASE = `/api/public/chat/${SLUG}`;

function renderPublic() {
  window.history.replaceState(null, '', `/es/c/${SLUG}`);
  return renderChatApp({ basePath: `/es/c/${SLUG}`, publicChat: { slug: SLUG, getHumanToken: async () => 'tok' } });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('public chat mode', () => {
  it('opens straight on the base conversation, read-only, with no studio controls', async () => {
    const { calls } = mockFetch([{ match: on('GET', BASE), respond: () => json({ name: 'Tech Day' }) }]);
    renderPublic();
    expect(await screen.findByRole('heading', { name: 'Tech Day' })).toBeInTheDocument();
    expect(await screen.findByTestId('read-only-badge')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /volver|back/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /documentos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compartir/i })).not.toBeInTheDocument();
    expect(screen.getByText(/solo en este navegador/i)).toBeInTheDocument();
    // Never the session-bound studio API.
    expect(calls.every((c) => !c.url.includes('/api/chat/'))).toBe(true);
  });

  it('[TS-020][TS-023] asks the public endpoint and keeps the conversation after a reload', async () => {
    mockFetch([
      { match: on('GET', BASE), respond: () => json({ name: 'Tech Day' }) },
      {
        match: on('POST', `${BASE}/agent`),
        respond: () => ndjson([{ status: 'Streaming', role: 'agent', analysisChunk: 'Es el sábado 21.' }, { status: 'Done', role: 'agent' }]),
      },
    ]);
    const user = userEvent.setup();
    const first = renderPublic();
    await screen.findByTestId('read-only-badge');
    await user.type(screen.getByRole('textbox'), '¿Cuándo es?');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Es el sábado 21.')).toBeInTheDocument();
    first.unmount();

    renderPublic();
    expect(await screen.findByText('Es el sábado 21.')).toBeInTheDocument();
    expect(screen.getByText('¿Cuándo es?')).toBeInTheDocument();
  });

  it('[TS-030] a refused question explains why and is not kept', async () => {
    mockFetch([
      { match: on('GET', BASE), respond: () => json({ name: 'Tech Day' }) },
      { match: on('POST', `${BASE}/agent`), respond: () => json({ error: 'daily_cap', retryAfterSeconds: 60 }, 429) },
    ]);
    const user = userEvent.setup();
    renderPublic();
    await screen.findByTestId('read-only-badge');
    await user.type(screen.getByRole('textbox'), 'hola');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    const notice = await screen.findByTestId('notice');
    expect(notice).toHaveTextContent(/mañana/i);
    await waitFor(() => expect(screen.queryByText('hola')).not.toBeInTheDocument());
  });

  it('shows "not available" when the link is off or unknown', async () => {
    mockFetch([{ match: on('GET', BASE), respond: () => json({ error: 'unavailable' }, 404) }]);
    renderPublic();
    const box = await screen.findByTestId('public-unavailable');
    expect(within(box).getByText(/no está disponible/i)).toBeInTheDocument();
  });
});

// Owner QA 2026-11-04: the reCAPTCHA badge covered the send button; the host hides it and
// the chat states the notice in its own footer instead.
describe('public chat mode — human check notice', () => {
  it('states the reCAPTCHA notice under the composer', async () => {
    mockFetch([{ match: on('GET', BASE), respond: () => json({ name: 'Tech Day' }) }]);
    renderPublic();
    await screen.findByRole('heading', { name: 'Tech Day' });
    expect(screen.getByText(/protegido por reCAPTCHA/i)).toBeInTheDocument();
  });
});
