import { describe, expect, it } from 'vitest';
import { citedDocumentIds, linkifyDocCitations } from '@/lib/citations';
import { parseMarkdown } from '@/lib/markdown';
import { parseRoute, paths } from '@/lib/router';

// T061 — the seven routes; T062 — citations in every shape the agent writes. [TS-399, TS-411]
describe('router (T061)', () => {
  it('parses every route and builds the matching paths', () => {
    expect(parseRoute('/')).toEqual({ name: 'connect' });
    expect(parseRoute('/connect')).toEqual({ name: 'connect' });
    expect(parseRoute('/connect/callback')).toEqual({ name: 'callback' });
    expect(parseRoute('/kb')).toEqual({ name: 'kbs' });
    expect(parseRoute('/kb/abc')).toEqual({ name: 'conversation', kbId: 'abc' });
    expect(parseRoute('/kb/abc/doc/d%201')).toEqual({ name: 'conversation', kbId: 'abc', docId: 'd 1' });
    expect(parseRoute('/settings')).toEqual({ name: 'settings' });
    expect(parseRoute('/offline')).toEqual({ name: 'offline' });
    expect(parseRoute('/nope/x')).toEqual({ name: 'connect' });
    expect(paths.document('a b', 'c')).toBe('/kb/a%20b/doc/c');
  });
});

describe('citations (T062)', () => {
  const href = (id: string) => `/kb/k/doc/${id}`;
  it('links doc:ID "Title", [doc:ID] and [[doc:ID]] and leaves fenced code alone', () => {
    const md = 'A doc:d1 "Policy" B [doc:d2] C [[doc:d3]]\n```\ndoc:d4\n```';
    const out = linkifyDocCitations(md, href);
    expect(out).toContain('[Policy](/kb/k/doc/d1)');
    expect(out).toContain('[d2](/kb/k/doc/d2)');
    expect(out).toContain('[d3](/kb/k/doc/d3)');
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
