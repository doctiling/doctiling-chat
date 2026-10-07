import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Conversation } from '../../src/screens/Conversation';
import { json, mockFetch, ndjson, on, renderApp, renderChatApp, setViewport } from '../helpers/render';

const items = [
  {
    id: 'kb-1',
    name: 'Políticas',
    description: 'HR policies',
    role: 'reader',
    documentCount: 12,
    updatedAt: 1,
    hasPending: false,
    isRunning: false,
  },
  {
    id: 'kb-2',
    name: 'Finanzas',
    description: null,
    role: 'collaborator',
    documentCount: 1,
    updatedAt: 2,
    hasPending: false,
    isRunning: false,
  },
];

const kbs = () => ({
  match: on('GET', '/api/chat/knowledge-bases'),
  respond: () => json({ items }),
});
const session = () => ({
  match: on('GET', /\/session$/),
  respond: () => json({ turns: [], actions: [], pending: null, isRunning: false }),
});
const me = () => ({
  match: on('GET', '/api/chat/me'),
  respond: () =>
    json({
      email: 'ana@tenant.test',
      name: 'Ana',
      role: 'guest',
      tenant: { host: 'studio.tenant.test', name: 'Tenant Co' },
    }),
});
const doc = (id: string) => ({
  match: on('GET', new RegExp(`/documents/${id}$`)),
  respond: () =>
    json({
      id,
      title: 'Policy',
      type: 'text',
      markdown: 'Body of the policy.',
      updatedAt: 1,
    }),
});

// The layout is decided by viewport size (matchMedia / Tailwind md), never by user agent:
// from 768 px the chat is a two-column shell (base list + conversation); below it, the
// stacked mobile navigation stays exactly as it was. [TS-460 desktop, TS-397 mobile]
describe('Desktop shell (two columns from md)', () => {
  it('[TS-460] /kb/:id renders the base list AND the conversation, with the open base highlighted', async () => {
    setViewport('desktop');
    window.history.replaceState(null, '', '/es/chat/kb/kb-1');
    mockFetch([kbs(), session()]);
    renderChatApp();
    const list = await screen.findByRole('navigation', {
      name: 'Bases de conocimiento',
    });
    expect(within(list).getByRole('heading', { name: 'Bases de conocimiento' })).toBeVisible();
    expect(await screen.findByRole('textbox')).toBeVisible();
    const selected = await within(list).findByRole('button', {
      name: /Políticas/,
    });
    expect(selected).toHaveAttribute('aria-current', 'page');
    expect(within(list).getByRole('button', { name: /Finanzas/ })).not.toHaveAttribute('aria-current');
    // Both columns live in the same document at the same time.
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('[TS-460] / renders the list next to an empty state asking to pick a base', async () => {
    setViewport('desktop');
    mockFetch([kbs()]);
    renderChatApp();
    expect(await screen.findByRole('navigation', { name: 'Bases de conocimiento' })).toBeInTheDocument();
    expect(await screen.findByTestId('desktop-empty')).toHaveTextContent('Elige una base para empezar');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('[TS-460] /settings renders the list on the left and Settings on the right', async () => {
    setViewport('desktop');
    window.history.replaceState(null, '', '/es/chat/settings');
    mockFetch([kbs(), me()]);
    renderChatApp({ version: '0.3.0-test' });
    expect(await screen.findByRole('navigation', { name: 'Bases de conocimiento' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeInTheDocument();
    expect(screen.getByTestId('version')).toHaveTextContent('0.3.0-test');
  });

  it('[TS-460] the list is keyboard-navigable: arrows move between bases, Enter opens one', async () => {
    setViewport('desktop');
    mockFetch([kbs(), session()]);
    renderChatApp();
    const list = await screen.findByRole('navigation', {
      name: 'Bases de conocimiento',
    });
    const first = await within(list).findByRole('button', {
      name: /Políticas/,
    });
    const user = userEvent.setup();
    first.focus();
    await user.keyboard('{ArrowDown}');
    expect(within(list).getByRole('button', { name: /Finanzas/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(window.location.pathname).toBe('/es/chat/kb/kb-2');
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('[TS-397] below md the stacked navigation is unchanged: one screen at a time', async () => {
    window.history.replaceState(null, '', '/es/chat/kb/kb-1');
    mockFetch([kbs(), session()]);
    renderChatApp();
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Bases de conocimiento' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('desktop-empty')).not.toBeInTheDocument();
  });
});

describe('Source on desktop vs mobile', () => {
  it('[TS-460] on desktop the cited source opens as a side panel (role=complementary) with a close control', async () => {
    setViewport('desktop');
    window.history.replaceState(null, '', '/es/chat/kb/kb-1/doc/d9');
    mockFetch([kbs(), session(), doc('d9')]);
    renderChatApp({ locale: 'en', basePath: '/es/chat' });
    const panel = await screen.findByRole('complementary', { name: 'Source' });
    expect(await within(panel).findByText('Body of the policy.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The conversation stays next to it.
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    await userEvent.setup().click(within(panel).getByRole('button', { name: 'Close' }));
    expect(window.location.pathname).toBe('/es/chat/kb/kb-1');
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Source' })).not.toBeInTheDocument());
  });

  it('[TS-397] on mobile the cited source opens as a bottom sheet (dialog)', async () => {
    mockFetch([session(), doc('d9')]);
    renderApp(<Conversation kbId="kb-1" docId="d9" />);
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Body of the policy.')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Source' })).not.toBeInTheDocument();
  });
});

describe('Enter in the composer', () => {
  const routes = () => [
    session(),
    {
      match: on('POST', /\/agent$/),
      respond: () => ndjson([{ status: 'Done', role: 'system' }]),
    },
  ];
  const posts = (calls: { init: RequestInit }[]) => calls.filter((c) => c.init.method === 'POST');

  it('[TS-460] on desktop Enter sends and Shift+Enter inserts a newline', async () => {
    setViewport('desktop');
    const { calls } = mockFetch(routes());
    renderApp(<Conversation kbId="kb-1" />);
    const user = userEvent.setup();
    const box = await screen.findByRole('textbox');
    await user.type(box, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(posts(calls)).toHaveLength(0);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(JSON.parse(String(posts(calls)[0]!.init.body)).query).toBe('line one\nline two');
  });

  it('[TS-397] on mobile Enter does not send: only the Send button does', async () => {
    const { calls } = mockFetch(routes());
    renderApp(<Conversation kbId="kb-1" />);
    const user = userEvent.setup();
    const box = await screen.findByRole('textbox');
    await user.type(box, 'line one{Enter}line two');
    expect(posts(calls)).toHaveLength(0);
    expect(box).toHaveValue('line one\nline two');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
  });
});
