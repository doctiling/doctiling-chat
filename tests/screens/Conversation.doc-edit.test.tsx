import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Conversation } from '../../src/screens/Conversation';
import { PANEL_DEFAULT, PANEL_WIDTH_KEY } from '../../src/lib/panel-width';
import { json, mockFetch, ndjson, on, renderApp, setViewport } from '../helpers/render';

// doctiling-web spec 086 extension (2026-11-21): the chat outside the studio edits like the
// pointer, without the pointer — the agent knows the open document, each answer that wrote
// something offers «Keep / Undo», and the document panel goes back to the list and resizes.

const documents = () => ({
  match: on('GET', /\/documents$/),
  respond: () => json({ items: [{ id: 'tbl', title: 'Grupos de trabajo', type: 'database', visibility: 'shared', indexed: true }] }),
});
const doc = () => ({
  match: on('GET', /\/documents\/tbl$/),
  respond: () => json({ id: 'tbl', title: 'Grupos de trabajo', type: 'database', markdown: '| Grupo |\n|---|\n| A |', updatedAt: 1 }),
});
const turns = [
  { id: 'u1', role: 'user', content: 'crear otra fila de ejemplo' },
  { id: 'a1', role: 'agent', content: 'Agregué la fila «Grupo D».' },
];

describe('the open document is the agent’s context', () => {
  it('a question sent with a document open carries its id, and the composer says which one', async () => {
    const posts: unknown[] = [];
    mockFetch([
      { match: on('GET', /\/session$/), respond: () => json({ turns: [], actions: [], pending: null, isRunning: false }) },
      documents(),
      doc(),
      {
        match: on('POST', /\/agent$/),
        respond: (_u, init) => {
          posts.push(JSON.parse(String(init.body)));
          return ndjson([{ status: 'Done', role: 'system' }]);
        },
      },
    ]);
    // Desktop: the document sits next to the conversation (on a phone it is a sheet over it).
    setViewport('desktop');
    renderApp(<Conversation kbId="kb-1" docId="tbl" />);
    expect(await screen.findByTestId('open-document-context')).toHaveTextContent('Open: Grupos de trabajo');
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox'), 'crear otra fila de ejemplo');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(posts).toEqual([{ query: 'crear otra fila de ejemplo', activeDocumentId: 'tbl' }]));
  });

  it('without an open document nothing extra travels and no context pill shows', async () => {
    const posts: unknown[] = [];
    mockFetch([
      { match: on('GET', /\/session$/), respond: () => json({ turns: [], actions: [], pending: null, isRunning: false }) },
      documents(),
      { match: on('POST', /\/agent$/), respond: (_u, init) => (posts.push(JSON.parse(String(init.body))), ndjson([{ status: 'Done', role: 'system' }])) },
    ]);
    renderApp(<Conversation kbId="kb-1" />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox'), 'hola');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(posts).toEqual([{ query: 'hola' }]));
    expect(screen.queryByTestId('open-document-context')).not.toBeInTheDocument();
  });
});

describe('Keep / Undo under an answer that changed documents', () => {
  const sessionWith = (state: () => 'open' | 'kept' | 'undone') => ({
    match: on('GET', /\/session$/),
    respond: () =>
      json({ turns, actions: [], pending: null, isRunning: false, changes: [{ turnId: 'a1', state: state(), documents: [{ id: 'tbl', title: 'Grupos de trabajo' }] }] }),
  });

  it('Undo asks the server once, says what happened and then shows only the outcome', async () => {
    let state: 'open' | 'undone' = 'open';
    const decisions: { url: string; body: unknown }[] = [];
    mockFetch([
      sessionWith(() => state),
      documents(),
      {
        match: on('POST', /\/session\/changes\/a1$/),
        respond: (url, init) => {
          decisions.push({ url, body: JSON.parse(String(init.body)) });
          state = 'undone';
          return json({ state: 'undone', restored: 1, skipped: 1 });
        },
      },
    ]);
    renderApp(<Conversation kbId="kb-1" />, { language: 'es' });
    const bar = await screen.findByTestId('turn-change-bar');
    expect(bar).toHaveTextContent('El agente cambió «Grupos de trabajo»');
    await userEvent.setup().dblClick(within(bar).getByRole('button', { name: /Deshacer/ }));
    await waitFor(() => expect(decisions).toEqual([{ url: expect.stringContaining('/api/chat/knowledge-bases/kb-1/session/changes/a1'), body: { action: 'undo' } }]));
    expect(await screen.findByText(/1 se conservaron porque alguien los cambió después/)).toBeInTheDocument();
    expect(await screen.findByTestId('turn-change-outcome')).toHaveTextContent('Cambios deshechos');
    expect(screen.queryByTestId('turn-change-bar')).not.toBeInTheDocument();
  });

  it('Keep closes the bar; an already decided turn (409) says so', async () => {
    let state: 'open' | 'kept' = 'open';
    const bodies: unknown[] = [];
    mockFetch([
      sessionWith(() => state),
      documents(),
      {
        match: on('POST', /\/session\/changes\/a1$/),
        respond: (_u, init) => {
          bodies.push(JSON.parse(String(init.body)));
          return json({ error: 'changes_closed', messageKey: 'chatApi.errors.changesClosed' }, 409);
        },
      },
    ]);
    renderApp(<Conversation kbId="kb-1" />);
    const bar = await screen.findByTestId('turn-change-bar');
    state = 'kept';
    await userEvent.setup().click(within(bar).getByRole('button', { name: /Keep/ }));
    await waitFor(() => expect(bodies).toEqual([{ action: 'keep' }]));
    expect(await screen.findByText('Those changes were already kept or undone.')).toBeInTheDocument();
    expect(await screen.findByTestId('turn-change-outcome')).toHaveTextContent('Changes kept');
  });

  it('a turn without changes, or a server without the extension, shows no bar', async () => {
    mockFetch([{ match: on('GET', /\/session$/), respond: () => json({ turns, actions: [], pending: null, isRunning: false }) }, documents()]);
    renderApp(<Conversation kbId="kb-1" />);
    expect(await screen.findByText('Agregué la fila «Grupo D».')).toBeInTheDocument();
    expect(screen.queryByTestId('turn-change-bar')).not.toBeInTheDocument();
  });
});

describe('the document panel on desktop', () => {
  const routes = () => [
    { match: on('GET', /\/session$/), respond: () => json({ turns: [], actions: [], pending: null, isRunning: false }) },
    documents(),
    doc(),
  ];

  it('goes back to the documents of the base', async () => {
    setViewport('desktop');
    window.history.replaceState(null, '', '/es/chat/kb/kb-1/doc/tbl');
    mockFetch(routes());
    renderApp(<Conversation kbId="kb-1" docId="tbl" />);
    const panel = await screen.findByRole('complementary', { name: 'Source' });
    await userEvent.setup().click(within(panel).getByRole('button', { name: 'Back to documents' }));
    expect(window.location.pathname).toBe('/es/chat/kb/kb-1/docs');
  });

  it('expands, shrinks back and resizes from its edge with the keyboard, remembering the width', async () => {
    setViewport('desktop');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
    window.localStorage.removeItem(PANEL_WIDTH_KEY);
    mockFetch(routes());
    renderApp(<Conversation kbId="kb-1" docId="tbl" />);
    const panel = await screen.findByRole('complementary', { name: 'Source' });
    expect(panel).toHaveStyle({ width: `${PANEL_DEFAULT}px` });

    const user = userEvent.setup();
    await user.click(within(panel).getByRole('button', { name: 'Expand the document' }));
    expect(panel).toHaveStyle({ width: '1040px' });
    expect(within(panel).getByRole('button', { name: 'Shrink the document' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(panel).getByRole('button', { name: 'Shrink the document' }));
    expect(panel).toHaveStyle({ width: `${PANEL_DEFAULT}px` });

    const edge = within(panel).getByRole('separator', { name: 'Drag to change the document width' });
    fireEvent.keyDown(edge, { key: 'ArrowLeft' });
    expect(panel).toHaveStyle({ width: `${PANEL_DEFAULT + 32}px` });
    expect(window.localStorage.getItem(PANEL_WIDTH_KEY)).toBe(String(PANEL_DEFAULT + 32));
  });
});
