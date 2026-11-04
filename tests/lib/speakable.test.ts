import { describe, expect, it } from 'vitest';
import { speakableText, splitSentences } from '../../src/lib/speakable';

describe('speakableText', () => {
  it('reads headings, paragraphs, lists and quotes as plain text, one block per paragraph', () => {
    const text = speakableText('# Title\n\nSome **bold** and _soft_ text.\n\n- one\n- two\n\n> a quote');
    expect(text).toBe('Title\n\nSome bold and soft text.\n\none\ntwo\n\na quote');
  });

  it('reads a link by its label and inline code as its text', () => {
    expect(speakableText('See [the report](https://x.io) and `npm test`.')).toBe('See the report and npm test.');
  });

  it('skips code blocks, diagrams and tables instead of spelling them out', () => {
    const md = 'Before\n\n```mermaid\nflowchart TD\n  A --> B\n```\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nAfter';
    expect(speakableText(md)).toBe('Before\n\nAfter');
  });

  it('is empty for an empty or code-only message', () => {
    expect(speakableText('')).toBe('');
    expect(speakableText('```ts\nconst x = 1;\n```')).toBe('');
  });
});

describe('splitSentences', () => {
  it('splits at sentence ends and line breaks, keeping the punctuation', () => {
    expect(splitSentences('One. Two! Three?\nFour')).toEqual(['One.', 'Two!', 'Three?', 'Four']);
  });

  it('drops blanks', () => {
    expect(splitSentences('  \n\n ')).toEqual([]);
  });
});

// Owner QA 2026-11-04: the voice read the citations aloud, ids and block numbers included.
describe('speakableText — citations are not read', () => {
  it('drops doc citations, with or without block, entity or title', () => {
    const md =
      'Son 10 charlas doc:kb1-abc2#block-2 "Información general". Hay workshop [doc:kb1-abc3] y café [[doc:kb1-abc4]].';
    expect(speakableText(md)).toBe('Son 10 charlas. Hay workshop y café.');
  });

  it('keeps the title the model wrote in prose and drops the id after it', () => {
    expect(speakableText('Según "Preguntas frecuentes" (doc:kb1-abc5), hay parqueadero.')).toBe(
      'Según Preguntas frecuentes, hay parqueadero.',
    );
  });

  it('drops block markers like #2, [#2] and «› #2»', () => {
    expect(speakableText('Escenario 1 [#2] y Escenario 2 (#3). Agenda › #4.')).toBe('Escenario 1 y Escenario 2. Agenda.');
  });
});
