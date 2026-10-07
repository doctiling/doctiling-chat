import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mentionAt } from '../../src/lib/documents';
import { Conversation } from '../../src/screens/Conversation';
import { json, mockFetch, ndjson, on, renderApp, sessionStore, setViewport, type Call } from '../helpers/render';

const docs = [
  { id: 'd1', title: 'Vacation policy', type: 'text', visibility: 'shared', indexed: true },
  { id: 'd2', title: 'Salary bands', type: 'database', visibility: 'private', indexed: true },
  { id: 'd3', title: 'Org chart', type: 'graph', visibility: 'shared', indexed: false },
];
const many = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, title: `Memo ${String(i).padStart(2, '0')}`, type: 'text', visibility: 'shared', indexed: true }));

const documents = (items: unknown[] = docs) => ({ match: on('GET', /\/documents$/), respond: () => json({ items }) });
const posts = (calls: Call[]) => calls.filter((c) => c.init.method === 'POST');
const lastBody = (calls: Call[]) => JSON.parse(String(posts(calls).at(-1)!.init.body)) as Record<string, unknown>;

function setup(items: unknown[] = docs) {
  const store = sessionStore();
  const { calls } = mockFetch([
    store.route(),
    documents(items),
    {
      match: on('POST', /\/agent$/),
      respond: (_url, init) => {
        const body = JSON.parse(String(init.body)) as { query: string };
        store.append({ id: `u-${store.state.turns.length}`, role: 'user', content: body.query }, { id: `a-${store.state.turns.length}`, role: 'agent', content: 'Done.' });
        return ndjson([{ status: 'Streaming', role: 'model', analysisChunk: 'Done.' }, { status: 'Done', role: 'system' }]);
      },
    },
  ]);
  renderApp(<Conversation kbId="kb-1" />);
  return { calls, store };
}

async function readyBox() {
  const box = await screen.findByRole('textbox');
  await waitFor(() => expect(box).toBeEnabled());
  // The picker needs the documents; wait for the cache to fill.
  await waitFor(() => expect(screen.getByText(/Type @ to point/)).toBeInTheDocument());
  return box;
}

describe('@ mentions [TS-462]', () => {
  it('[TS-462] mentionAt finds the @ token under the caret, and only at a token start', () => {
    expect(mentionAt('hello @vac', 10)).toEqual({ start: 6, query: 'vac' });
    expect(mentionAt('@', 1)).toEqual({ start: 0, query: '' });
    expect(mentionAt('mail me@work', 12)).toBeNull();
    expect(mentionAt('hello @vac and', 14)).toBeNull();
    expect(mentionAt('hello @vac and', 10)).toEqual({ start: 6, query: 'vac' });
  });

  it('[TS-462] typing @ opens the picker, the text after @ filters it, Esc closes it', async () => {
    setup();
    const user = userEvent.setup();
    const box = await readyBox();
    expect(screen.queryByTestId('mention-picker')).not.toBeInTheDocument();
    await user.type(box, 'Compare @');
    const picker = await screen.findByRole('listbox', { name: 'Documents to reference' });
    expect(within(picker).getAllByRole('option')).toHaveLength(3);
    await user.type(box, 'sal');
    expect(within(picker).getAllByRole('option').map((o) => o.dataset.doc)).toEqual(['d2']);
    expect(within(picker).getByText('Private')).toBeInTheDocument();
    await user.type(box, 'zz');
    expect(within(picker).queryAllByRole('option')).toHaveLength(0);
    expect(within(picker).getByText('No document matches.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    // The typed text stays as it was: Esc only closes the picker.
    expect(box).toHaveValue('Compare @salzz');
  });

  it('[TS-462] desktop: ↑↓ move, Enter picks → a chip, the @… text leaves the box, and Enter then sends referencedDocumentIds', async () => {
    setViewport('desktop');
    const { calls } = setup();
    const user = userEvent.setup();
    const box = await readyBox();
    await user.type(box, 'Compare @');
    const picker = await screen.findByRole('listbox');
    expect(within(picker).getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}');
    expect(within(picker).getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    // Enter picked the option; nothing was sent.
    expect(posts(calls)).toHaveLength(0);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    const chips = screen.getByTestId('mention-chips');
    expect(within(chips).getByText('@Salary bands')).toBeInTheDocument();
    expect(box).toHaveValue('Compare ');
    await user.type(box, 'with @vac{Enter}');
    expect(within(screen.getByTestId('mention-chips')).getAllByRole('button')).toHaveLength(2);
    await user.type(box, 'please{Enter}');
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(lastBody(calls)).toEqual({ query: 'Compare with please', referencedDocumentIds: ['d2', 'd1'] });
    // Chips are cleared after sending; the question shows the references as tags.
    await waitFor(() => expect(screen.queryByTestId('mention-chips')).not.toBeInTheDocument());
    const userTurn = screen.getAllByTestId('turn').find((t) => t.dataset.role === 'user')!;
    expect(userTurn).toHaveTextContent('Compare with please');
    const tags = within(userTurn).getByTestId('turn-refs');
    expect(within(tags).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['@Salary bands', '@Vacation policy']);
    // After the reload that follows the run (server turns, no references) the tags are still there.
    await waitFor(() => expect(screen.getAllByTestId('turn').filter((t) => t.dataset.role === 'agent')).toHaveLength(1));
    expect(within(screen.getAllByTestId('turn').find((t) => t.dataset.role === 'user')!).getByTestId('turn-refs')).toBeInTheDocument();
  });

  it('[TS-462] mobile: a tap picks, a tap on the chip removes it, and without chips the payload has no referencedDocumentIds', async () => {
    const { calls } = setup();
    const user = userEvent.setup();
    const box = await readyBox();
    await user.type(box, '@org');
    await user.click(await screen.findByRole('option', { name: /Org chart/ }));
    const chip = within(screen.getByTestId('mention-chips')).getByRole('button', { name: 'Remove the reference to Org chart' });
    expect(chip).toHaveTextContent('@Org chart');
    expect(box).toHaveValue('');
    // Enter is a newline on a phone: it never picks nor sends.
    await user.type(box, 'who reports to Ana?');
    await user.click(chip);
    expect(screen.queryByTestId('mention-chips')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(lastBody(calls)).toEqual({ query: 'who reports to Ana?' });
    expect(screen.queryByTestId('turn-refs')).not.toBeInTheDocument();
  });

  it('[TS-462] at most 10 references: the eleventh pick shows a translated notice and adds no chip', async () => {
    setup(many);
    const user = userEvent.setup();
    const box = await readyBox();
    for (let i = 0; i < 10; i += 1) {
      await user.type(box, `@${String(i).padStart(2, '0')}`);
      await user.click(await screen.findByRole('option', { name: new RegExp(`Memo ${String(i).padStart(2, '0')}`) }));
    }
    expect(within(screen.getByTestId('mention-chips')).getAllByRole('button')).toHaveLength(10);
    expect(screen.queryByTestId('mention-limit')).not.toBeInTheDocument();
    await user.type(box, '@10');
    await user.click(await screen.findByRole('option', { name: /Memo 10/ }));
    expect(within(screen.getByTestId('mention-chips')).getAllByRole('button')).toHaveLength(10);
    expect(screen.getByTestId('mention-limit')).toHaveTextContent('You can reference up to 10 documents per question.');
    // Removing one chip clears the notice and makes room again.
    await user.click(within(screen.getByTestId('mention-chips')).getAllByRole('button')[0]!);
    expect(screen.queryByTestId('mention-limit')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('mention-chips')).getAllByRole('button')).toHaveLength(9);
  });

  it('[TS-462] the hint under the composer mentions @ in both languages', async () => {
    mockFetch([sessionStore().route(), documents()]);
    const { unmount } = renderApp(<Conversation kbId="kb-1" />, { language: 'es' });
    expect(await screen.findByText(/Escribe @ para dirigir la pregunta a un documento\./)).toBeInTheDocument();
    unmount();
    renderApp(<Conversation kbId="kb-1" />, { language: 'en' });
    expect(await screen.findByText(/Type @ to point the question at a document\./)).toBeInTheDocument();
  });
});
