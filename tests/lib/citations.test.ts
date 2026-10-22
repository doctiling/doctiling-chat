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
    expect(linkifyDocCitations('ver [[doc:a1]] y doc:zz-9', hrefFor, labels)).toBe(
      'ver [Alfa](/es/chat/kb/kb1/doc/a1) y [documento](/es/chat/kb/kb1/doc/zz-9)',
    );
  });

  // The model wrote the title where the id goes: never a link to /doc/Grafo (a 404).
  it('a doc: token without digit or dash is not an id: the stray prefix goes, nothing is linked', () => {
    expect(linkifyDocCitations('[1] doc:Grafo de conceptos "Grafo de conceptos".', hrefFor)).toBe(
      '[1] Grafo de conceptos "Grafo de conceptos".',
    );
    expect(linkifyDocCitations('ver [doc:Factura] y [[doc:Nota]]', hrefFor)).toBe('ver Factura y Nota');
    expect(citedDocumentIds('doc:Grafo y doc:a1')).toEqual(['a1']);
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

// doctiling-web notebook/84 §6 (approved 2026-10-16): the agent may cite one entity of a
// graph as doc:ID#Entity "Title". The chat links the document and names the entity;
// the `#Entity` never shows as loose text.
describe('entity citations', () => {
  const href = (id: string) => `/d/${id}`;
  it('links doc:ID#Entity "Title" to the document, labelled with the title and the entity', () => {
    expect(linkifyDocCitations('Ver [1] doc:kb-a1#Prototipo "Grafo".', href)).toBe('Ver [1] [Grafo › Prototipo](/d/kb-a1).');
  });
  it('takes an entity name with spaces and without a title', () => {
    expect(linkifyDocCitations('doc:kb-a1#Vibe checks]', href, { fallbackLabel: 'documento' })).toBe('[documento › Vibe checks](/d/kb-a1)]');
  });
  it('counts the document of an entity citation once', () => {
    expect(citedDocumentIds('doc:kb-a1#Prototipo "G" y doc:kb-a1#Producción "G"')).toEqual(['kb-a1']);
  });
});

// doctiling-web spec 059 US6 (nb/86): the agent cites one block of a document.
describe('block citations', () => {
  it('TS-1076: doc:ID#block-N "Title" reads as the document and the block, and opens the document', () => {
    const labels = { blockLabel: (n: number) => `bloque ${n}` };
    expect(linkifyDocCitations('Plazo de 30 días [1] doc:kb1-g7#block-3 "Guía".', hrefFor, labels)).toBe(
      'Plazo de 30 días [1] [Guía › bloque 3](/es/chat/kb/kb1/doc/kb1-g7).',
    );
  });

  it('a graph entity still reads as the entity', () => {
    expect(linkifyDocCitations('doc:kb1-g1#Cliente "Mapa"', hrefFor, { blockLabel: (n) => `bloque ${n}` })).toBe(
      '[Mapa › Cliente](/es/chat/kb/kb1/doc/kb1-g1)',
    );
  });
});
