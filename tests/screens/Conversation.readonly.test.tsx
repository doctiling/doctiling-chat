import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Conversation } from '../../src/screens/Conversation';
import { json, mockFetch, on, renderApp, renderChatApp, setViewport } from '../helpers/render';

const session = (access?: { role: string; canWrite: boolean }) => ({
  match: on('GET', /\/session$/),
  respond: () => json({ turns: [], actions: [], pending: null, isRunning: false, ...(access ? { access } : {}) }),
});
const kbs = (role: string) => ({
  match: on('GET', '/api/chat/knowledge-bases'),
  respond: () => json({ items: [{ id: 'kb-1', name: 'Políticas', description: null, role, documentCount: 2, updatedAt: 1, hasPending: false, isRunning: false }] }),
});

// The server decides (session.access.canWrite); the chat only shows it. Nothing else changes:
// the composer stays enabled, the agent answers, a forbidden write comes back as a 403 as before.
describe('Read-only base [TS-463]', () => {
  it('[TS-463] canWrite=false: badge in the header with an explanatory tooltip, composer placeholder says read-only', async () => {
    mockFetch([session({ role: 'reader', canWrite: false })]);
    renderApp(<Conversation kbId="kb-1" kbName="Políticas" />);
    const badge = await screen.findByTestId('read-only-badge');
    expect(badge).toHaveTextContent('Read-only');
    const box = screen.getByRole('textbox');
    expect(box).toHaveAttribute('placeholder', 'Ask this knowledge base (read-only)…');
    expect(box).toBeEnabled();
    // Tooltip on focus (Radix): explains that the agent reads and searches but does not change the base.
    badge.focus();
    await waitFor(() =>
      expect(screen.getAllByText('Your access to this base is read-only: the agent can read and search it, not change it.').length).toBeGreaterThan(0),
    );
  });

  it('[TS-463] canWrite=true: no badge, the usual placeholder', async () => {
    mockFetch([session({ role: 'collaborator', canWrite: true })]);
    renderApp(<Conversation kbId="kb-1" kbName="Políticas" />);
    const box = await screen.findByRole('textbox');
    await waitFor(() => expect(box).toBeEnabled());
    expect(screen.queryByTestId('read-only-badge')).not.toBeInTheDocument();
    expect(box).toHaveAttribute('placeholder', 'Ask this knowledge base…');
  });

  it('[TS-463] a session without `access` (older server) shows no badge: the client never pre-decides', async () => {
    mockFetch([session()]);
    renderApp(<Conversation kbId="kb-1" kbName="Políticas" />);
    const box = await screen.findByRole('textbox');
    await waitFor(() => expect(box).toBeEnabled());
    expect(screen.queryByTestId('read-only-badge')).not.toBeInTheDocument();
  });

  it('[TS-463] Spanish copy: "Solo lectura" badge and placeholder', async () => {
    mockFetch([session({ role: 'reader', canWrite: false })]);
    renderApp(<Conversation kbId="kb-1" kbName="Políticas" />, { language: 'es' });
    expect(await screen.findByTestId('read-only-badge')).toHaveTextContent('Solo lectura');
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Pregunta a esta base (solo lectura)…');
  });

  it('[TS-463] desktop: the base list keeps its role badge next to the read-only badge of the open conversation', async () => {
    setViewport('desktop');
    window.history.replaceState(null, '', '/es/chat/kb/kb-1');
    mockFetch([kbs('reader'), session({ role: 'reader', canWrite: false })]);
    renderChatApp({ locale: 'en' });
    const nav = await screen.findByRole('navigation', { name: 'Knowledge bases' });
    expect(within(nav).getByRole('button', { name: /Políticas/ })).toHaveTextContent('Read only');
    expect(await screen.findByTestId('read-only-badge')).toBeInTheDocument();
  });

  it('[TS-463] mobile: the badge sits in the conversation header; the list shows the role before opening', async () => {
    window.history.replaceState(null, '', '/es/chat/kb');
    mockFetch([kbs('reader'), session({ role: 'reader', canWrite: false })]);
    renderChatApp({ locale: 'en' });
    const user = userEvent.setup();
    const row = await screen.findByRole('button', { name: /Políticas/ });
    expect(row).toHaveTextContent('Read only');
    await user.click(row);
    expect(await screen.findByTestId('read-only-badge')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Knowledge bases' })).not.toBeInTheDocument();
  });
});
