import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SourceSheet } from '../../src/screens/SourceSheet';
import { Conversation } from '../../src/screens/Conversation';
import { json, mockFetch, on, renderApp } from '../helpers/render';

// T067 — bottom sheet with the reading markdown of GET …/documents/:docId; 403 → permission notice. [TS-412, TS-433]
describe('SourceSheet (T067)', () => {

  it('renders the document in reading mode (markdown, table) with its type', async () => {
    mockFetch([
      {
        match: on('GET', /\/documents\/d1$/),
        respond: () => json({ id: 'd1', title: 'Vacation policy', type: 'database', markdown: '# Days\n\n| Role | Days |\n|---|---|\n| Staff | 15 |', updatedAt: Date.UTC(2026, 0, 2) }),
      },
    ]);
    renderApp(<SourceSheet kbId="kb-pol" docId="d1" onClose={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog).toHaveTextContent('Vacation policy'));
    expect(dialog).toHaveTextContent('Table');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Days' })).toBeInTheDocument();
  });

  it('403 → permission notice (TS-412)', async () => {
    mockFetch([{ match: on('GET', /\/documents\/private$/), respond: () => json({ error: 'forbidden', messageKey: 'x' }, 403) }]);
    renderApp(<SourceSheet kbId="kb-pol" docId="private" onClose={() => {}} />, { language: 'es' });
    expect(await screen.findByTestId('source-error')).toHaveTextContent('No tienes permiso para leer este documento.');
  });

  it('404 → not-found notice and closing calls onClose', async () => {
    mockFetch([{ match: on('GET', /\/documents\/gone$/), respond: () => json({ error: 'not_found' }, 404) }]);
    const onClose = vi.fn();
    renderApp(<SourceSheet kbId="kb-pol" docId="gone" onClose={onClose} />);
    expect(await screen.findByTestId('source-error')).toHaveTextContent(/not in the knowledge base any more/i);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('tapping a citation in the conversation opens the sheet without leaving the screen (TS-433)', async () => {
    mockFetch([
      { match: on('GET', /\/session$/), respond: () => json({ turns: [{ id: 'a1', role: 'agent', content: 'See doc:d9 "Policy".' }], actions: [], pending: null, isRunning: false }) },
      { match: on('GET', /\/documents\/d9$/), respond: () => json({ id: 'd9', title: 'Policy', type: 'text', markdown: 'Body of the policy.', updatedAt: 1 }) },
    ]);
    const { rerender } = renderApp(<Conversation kbId="kb-pol" />);
    await userEvent.setup().click(await screen.findByRole('link', { name: 'Policy' }));
    expect(window.location.pathname).toBe('/es/chat/kb/kb-pol/doc/d9');
    // The router passes docId down; emulate it.
    rerender(
      <Conversation kbId="kb-pol" docId="d9" />,
    );
    expect(await screen.findByText('Body of the policy.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
