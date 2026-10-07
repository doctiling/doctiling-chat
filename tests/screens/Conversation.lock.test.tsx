import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Conversation } from '../../src/screens/Conversation';
import { json, mockFetch, ndjson, on, renderApp, sessionStore, setViewport } from '../helpers/render';

// T065 — double tap on send → one request; 409 runInProgress → notice. [TS-409, TS-410]
describe('Conversation lock (T065)', () => {

  it('a double tap on send produces exactly one request and one user turn (TS-410)', async () => {
    const store = sessionStore();
    const { calls } = mockFetch([
      store.route(),
      {
        match: on('POST', /\/agent$/),
        respond: () => {
          store.append({ id: 'u1', role: 'user', content: 'same question' }, { id: 'a1', role: 'agent', content: 'ok' });
          return ndjson([{ status: 'Streaming', role: 'model', analysisChunk: 'ok' }, { status: 'Done', role: 'system' }], { delayMs: 20 });
        },
      },
    ]);
    renderApp(<Conversation kbId="kb-pol" />);
    const box = await screen.findByRole('textbox');
    await userEvent.setup().type(box, 'same question');
    const send = screen.getByRole('button', { name: 'Send' });
    fireEvent.click(send);
    fireEvent.click(send);
    fireEvent.submit(screen.getByTestId('composer'));
    await waitFor(() => expect(screen.getAllByText('ok').length).toBeGreaterThan(0));
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
    expect(screen.getAllByTestId('turn').filter((t) => t.dataset.role === 'user')).toHaveLength(1);
  });

  it('[TS-460] on desktop, Enter sends once and Shift+Enter does not send', async () => {
    setViewport('desktop');
    const { calls } = mockFetch([
      { match: on('GET', /\/session$/), respond: () => json({ turns: [], actions: [], pending: null, isRunning: false }) },
      { match: on('POST', /\/agent$/), respond: () => ndjson([{ status: 'Done', role: 'system' }]) },
    ]);
    renderApp(<Conversation kbId="kb-pol" />);
    const user = userEvent.setup();
    const box = await screen.findByRole('textbox');
    await user.type(box, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(0);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1));
    expect(JSON.parse(String(calls.find((c) => c.init.method === 'POST')!.init.body)).query).toBe('line one\nline two');
  });

  it('409 runInProgress → notice, no duplicate turn (TS-409)', async () => {
    mockFetch([
      { match: on('GET', /\/session$/), respond: () => json({ turns: [], actions: [], pending: null, isRunning: false }) },
      { match: on('POST', /\/agent$/), respond: () => json({ error: 'runInProgress', messageKey: 'x' }, 409) },
    ]);
    renderApp(<Conversation kbId="kb-pol" />, { language: 'es' });
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox'), 'otra');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByTestId('notice')).toHaveTextContent('Ya hay una petición en curso');
    expect(screen.queryAllByTestId('turn')).toHaveLength(0);
  });

  it('a session already running shows Stop instead of Send', async () => {
    mockFetch([{ match: on('GET', /\/session$/), respond: () => json({ turns: [], actions: [], pending: null, isRunning: true }) }]);
    renderApp(<Conversation kbId="kb-pol" />);
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
  });
});
