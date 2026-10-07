import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Conversation } from '../../src/screens/Conversation';
import { json, mockFetch, ndjson, on, renderApp } from '../helpers/render';

const pending = { id: 'p1', toolName: 'delete_document', summaryKey: 'kbAgent.confirm.summary.delete_document', summaryValues: { name: 'Old policy' } };

// T064 — Confirm event → card with target name, Confirm/Reject (tooltips, guard) → resume;
// 409 confirmationPending when writing with a pending one. [TS-392]
describe('Conversation confirm (T064, TS-392)', () => {

  it('renders the ConfirmCard from a Confirm event and resumes with approved:true on a double tap once', async () => {
    const posts: unknown[] = [];
    let sessionPending: unknown = null;
    const sessionTurns: unknown[] = [];
    mockFetch([
      { match: on('GET', /\/session$/), respond: () => json({ turns: sessionTurns, actions: [], pending: sessionPending, isRunning: false }) },
      {
        match: on('POST', /\/agent$/),
        respond: (_u, init) => {
          const body = JSON.parse(String(init.body));
          posts.push(body);
          if ('query' in body) {
            sessionPending = pending;
            return ndjson([{ status: 'Confirm', role: 'tools', pending }]);
          }
          sessionPending = null;
          sessionTurns.push({ id: 'u1', role: 'user', content: 'delete the old policy' }, { id: 'a1', role: 'agent', content: 'Deleted.' });
          return ndjson([{ status: 'Applied', role: 'tools' }, { status: 'Streaming', role: 'model', analysisChunk: 'Deleted.' }, { status: 'Done', role: 'system' }]);
        },
      },
    ]);
    renderApp(<Conversation kbId="kb-pol" />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox'), 'delete the old policy');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const card = await screen.findByTestId('confirm-card');
    expect(card).toHaveTextContent('Delete the document "Old policy"');
    const approve = screen.getByRole('button', { name: 'Confirm' });
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    await user.dblClick(approve);
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1]).toEqual({ resume: { pendingId: 'p1', approved: true } });
    await waitFor(() => expect(screen.getAllByText('Deleted.').length).toBeGreaterThan(0));
    expect(screen.queryByTestId('confirm-card')).not.toBeInTheDocument();
  });

  it('Reject resumes with approved:false and a pending confirmation from the session disables the composer', async () => {
    const posts: unknown[] = [];
    mockFetch([
      { match: on('GET', /\/session$/), respond: () => json({ turns: [], actions: [], pending, isRunning: false }) },
      {
        match: on('POST', /\/agent$/),
        respond: (_u, init) => {
          posts.push(JSON.parse(String(init.body)));
          return ndjson([{ status: 'Notice', role: 'system', noticeKey: 'kbAgent.rejectedNote' }, { status: 'Done', role: 'system' }]);
        },
      },
    ]);
    renderApp(<Conversation kbId="kb-pol" />, { language: 'es' });
    await screen.findByTestId('confirm-card');
    expect(screen.getByRole('textbox')).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Rechazar' }));
    await waitFor(() => expect(posts).toEqual([{ resume: { pendingId: 'p1', approved: false } }]));
    expect(await screen.findByTestId('notice')).toHaveTextContent('Rechazaste el cambio propuesto');
  });

  it('409 confirmationPending on a write is shown as a notice and the optimistic turn is dropped', async () => {
    mockFetch([
      { match: on('GET', /\/session$/), respond: () => json({ turns: [], actions: [], pending: null, isRunning: false }) },
      { match: on('POST', /\/agent$/), respond: () => json({ error: 'confirmationPending', messageKey: 'x' }, 409) },
    ]);
    renderApp(<Conversation kbId="kb-pol" />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox'), 'another thing');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByTestId('notice')).toHaveTextContent(/pending confirmation/i);
    expect(screen.queryByText('another thing')).not.toBeInTheDocument();
  });
});
