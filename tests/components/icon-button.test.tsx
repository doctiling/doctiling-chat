import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconButton } from '../../src/components/IconButton';
import { renderApp } from '../helpers/render';

const root = path.resolve(__dirname, '../..');

// T074 — every icon control has a label (accessible name + design-system tooltip); native title= is banned by lint. [TS-447]
describe('IconButton (T074, TS-447)', () => {
  it('exposes the label as accessible name and as a SimpleTooltip on focus, with a 44px target', async () => {
    renderApp(
      <IconButton label="Refresh the list" onClick={() => {}}>
        <svg aria-hidden="true" />
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Refresh the list' });
    expect(button.className).toMatch(/min-h-\[44px\]/);
    expect(button.className).toMatch(/min-w-\[44px\]/);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    act(() => button.focus());
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Refresh the list');
    expect(button).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('every <IconButton> in the source tree receives a label and no JSX uses a native title=', () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d)) {
        const p = path.join(d, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (e.endsWith('.tsx')) files.push(p);
      }
    };
    walk(path.join(root, 'src'));
    const offenders: string[] = [];
    for (const f of files) {
      // Comments may mention the component by name; only JSX counts.
      const src = readFileSync(f, 'utf8')
        .split('\n')
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join('\n');
      for (const m of src.matchAll(/<IconButton\b([\s\S]*?)>/g)) {
        if (!/\blabel=/.test(m[1] ?? '')) offenders.push(`${path.relative(root, f)}: <IconButton> without label`);
      }
      src.split('\n').forEach((line, i) => {
        if (/<[A-Za-z][^>]*\stitle=/.test(line)) offenders.push(`${path.relative(root, f)}:${i + 1}: native title=`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the lint rule itself bites a title= attribute, an unlabeled IconButton, a Next import and a @/ import', () => {
    const bad = `import * as React from 'react';\nimport Link from 'next/link';\nimport { x } from '@/lib/x';\nimport { IconButton } from './IconButton';\nexport function Bad() { return <div><span title="x">a</span><IconButton onClick={() => {}}><i /></IconButton><Link href={x} /></div>; }\n`;
    const tmp = path.join(root, 'src', 'components', '__lint_sample__.tsx');
    writeFileSync(tmp, bad);
    try {
      let output = '';
      try {
        execFileSync('npx', ['eslint', '--no-warn-ignored', tmp], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e) {
        output = String((e as { stdout?: string }).stdout ?? '') + String((e as { stderr?: string }).stderr ?? '');
      }
      expect(output).toMatch(/Native title= is not a tooltip/);
      expect(output).toMatch(/<IconButton> needs a `label`/);
      expect(output).toMatch(/never imports Next\.js/);
      expect(output).toMatch(/No `@\/` alias here/);
    } finally {
      rmSync(tmp, { force: true });
    }
  }, 60_000);
});
