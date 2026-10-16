import { describe, expect, it } from 'vitest';
import { citedDocumentIds, linkifyDocCitations } from '../../src/lib/citations';

const hrefFor = (id: string) => `/es/chat/kb/kb1/doc/${id}`;

// doctiling-web #137: a reader never sees a document id as link text.
describe('linkifyDocCitations', () => {
  it('links a doc:ID "Title" citation by its title', () => {
    expect(linkifyDocCitations('Según doc:a1 "Alfa", sí.', hrefFor)).toBe('Según [Alfa](/es/chat/kb/kb1/doc/a1), sí.');
  });

  it('collapses "Title" (doc:ID) into one link with the title', () => {
    expect(linkifyDocCitations('Creé "Grafo de conceptos" (doc:mrw4-mva5), con 30 entidades [1].', hrefFor)).toBe(
      'Creé [Grafo de conceptos](/es/chat/kb/kb1/doc/mrw4-mva5), con 30 entidades [1].',
    );
    expect(linkifyDocCitations('ver "Alfa" ([doc:a1])', hrefFor)).toBe('ver [Alfa](/es/chat/kb/kb1/doc/a1)');
  });

  it('a bare citation reads as the known title, else as the neutral label, never as the id', () => {
    const labels = { titleFor: (id: string) => (id === 'a1' ? 'Alfa' : undefined), fallbackLabel: 'documento' };
    expect(linkifyDocCitations('ver [[doc:a1]] y doc:zz', hrefFor, labels)).toBe(
      'ver [Alfa](/es/chat/kb/kb1/doc/a1) y [documento](/es/chat/kb/kb1/doc/zz)',
    );
  });

  it('leaves fenced code alone', () => {
    const md = 'x\n```\ndoc:a1 "no"\n```';
    expect(linkifyDocCitations(md, hrefFor)).toBe(md);
  });
});

describe('citedDocumentIds', () => {
  it('still finds the ids inside a "Title" (doc:ID) citation', () => {
    expect(citedDocumentIds('"Alfa" (doc:a1) y [doc:b2]')).toEqual(['a1', 'b2']);
  });
});
