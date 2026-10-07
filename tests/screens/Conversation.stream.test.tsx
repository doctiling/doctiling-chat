import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Conversation } from '@/screens/Conversation';
import { empty, json, mockFetch, ndjson, on, renderApp, seedToken, sessionStore, setConfig, type Route } from '../helpers/render';

const session = (turns: unknown[] = [], extra: Record<string, unknown> = {}) => json({ turns, actions: [], pending: null, isRunning: false, ...extra });

// T062 — load session, send query, consume events (Tool → activity in product language, Streaming →
// incremental text, Done), citations as links, typed Error translated, Stop aborts and the next send works.
// [TS-411, TS-403, TS-390]
describe('Conversation stream (T062)', () => {
  beforeEach(() => {
    setConfig();
    seedToken();
  });

  it('loads the session and renders existing turns with their activity', async () => {
    mockFetch([
      {
        match: on('GET', /\/kb-pol\/session$/),
        respond: () =>
          session([
            { id: 'u1', role: 'user', content: 'How many vacation days?' },
            { id: 'a1', role: 'agent', content: 'Fifteen days [doc:d1].', activity: [{ toolName: 'search_kb', labelKey: 'kbAgent.activity.searching' }] },
          ]),
      },
    ]);
    renderApp(<Conversation kbId="kb-pol" kbName="Políticas" />);
    expect(await screen.findByText('How many vacation days?')).toBeInTheDocument();
    expect(screen.getByText('Searching the knowledge base')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'd1' });
    expect(link).toHaveAttribute('href', '/kb/kb-pol/doc/d1');
  });

  it('streams: activity while there is no text, incremental text, citations tappable (TS-411)', async () => {
    const events = [
      { status: 'Thinking', role: 'model' },
      { status: 'Tool', role: 'tools', activity: { toolName: 'search_knowledge_base', labelKey: 'kbAgent.activity.searching' } },
      { status: 'Tool', role: 'tools', activity: { toolName: 'weird_tool', labelKey: 'kbAgent.activity.somethingUnknown' } },
      { status: 'Streaming', role: 'model', analysisChunk: 'You have **15** days' },
      { status: 'Streaming', role: 'model', analysisChunk: ' per year [[doc:pol-7]].' },
      { status: 'Done', role: 'system' },
    ];
    let sessionTurns: unknown[] = [];
    const { calls } = mockFetch([
      { match: on('GET', /\/session$/), respond: () => session(sessionTurns) },
      {
        match: on('POST', /\/agent$/),
        respond: () => {
          // What the server persists for this run (activity included): on a slow runner the
          // stream may finish and the session be re-read before the assertions below look.
          sessionTurns = [
            { id: 'u1', role: 'user', content: 'vacation?' },
            {
              id: 'a1',
              role: 'agent',
              content: 'You have **15** days per year [[doc:pol-7]].',
              activity: [
                { toolName: 'search_knowledge_base', labelKey: 'kbAgent.activity.searching' },
                { toolName: 'weird_tool', labelKey: 'kbAgent.activity.somethingUnknown' },
              ],
            },
          ];
          return ndjson(events, { delayMs: 5 });
        },
      },
    ]);
    renderApp(<Conversation kbId="kb-pol" />);
    const user = userEvent.setup();
    const box = await screen.findByRole('textbox');
    await user.type(box, 'vacation?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    // Product language for the tool, generic fallback for an unknown label key, never the tool name.
    await screen.findByText('Searching the knowledge base', {}, { timeout: 5000 });
    await screen.findByText('Working…', {}, { timeout: 5000 });
    expect(screen.queryByText(/weird_tool|search_knowledge_base/)).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getAllByText(/per year/).length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryByTestId('turn-live')).not.toBeInTheDocument());
    const agentTurns = screen.getAllByTestId('turn').filter((t) => t.dataset.role === 'agent');
    expect(agentTurns).toHaveLength(1);
    expect(within(agentTurns[0]!).getByRole('link', { name: 'pol-7' })).toHaveAttribute('href', '/kb/kb-pol/doc/pol-7');
    expect(within(agentTurns[0]!).getByText('15').tagName).toBe('STRONG');
    const post = calls.find((c) => c.init.method === 'POST');
    expect(JSON.parse(String(post!.init.body))).toEqual({ query: 'vacation?' });
    expect(box).toHaveValue('');
  });

  it('a typed Error event is translated (quota_exceeded) and no model name appears (TS-403)', async () => {
    mockFetch([
      { match: on('GET', /\/session$/), respond: () => session() },
      { match: on('POST', /\/agent$/), respond: () => ndjson([{ status: 'Error', role: 'system', error: { code: 'quota_exceeded', message: 'internal provider text' } }]) },
    ]);
    renderApp(<Conversation kbId="kb-pol" />, { language: 'es' });
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox'), 'hola');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Alcanzaste tu límite diario');
    expect(screen.queryByText(/internal provider text/)).not.toBeInTheDocument();
  });

  it('a 403 on send shows the permission notice (TS-390)', async () => {
    mockFetch([
      { match: on('GET', /\/session$/), respond: () => session() },
      { match: on('POST', /\/agent$/), respond: () => json({ error: 'forbidden', messageKey: 'x' }, 403) },
    ]);
    renderApp(<Conversation kbId="kb-pol" />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox'), 'delete everything');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByTestId('notice')).toHaveTextContent(/does not allow that/i);
  });

  it('Stop aborts the stream and the next send is accepted (TS-411)', async () => {
    let aborted = false;
    const store = sessionStore();
    const routes: Route[] = [
      store.route(),
      {
        match: on('POST', /\/agent$/),
        respond: (_url, init) => {
          if (aborted) {
            store.append({ id: 'u2', role: 'user', content: 'second' }, { id: 'a2', role: 'agent', content: 'second answer' });
            return ndjson([{ status: 'Streaming', role: 'model', analysisChunk: 'second answer' }, { status: 'Done', role: 'system' }]);
          }
          const signal = init.signal!;
          return new Promise<Response>((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              aborted = true;
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            });
          });
        },
      },
      { match: on('POST', /\/clear$/), respond: () => empty() },
    ];
    const { calls } = mockFetch(routes);
    renderApp(<Conversation kbId="kb-pol" />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox'), 'first');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const stop = await screen.findByRole('button', { name: 'Stop' });
    // Stop ignores taps in its first 400 ms (a double tap on Send must not abort): a tap right away does nothing…
    await user.click(stop);
    expect(aborted).toBe(false);
    await new Promise((r) => setTimeout(r, 450));
    // …and a deliberate tap afterwards aborts.
    await user.click(stop);
    await waitFor(() => expect(aborted).toBe(true));
    expect(calls.find((c) => c.init.method === 'POST')!.init.signal!.aborted).toBe(true);
    await screen.findByRole('button', { name: 'Send' });
    await user.type(screen.getByRole('textbox'), 'second');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getAllByText('second answer').length).toBeGreaterThan(0));
  });
});
