import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Conversation } from '../../src/screens/Conversation';
import { empty, json, mockFetch, on, renderApp } from '../helpers/render';

const turns = [
  { id: 'u1', role: 'user', content: 'hello' },
  { id: 'a1', role: 'agent', content: 'hi there' },
];

// T066 — "Clear conversation" with local confirmation → POST …/session/clear → empty list. [TS-412, TS-432]
describe('Conversation clear (T066)', () => {

  it('asks locally, then clears on the server and empties the list (TS-412)', async () => {
    const { calls } = mockFetch([
      { match: on('GET', /\/session$/), respond: () => json({ turns, actions: [], pending: null, isRunning: false }) },
      { match: on('POST', /\/session\/clear$/), respond: () => empty(204) },
    ]);
    renderApp(<Conversation kbId="kb-pol" />);
    await screen.findByText('hello');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Clear conversation' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Clear this conversation?');
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(0);
    await user.click(screen.getByTestId('clear-confirm'));
    await waitFor(() => expect(screen.queryByText('hello')).not.toBeInTheDocument());
    expect(calls.find((c) => c.init.method === 'POST')!.url).toMatch(/\/api\/chat\/knowledge-bases\/kb-pol\/session\/clear$/);
    expect(screen.getByText(/ask anything about this knowledge base/i)).toBeInTheDocument();
  });

  it('Cancel keeps the conversation and calls nothing', async () => {
    const { calls } = mockFetch([{ match: on('GET', /\/session$/), respond: () => json({ turns, actions: [], pending: null, isRunning: false }) }]);
    renderApp(<Conversation kbId="kb-pol" />);
    await screen.findByText('hello');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Clear conversation' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(0);
  });

  it('409 while running shows the clearFailed error (TS-432)', async () => {
    mockFetch([
      { match: on('GET', /\/session$/), respond: () => json({ turns, actions: [], pending: null, isRunning: false }) },
      { match: on('POST', /\/session\/clear$/), respond: () => json({ error: 'runInProgress' }, 409) },
    ]);
    renderApp(<Conversation kbId="kb-pol" />);
    await screen.findByText('hello');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Clear conversation' }));
    await user.click(await screen.findByTestId('clear-confirm'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be cleared while a request is running/i);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
