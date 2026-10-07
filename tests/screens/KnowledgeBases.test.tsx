import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { KnowledgeBases } from '../../src/screens/KnowledgeBases';
import { getPrefs } from '../../src/lib/storage';
import { json, mockFetch, on, renderApp } from '../helpers/render';

const items = [
  { id: 'kb-pol', name: 'Políticas', description: 'HR policies', role: 'reader', documentCount: 12, updatedAt: 1, hasPending: false, isRunning: false },
  { id: 'kb-fin', name: 'Finanzas', description: null, role: 'collaborator', documentCount: 1, updatedAt: 2, hasPending: true, isRunning: false },
  { id: 'kb-run', name: 'Ops', description: null, role: 'owner', documentCount: 3, updatedAt: 3, hasPending: false, isRunning: true },
];

// T060 — list with role and indicators; explained empty state without error; reload on foreground. [TS-384, TS-428]
describe('KnowledgeBases screen (T060)', () => {

  it('lists the bases with role, document count and pending/running indicators (TS-428)', async () => {
    mockFetch([{ match: on('GET', '/api/chat/knowledge-bases'), respond: () => json({ items }) }]);
    renderApp(<KnowledgeBases />);
    expect(await screen.findByText('Políticas')).toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.getByText('HR policies')).toBeInTheDocument();
    expect(screen.getByText('1 document')).toBeInTheDocument();
    expect(screen.getByText('Waiting for your confirmation')).toBeInTheDocument();
    expect(screen.getByText('Working on a request')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('opens a base and remembers it as the last one', async () => {
    mockFetch([{ match: on('GET', '/api/chat/knowledge-bases'), respond: () => json({ items }) }]);
    renderApp(<KnowledgeBases />);
    await userEvent.setup().click(await screen.findByText('Políticas'));
    expect(window.location.pathname).toBe('/es/chat/kb/kb-pol');
    expect(getPrefs().lastKbId).toBe('kb-pol');
  });

  it('shows the explained empty state and no error when nothing is shared (TS-384)', async () => {
    mockFetch([{ match: on('GET', '/api/chat/knowledge-bases'), respond: () => json({ items: [] }) }]);
    renderApp(<KnowledgeBases />, { language: 'es' });
    expect(await screen.findByTestId('kb-empty')).toHaveTextContent(/compartirte una base/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reloads when the app returns to the foreground', async () => {
    const { calls } = mockFetch([{ match: on('GET', '/api/chat/knowledge-bases'), respond: () => json({ items }) }]);
    renderApp(<KnowledgeBases />);
    await screen.findByText('Políticas');
    expect(calls).toHaveLength(1);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(calls).toHaveLength(2));
  });

  it('shows a retryable error when the list fails (not a 401)', async () => {
    let fail = true;
    mockFetch([{ match: on('GET', '/api/chat/knowledge-bases'), respond: () => (fail ? json({ error: 'unknown' }, 500) : json({ items })) }]);
    renderApp(<KnowledgeBases />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i);
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Políticas')).toBeInTheDocument();
  });
});
