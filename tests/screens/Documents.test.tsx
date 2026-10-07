import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Documents } from '../../src/screens/Documents';
import { json, mockFetch, on, renderApp, renderChatApp, setViewport } from '../helpers/render';

// What GET …/documents answers: only what the person may read (the server already
// excluded other people's private documents), variants flattened under parentTitle.
const docs = [
  { id: 'd1', title: 'Vacation policy', type: 'text', visibility: 'shared', indexed: true },
  { id: 'd2', title: 'Salary bands', type: 'database', visibility: 'private', indexed: true },
  { id: 'd3', title: 'Org chart', type: 'graph', visibility: 'shared', indexed: false },
  { id: 'd4', title: 'Vacation policy (2025)', type: 'text', visibility: 'shared', parentTitle: 'Vacation policy', indexed: true },
];

const documents = (items: unknown[] = docs) => ({ match: on('GET', /\/kb-1\/documents$/), respond: () => json({ items }) });
const session = () => ({ match: on('GET', /\/session$/), respond: () => json({ turns: [], actions: [], pending: null, isRunning: false }) });
const kbs = () => ({
  match: on('GET', '/api/chat/knowledge-bases'),
  respond: () => json({ items: [{ id: 'kb-1', name: 'Políticas', description: null, role: 'reader', documentCount: 4, updatedAt: 1, hasPending: false, isRunning: false }] }),
});
const doc = (id: string) => ({
  match: on('GET', new RegExp(`/documents/${id}$`)),
  respond: () => json({ id, title: 'Vacation policy', type: 'text', markdown: 'Fifteen days.', updatedAt: 1 }),
});

describe('Documents list [TS-461]', () => {
  it('[TS-461] lists exactly what the API returns, with the private badge and the not-indexed hint', async () => {
    mockFetch([documents()]);
    renderApp(<Documents kbId="kb-1" />);
    const list = await screen.findByRole('list', { name: 'Documents' });
    const rows = within(list).getAllByRole('button');
    expect(rows.map((r) => r.dataset.doc)).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(screen.getByText('4 documents')).toBeInTheDocument();
    // Only the person's own private document carries the badge; only the unindexed one the hint.
    expect(screen.getAllByTestId('doc-private')).toHaveLength(1);
    expect(within(rows[1]!).getByText('Private')).toBeInTheDocument();
    expect(screen.getAllByTestId('doc-not-indexed')).toHaveLength(1);
    expect(within(rows[2]!).getByText('Not indexed yet')).toBeInTheDocument();
    // The variant shows its parent.
    expect(within(rows[3]!).getByText('Vacation policy')).toBeInTheDocument();
  });

  it('[TS-461] the filter box narrows the list (accent- and case-insensitive) and says when nothing matches', async () => {
    mockFetch([documents()]);
    renderApp(<Documents kbId="kb-1" />);
    await screen.findByRole('list', { name: 'Documents' });
    const user = userEvent.setup();
    await user.type(screen.getByRole('searchbox', { name: 'Filter documents…' }), 'VACÁTION');
    const rows = within(screen.getByRole('list', { name: 'Documents' })).getAllByRole('button');
    expect(rows.map((r) => r.dataset.doc)).toEqual(['d1', 'd4']);
    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByTestId('documents-no-match')).toHaveTextContent('No document matches "zzz".');
  });

  it('[TS-461] an empty base says so; a 403 shows the permission notice; a failure can be retried', async () => {
    mockFetch([documents([])]);
    const first = renderApp(<Documents kbId="kb-1" />);
    expect(await screen.findByTestId('documents-empty')).toHaveTextContent('There are no documents you can read in this base yet.');
    first.unmount();
    mockFetch([{ match: on('GET', /\/documents$/), respond: () => json({ error: 'forbidden' }, 403) }]);
    const second = renderApp(<Documents kbId="kb-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Your access to this base does not allow listing its documents.');
    second.unmount();
    let fail = true;
    mockFetch([{ match: on('GET', /\/documents$/), respond: () => (fail ? json({ error: 'boom' }, 500) : json({ items: docs })) }]);
    renderApp(<Documents kbId="kb-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The documents could not be loaded.');
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('list', { name: 'Documents' })).toBeInTheDocument();
  });

  it('[TS-461] mobile: the header icon opens /kb/:id/docs, a tap opens the document as a bottom sheet, back returns', async () => {
    window.history.replaceState(null, '', '/es/chat/kb/kb-1');
    mockFetch([kbs(), session(), documents(), doc('d1')]);
    renderChatApp({ locale: 'en' });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Documents' }));
    expect(window.location.pathname).toBe('/es/chat/kb/kb-1/docs');
    expect(await screen.findByRole('heading', { name: 'Documents' })).toBeInTheDocument();
    // One screen at a time: the composer is gone while the list is open.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /^Vacation policy$/ }));
    expect(window.location.pathname).toBe('/es/chat/kb/kb-1/doc/d1');
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Fifteen days.')).toBeInTheDocument();
    // The conversation is back underneath the sheet (the dialog hides it from the a11y tree).
    expect(screen.getByTestId('composer')).toBeInTheDocument();
  });

  it('[TS-461] desktop: the header toggle shows the list in the side panel in place of the source; a tap swaps it for the document', async () => {
    setViewport('desktop');
    window.history.replaceState(null, '', '/es/chat/kb/kb-1');
    const { calls } = mockFetch([kbs(), session(), documents(), doc('d2')]);
    renderChatApp({ locale: 'en' });
    const user = userEvent.setup();
    const toggle = await screen.findByRole('button', { name: 'Documents' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('documents-panel')).not.toBeInTheDocument();
    await user.click(toggle);
    expect(window.location.pathname).toBe('/es/chat/kb/kb-1/docs');
    const panel = await screen.findByTestId('documents-panel');
    expect(panel).toHaveAttribute('role', 'complementary');
    expect(within(panel).getByRole('heading', { name: 'Documents' })).toBeInTheDocument();
    // Two-column layout intact: base list and conversation (composer) stay; no dialog.
    expect(screen.getByRole('navigation', { name: 'Knowledge bases' })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide the documents' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(panel).getByRole('button', { name: /Salary bands/ }));
    expect(window.location.pathname).toBe('/es/chat/kb/kb-1/doc/d2');
    await waitFor(() => expect(screen.queryByTestId('documents-panel')).not.toBeInTheDocument());
    expect(await screen.findByRole('complementary', { name: 'Source' })).toBeInTheDocument();
    // Fetched once per base: the panel and the mention picker share the cached list.
    expect(calls.filter((c) => /\/documents$/.test(c.url))).toHaveLength(1);
  });
});
