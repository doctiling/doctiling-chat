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
