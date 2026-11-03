import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Conversation } from '../../src/screens/Conversation';
import { Documents } from '../../src/screens/Documents';
import { SourceSheet } from '../../src/screens/SourceSheet';
import { json, mockFetch, ndjson, on, renderApp } from '../helpers/render';
import { stubEventSource } from '../helpers/event-source';

const row = (id: string, title: string) => ({ id, title, type: 'text', visibility: 'shared', indexed: true });

// Spec 072 (doctiling-web): the list and the open document follow changes without a reload.
describe('live documents list', () => {
  it('reloads once on a burst of kb.documents / doc.index signals for its base, ignores other bases', async () => {
    const es = stubEventSource();
    let items = [row('d1', 'Vacation policy')];
    let calls = 0;
    mockFetch([{ match: on('GET', /\/kb-1\/documents$/), respond: () => (calls++, json({ items })) }]);
    renderApp(<Documents kbId="kb-1" />);
    await screen.findByText('Vacation policy');
    expect(calls).toBe(1);
    items = [...items, row('d2', 'Travel policy')];
    es.last().signal({ kind: 'kb.documents', kbId: 'other' });
    es.last().signal({ kind: 'kb.documents', kbId: 'kb-1' });
    es.last().signal({ kind: 'doc.index', kbId: 'kb-1', docId: 'd1' });
    expect(await screen.findByText('Travel policy')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('reloads on resync (reconnect after a drop)', async () => {
    const es = stubEventSource();
    let items = [row('d1', 'Vacation policy')];
    mockFetch([{ match: on('GET', /\/kb-1\/documents$/), respond: () => json({ items }) }]);
    renderApp(<Documents kbId="kb-1" />);
    await screen.findByText('Vacation policy');
    items = [row('d1', 'Vacation policy v2')];
    es.last().emit('resync');
    expect(await screen.findByText('Vacation policy v2')).toBeInTheDocument();
  });

  it('[owner bug] a document the agent creates in the conversation reaches the list without any stream', async () => {
    stubEventSourceOff();
    let items = [row('d1', 'Vacation policy')];
    let listCalls = 0;
    mockFetch([
      { match: on('GET', /\/session$/), respond: () => json({ turns: [], actions: [], pending: null, isRunning: false }) },
      { match: on('GET', /\/kb-1\/documents$/), respond: () => (listCalls++, json({ items })) },
      {
        match: on('POST', /\/agent$/),
        respond: () => {
          items = [...items, row('d9', 'Meeting notes')];
          return ndjson([
            { status: 'Applied', role: 'tools', action: { targetKind: 'document', targetId: 'd9', outcome: 'applied' } },
            { status: 'Done', role: 'system' },
          ]);
        },
      },
    ]);
    renderApp(<Conversation kbId="kb-1" />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox'), 'create meeting notes');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(listCalls).toBe(2));
  });
});

/** Realtime switched off on the server: the stream is refused right away. */
function stubEventSourceOff() {
  const es = stubEventSource();
  queueMicrotask(() => es.all.forEach((s) => s.refuse()));
}

describe('live source sheet', () => {
  it('refetches the open document on doc.changed for it, keeping the old copy on screen meanwhile', async () => {
    const es = stubEventSource();
    let markdown = 'Fifteen days.';
    let calls = 0;
    mockFetch([{ match: on('GET', /\/documents\/d1$/), respond: () => (calls++, json({ id: 'd1', title: 'Vacation policy', type: 'text', markdown, updatedAt: 1 })) }]);
    renderApp(<SourceSheet kbId="kb-1" docId="d1" onClose={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog).toHaveTextContent('Fifteen days.'));
    markdown = 'Twenty days.';
    es.last().signal({ kind: 'doc.changed', kbId: 'kb-1', docId: 'other' });
    es.last().signal({ kind: 'doc.changed', kbId: 'kb-1', docId: 'd1', blockIds: ['b1'] });
    expect(within(dialog).queryByRole('status')).toBeNull();
    await waitFor(() => expect(dialog).toHaveTextContent('Twenty days.'));
    expect(calls).toBe(2);
  });
});
