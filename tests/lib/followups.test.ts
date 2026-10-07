import { describe, expect, it } from 'vitest';
import { splitFollowups } from '@/lib/followups';

// Spec 009 FR-008 applied to the chat: the <followups> block becomes chips, never raw text.
describe('splitFollowups', () => {
  it('extracts up to three questions and removes the block from the text', () => {
    const r = splitFollowups('Tienes 15 días. [1]\n\n<followups>\n→ ¿Cómo se acumulan?\n→ ¿Qué pasa si no aviso?\n→ ¿Puedo venderlos?\n→ ¿Cuarta?\n</followups>');
    expect(r.text).toBe('Tienes 15 días. [1]');
    expect(r.followups).toEqual(['¿Cómo se acumulan?', '¿Qué pasa si no aviso?', '¿Puedo venderlos?']);
  });

  it('handles the block on one line and leaves text without a block untouched', () => {
    expect(splitFollowups('Hola <followups> → a → b </followups>')).toEqual({ text: 'Hola', followups: ['a', 'b'] });
    expect(splitFollowups('Sin bloque')).toEqual({ text: 'Sin bloque', followups: [] });
  });
});
