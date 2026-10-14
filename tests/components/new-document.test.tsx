import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewDocumentSheet } from '../../src/components/NewDocumentSheet';
import { json, mockFetch, ndjson, on, renderApp } from '../helpers/render';

// spec 054 — "New document" in the chat: the studio's five methods, documents born unindexed, one index question.
const item = (id: string, title: string, type = 'text') => ({ id, title, type, visibility: 'shared', indexed: false });
const created = () => {
  let n = 0;
  return {
    match: on('POST', /\/kb-1\/documents$/),
    respond: (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { type: string; title: string };
      n += 1;
      return json({ document: item(`d${n}`, body.title, body.type) }, 201);
    },
  };
};
const bodies = (calls: { url: string; init: RequestInit }[], re: RegExp) =>
  calls.filter((c) => re.test(c.url) && c.init.method === 'POST').map((c) => (typeof c.init.body === 'string' ? JSON.parse(c.init.body) : c.init.body));

async function openMethod(name: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByTestId('new-document'));
  await user.click(await screen.findByRole('button', { name }));
  return user;
}

describe('NewDocumentSheet', () => {
  it('[TS-622] offers the five studio methods with their description', async () => {
    renderApp(<NewDocumentSheet kbId="kb-1" canCreate />);
    expect(screen.getByRole('button', { name: 'New document' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByTestId('new-document'));
    const list = await screen.findByRole('list', { name: 'New document' });
    const methods = within(list).getAllByRole('button');
    expect(methods.map((m) => m.dataset.method)).toEqual(['generate', 'blank', 'table', 'graph', 'convert']);
    expect(within(methods[0]!).getByText('Provide a topic and the AI will generate a complete document for you.')).toBeInTheDocument();
    expect(within(methods[4]!).getByText('Convert')).toBeInTheDocument();
  });

  it('[TS-628] without admin rights the trigger is disabled and says why; nothing opens', async () => {
    renderApp(<NewDocumentSheet kbId="kb-1" canCreate={false} />);
    const trigger = screen.getByRole('button', { name: 'Only administrators of this base can create or upload documents.' });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    await userEvent.setup().click(trigger);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('[TS-615][TS-616] a PDF becomes a text document, then "Index now" indexes it', async () => {
    const { calls } = mockFetch([
      { match: on('POST', /\/documents\/convert$/), respond: () => json({ kind: 'text', title: 'Vacaciones', markdown: '# Vacaciones' }) },
      created(),
      { match: on('POST', /\/documents\/index$/), respond: () => json({ results: [{ id: 'd1', ok: true }] }) },
    ]);
    const onCreated = vi.fn();
    renderApp(<NewDocumentSheet kbId="kb-1" canCreate onCreated={onCreated} />);
    const user = await openMethod(/^Convert/);
    await user.upload(screen.getByTestId('convert-input'), new File(['%PDF'], 'Vacaciones.pdf', { type: 'application/pdf' }));
    const prompt = await screen.findByTestId('index-prompt');
    expect(within(prompt).getByText('"Vacaciones" was created. Indexing makes it available to the agent\'s answers.')).toBeInTheDocument();
    expect(bodies(calls, /\/documents$/)).toEqual([{ type: 'text', title: 'Vacaciones', content: '# Vacaciones' }]);
    expect(onCreated).toHaveBeenCalledWith([item('d1', 'Vacaciones')]);
    await user.click(within(prompt).getByRole('button', { name: 'Index now' }));
    expect(await within(prompt).findByText('Indexed.')).toBeInTheDocument();
    expect(bodies(calls, /\/documents\/index$/)).toEqual([{ documentIds: ['d1'] }]);
  });

  it('[TS-617] "Later" closes without indexing', async () => {
    const { calls } = mockFetch([
      { match: on('POST', /\/documents\/convert$/), respond: () => json({ kind: 'text', title: 'Plan', markdown: 'x' }) },
      created(),
    ]);
    renderApp(<NewDocumentSheet kbId="kb-1" canCreate />);
    const user = await openMethod(/^Convert/);
    await user.upload(screen.getByTestId('convert-input'), new File(['x'], 'Plan.docx'));
    await user.click(await screen.findByRole('button', { name: 'Later' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls.some((c) => /\/index$/.test(c.url))).toBe(false);
  });

  it('[TS-619] a workbook with two sheets lets the person pick; each chosen sheet is a table', async () => {
    const sheet = (name: string) => ({ name, rowCount: 2, columnCount: 1, table: { columns: [{ id: 'a', name: 'A' }], rows: [] } });
    const { calls } = mockFetch([
      { match: on('POST', /\/documents\/convert$/), respond: () => json({ kind: 'sheets', title: 'Plan', sheets: [sheet('Ventas'), sheet('Costos')] }) },
      created(),
    ]);
    renderApp(<NewDocumentSheet kbId="kb-1" canCreate />);
    const user = await openMethod(/^Convert/);
    await user.upload(screen.getByTestId('convert-input'), new File(['x'], 'Plan.xlsx'));
    const picker = await screen.findByTestId('sheet-picker');
    await user.click(within(picker).getByRole('checkbox', { name: /Costos/ }));
    await user.click(within(picker).getByRole('button', { name: 'Convert 1 sheets' }));
    await screen.findByTestId('index-prompt');
    expect(bodies(calls, /\/documents$/)).toEqual([
      { type: 'database', title: 'Plan — Ventas', content: JSON.stringify({ columns: [{ id: 'a', name: 'A' }], rows: [] }) },
    ]);
  });

  it('[TS-620] an unsupported file is refused with its reason and nothing is created', async () => {
    const { calls } = mockFetch([{ match: on('POST', /\/documents\/convert$/), respond: () => json({ error: 'unsupported_type' }, 415) }]);
    renderApp(<NewDocumentSheet kbId="kb-1" canCreate />);
    const user = await openMethod(/^Convert/);
    await user.upload(screen.getByTestId('convert-input'), new File(['x'], 'programa.pdf'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('programa.pdf: This file type cannot be converted. Use a PDF, a DOCX or a spreadsheet.');
    expect(alert).toHaveTextContent('No document was created.');
    expect(bodies(calls, /\/documents$/)).toEqual([]);
  });

  it('[TS-621] several files make one index question for every created document, and list the failures', async () => {
    const { calls } = mockFetch([
      {
        match: on('POST', /\/documents\/convert$/),
        respond: (_u: string, init: RequestInit) => {
          const name = ((init.body as FormData).get('file') as File).name;
          return name === 'roto.pdf' ? json({ error: 'extraction_failed' }, 422) : json({ kind: 'text', title: name.replace(/\..+$/, ''), markdown: name });
        },
      },
      created(),
      { match: on('POST', /\/documents\/index$/), respond: () => json({ results: [{ id: 'd1', ok: true }, { id: 'd2', ok: true }] }) },
    ]);
    renderApp(<NewDocumentSheet kbId="kb-1" canCreate />);
    const user = await openMethod(/^Convert/);
    await user.upload(screen.getByTestId('convert-input'), [new File(['x'], 'a.pdf'), new File(['x'], 'roto.pdf'), new File(['x'], 'b.docx')]);
    const prompt = await screen.findByTestId('index-prompt');
    expect(within(prompt).getByText('2 documents were created. Indexing makes them available to the agent\'s answers.')).toBeInTheDocument();
    expect(within(prompt).getByTestId('index-prompt-problems')).toHaveTextContent('roto.pdf: The file could not be read. It may be damaged.');
    await user.click(within(prompt).getByRole('button', { name: 'Index now' }));
    await within(prompt).findByText('Indexed.');
    expect(bodies(calls, /\/documents\/index$/)).toEqual([{ documentIds: ['d1', 'd2'] }]);
  });

  it('refuses more files than the studio allows at once', async () => {
    const { calls } = mockFetch([]);
    renderApp(<NewDocumentSheet kbId="kb-1" canCreate />);
    const user = await openMethod(/^Convert/);
    await user.upload(
      screen.getByTestId('convert-input'),
      Array.from({ length: 21 }, (_, i) => new File(['x'], `f${i}.pdf`)),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose at most 20 files at a time.');
    expect(calls).toHaveLength(0);
  });

  it('[TS-623] Generate with AI shows the progress, then asks whether to index the saved document', async () => {
    const { calls } = mockFetch([
      {
        match: on('POST', /\/documents\/generate$/),
        respond: () =>
          ndjson([
            { status: 'Thinking', thinkingChunk: '…' },
            { status: 'Drafting', analysisChunk: '# Guía' },
            { status: 'Saved', document: item('g1', 'Guía') },
          ]),
      },
    ]);
    const onCreated = vi.fn();
    renderApp(<NewDocumentSheet kbId="kb-1" canCreate onCreated={onCreated} />);
    const user = await openMethod(/^Generate with AI/);
    await user.type(screen.getByRole('textbox', { name: 'Topic' }), 'vacaciones');
    await user.click(screen.getByRole('button', { name: 'Generate document' }));
    const prompt = await screen.findByTestId('index-prompt');
    expect(within(prompt).getByText(/"Guía" was created/)).toBeInTheDocument();
    expect(onCreated).toHaveBeenCalledWith([item('g1', 'Guía')]);
    expect(bodies(calls, /\/generate$/)).toEqual([{ topic: 'vacaciones', locale: 'en' }]);
  });

  it('[TS-625] a quota error is explained and no index question appears', async () => {
    mockFetch([{ match: on('POST', /\/documents\/generate$/), respond: () => ndjson([{ status: 'Drafting', analysisChunk: '# A' }, { status: 'Error', code: 'quota_exceeded' }]) }]);
    renderApp(<NewDocumentSheet kbId="kb-1" canCreate />);
    const user = await openMethod(/^Generate with AI/);
    await user.type(screen.getByRole('textbox', { name: 'Topic' }), 'x');
    await user.click(screen.getByRole('button', { name: 'Generate document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You reached your AI request limit. Try again later.');
    expect(screen.queryByTestId('index-prompt')).not.toBeInTheDocument();
  });

  it.each([
    [/^Blank/, 'text'],
    [/^Table/, 'database'],
    [/^Graph/, 'graph'],
  ])('[TS-624] %s creates the empty document and offers the studio or the agent', async (name, type) => {
    const { calls } = mockFetch([created()]);
    const onAskAgent = vi.fn();
    renderApp(<NewDocumentSheet kbId="kb-1" canCreate onAskAgent={onAskAgent} />);
    const user = await openMethod(name);
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Mapa');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    const done = await screen.findByTestId('document-created');
    expect(bodies(calls, /\/documents$/)).toEqual([{ type, title: 'Mapa' }]);
    expect(within(done).getByRole('link', { name: 'Open in the studio' })).toHaveAttribute('href', '/es/kb/kb-1/d1');
    expect(screen.queryByTestId('index-prompt')).not.toBeInTheDocument();
    await user.click(within(done).getByRole('button', { name: 'Ask the agent to fill it' }));
    expect(onAskAgent).toHaveBeenCalledWith(item('d1', 'Mapa', type));
  });

  it('a creation refused by the server shows its reason', async () => {
    mockFetch([{ match: on('POST', /\/documents$/), respond: () => json({ error: 'forbidden_create' }, 403) }]);
    renderApp(<NewDocumentSheet kbId="kb-1" canCreate />);
    const user = await openMethod(/^Blank/);
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'x');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only administrators of this base can create or upload documents.');
  });
});
