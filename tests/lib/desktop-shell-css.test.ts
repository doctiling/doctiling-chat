import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// On desktop the conversation fills its column: auto side margins on a flex
// child stop it from stretching and leave a gap on the right.
describe('desktop shell layout', () => {
  it('lets the conversation column fill the width', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
    const rule = css.match(/\.desktop-shell \.app-shell \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/margin:\s*0;/);
    expect(rule).toMatch(/width:\s*100%;/);
    expect(rule).toMatch(/max-width:\s*none;/);
  });
});
