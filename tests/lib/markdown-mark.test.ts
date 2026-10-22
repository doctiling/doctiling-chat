import { describe, it, expect } from 'vitest';
import { parseInline, type Inline } from '../../src/lib/markdown';

const text = (nodes: Inline[]): string =>
  nodes.map((n) => (n.type === 'text' || n.type === 'code' ? n.value : text(n.children))).join('');

describe('==highlight== in chat replies (web spec 059 FR-019)', () => {
  it('TS-1053: ==simple== is a mark, with no visible ==', () => {
    const nodes = parseInline('antes ==simple== después');
    expect(nodes.map((n) => n.type)).toEqual(['text', 'mark', 'text']);
    expect(text(nodes)).toBe('antes simple después');
  });

  it('TS-1053: a highlight that wraps bold keeps the bold inside the mark', () => {
    const mark = parseInline('==**negrita** y más==')[0]!;
    expect(mark.type).toBe('mark');
    expect(mark.type === 'mark' && mark.children.map((c) => c.type)).toEqual(['strong', 'text']);
    expect(text([mark])).toBe('negrita y más');
  });

  it('TS-1054: an equality stays text', () => {
    expect(parseInline('a == b y c == d').map((n) => n.type)).toEqual(['text']);
  });
});
