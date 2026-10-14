import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Conversation } from '../../src/screens/Conversation';
import { Documents } from '../../src/screens/Documents';
import { json, mockFetch, on, renderApp } from '../helpers/render';

// spec 054 — "New document" in the conversation and in Documents; "Index" on unindexed documents for editors.
const docs = [
  { id: 'd1', title: 'Vacation policy', type: 'text', visibility: 'shared', indexed: true },
  { id: 'd3', title: 'Org chart', type: 'graph', visibility: 'shared', indexed: false },
];
const kbs = (role: string) => ({
  match: on('GET', '/api/chat/knowledge-bases'),
  respond: () => json({ items: [{ id: 'kb-1', name: 'Políticas', description: null, role, documentCount: 2, updatedAt: 1, hasPending: false, isRunning: false }] }),
});
const list = (items: unknown[] = docs) => ({ match: on('GET', /\/kb-1\/documents$/), respond: () => json({ items }) });
const session = (role: string) => ({
  match: on('GET', /\/session$/),
  respond: () => json({ turns: [], actions: [], pending: null, isRunning: false, access: { role, canWrite: role !== 'reader' } }),
});

describe('Documents: new document and index later', () => {
  it('[TS-622] an admin gets "New document" in the list', async () => {
    mockFetch([kbs('admin'), list()]);
    renderApp(<Documents kbId="kb-1" />);
    await screen.findByRole('list', { name: 'Documents' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'New document' })).toHaveAttribute('aria-disabled', 'false'));
  });

  it('[TS-628] a collaborator sees it disabled with the reason', async () => {
    mockFetch([kbs('collaborator'), list()]);
    renderApp(<Documents kbId="kb-1" />);
    await screen.findByRole('list', { name: 'Documents' });
    await waitFor(() => expect(screen.getByTestId('new-document')).toHaveAttribute('aria-disabled', 'true'));
  });

  it('[TS-626] an editor indexes an unindexed document from the list and the list refreshes', async () => {
    let indexed = false;
    const { calls } = mockFetch([
      kbs('collaborator'),
      { match: on('GET', /\/kb-1\/documents$/), respond: () => json({ items: docs.map((d) => (d.id === 'd3' ? { ...d, indexed } : d)) }) },
      {
        match: on('POST', /\/documents\/index$/),
        respond: () => {
          indexed = true;
          return json({ results: [{ id: 'd3', ok: true }] });
        },
      },
    ]);
    renderApp(<Documents kbId="kb-1" />);
    const button = await screen.findByRole('button', { name: 'Index "Org chart"' });
    expect(screen.getAllByTestId('doc-index')).toHaveLength(1);
    await userEvent.setup().click(button);
    expect(await screen.findByText('"Org chart" indexed.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('doc-index')).not.toBeInTheDocument());
    expect(calls.filter((c) => /\/index$/.test(c.url)).map((c) => JSON.parse(String(c.init.body)))).toEqual([{ documentIds: ['d3'] }]);
  });

  it('[TS-627] a reader is not offered "Index"', async () => {
    const { calls } = mockFetch([kbs('reader'), list()]);
    renderApp(<Documents kbId="kb-1" />);
    await screen.findByRole('list', { name: 'Documents' });
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/api/chat/knowledge-bases'))).toBe(true));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('doc-index')).not.toBeInTheDocument();
  });
});

describe('Conversation: new document from the composer', () => {
  it('[TS-622] an admin opens the five methods from the composer', async () => {
    mockFetch([session('admin'), list()]);
    renderApp(<Conversation kbId="kb-1" kbName="Políticas" />);
    const composer = await screen.findByTestId('composer');
    const trigger = await within(composer).findByRole('button', { name: 'New document' });
    await userEvent.setup().click(trigger);
    expect(await screen.findByRole('list', { name: 'New document' })).toBeInTheDocument();
  });

  it('[TS-628] a reader sees it disabled with the reason', async () => {
    mockFetch([session('reader'), list()]);
    renderApp(<Conversation kbId="kb-1" kbName="Políticas" />);
    const composer = await screen.findByTestId('composer');
    expect(await within(composer).findByRole('button', { name: 'Only administrators of this base can create or upload documents.' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('[TS-624] "Ask the agent to fill it" puts the new document as a chip in the composer', async () => {
    mockFetch([
      session('owner'),
      list(),
      { match: on('POST', /\/kb-1\/documents$/), respond: () => json({ document: { id: 'n1', title: 'Mapa', type: 'graph', visibility: 'shared', indexed: false } }, 201) },
    ]);
    renderApp(<Conversation kbId="kb-1" kbName="Políticas" />);
    const user = userEvent.setup();
    await user.click(await within(await screen.findByTestId('composer')).findByRole('button', { name: 'New document' }));
    await user.click(await screen.findByRole('button', { name: /^Graph/ }));
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Mapa');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await user.click(await screen.findByRole('button', { name: 'Ask the agent to fill it' }));
    expect(await screen.findByTestId('mention-chips')).toHaveTextContent('@Mapa');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Ask this knowledge base…' })).toHaveValue('Fill in this document: '));
  });
});
