import { describe, expect, it } from 'vitest';
import { citedDocumentIds, linkifyDocCitations } from '../../src/lib/citations';
import { parseMarkdown } from '../../src/lib/markdown';
import { makePaths, parseRoute, stripBasePath } from '../../src/lib/router';

// T061 — the routes under the host's basePath; T062 — citations in every shape the agent writes. [TS-399, TS-411]
describe('router (T061)', () => {
  const base = '/es/chat';

  it('parses every route below basePath and builds the matching paths', () => {
    expect(parseRoute('/es/chat', base)).toEqual({ name: 'kbs' });
    expect(parseRoute('/es/chat/', base)).toEqual({ name: 'kbs' });
    expect(parseRoute('/es/chat/kb', base)).toEqual({ name: 'kbs' });
    expect(parseRoute('/es/chat/kb/abc', base)).toEqual({ name: 'conversation', kbId: 'abc' });
    expect(parseRoute('/es/chat/kb/abc/doc/d%201', base)).toEqual({ name: 'conversation', kbId: 'abc', docId: 'd 1' });
    expect(parseRoute('/es/chat/settings', base)).toEqual({ name: 'settings' });
    expect(parseRoute('/es/chat/offline', base)).toEqual({ name: 'offline' });
    expect(parseRoute('/es/chat/nope/x', base)).toEqual({ name: 'kbs' });
    const paths = makePaths(base);
    expect(paths.kbs()).toBe('/es/chat/kb');
    expect(paths.document('a b', 'c')).toBe('/es/chat/kb/a%20b/doc/c');
    expect(paths.settings()).toBe('/es/chat/settings');
  });

  it('a path outside basePath (or a prefix collision like /es/chatty) is the list, never a crash', () => {
    expect(stripBasePath('/es/kb', base)).toBe('/');
    expect(stripBasePath('/es/chatty/kb/x', base)).toBe('/');
    expect(parseRoute('/en/chat/kb/x', base)).toEqual({ name: 'kbs' });
    expect(parseRoute('/kb/x', '')).toEqual({ name: 'conversation', kbId: 'x' });
  });
});

describe('citations (T062)', () => {
  const href = (id: string) => `/es/chat/kb/k/doc/${id}`;
  it('links doc:ID "Title", [doc:ID] and [[doc:ID]] and leaves fenced code alone', () => {
    const md = 'A doc:d1 "Policy" B [doc:d2] C [[doc:d3]]\n```\ndoc:d4\n```';
    const out = linkifyDocCitations(md, href);
    expect(out).toContain('[Policy](/es/chat/kb/k/doc/d1)');
    expect(out).toContain('[d2](/es/chat/kb/k/doc/d2)');
    expect(out).toContain('[d3](/es/chat/kb/k/doc/d3)');
    expect(out).toContain('```\ndoc:d4\n```');
    expect(citedDocumentIds(md)).toEqual(['d1', 'd2', 'd3']);
  });
});

describe('markdown (T063)', () => {
  it('parses headings, lists, code, quotes, tables and inline marks', () => {
    const blocks = parseMarkdown('# Title\n\nSome **bold** and `code` and [link](/x).\n\n- one\n- two\n\n1. first\n\n> quoted\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nlet x\n```');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'list', 'quote', 'table', 'code']);
    const para = blocks[1];
    expect(para?.type === 'paragraph' && para.children.map((c) => c.type)).toEqual(['text', 'strong', 'text', 'code', 'text', 'link', 'text']);
    const list = blocks[3];
    expect(list?.type === 'list' && list.ordered).toBe(true);
    const code = blocks[6];
    expect(code?.type === 'code' && code.lang).toBe('js');
  });
});
