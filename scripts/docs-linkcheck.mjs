// No reference to a document may point at nothing: relative markdown links
// between docs, and `docs/...` paths cited in any tracked text file. Measured
// against `git ls-files` (+ untracked, not ignored), not the disk: a pointer to
// an ignored file is green locally and red in CI.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sh = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const tracked = sh(['ls-files']).split('\n').filter(Boolean);
const untracked = sh(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
const known = new Set([...tracked, ...untracked]);
const isKnown = (rel) => known.has(rel) || [...known].some((f) => f.startsWith(`${rel.replace(/\/$/, '')}/`));

const { linkcheck = {} } = JSON.parse(readFileSync(path.join(root, '.claude', 'harness.config.json'), 'utf8'));
const ignored = (f) => (linkcheck.ignore ?? []).some((prefix) => f.startsWith(prefix));
const files = [...known].filter((f) => /\.(md|ts|tsx|mjs|js|json|sh|yml|yaml)$/.test(f) && !f.includes('node_modules/') && !ignored(f));
const broken = [];

for (const rel of files) {
  readFileSync(path.join(root, rel), 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const refs = new Set();
      for (const m of line.matchAll(/(?<![\w./-])docs\/[A-Za-z0-9._/-]+\.(md|mjs|sh|html|png)/g)) refs.add(m[0]);
      if (rel.endsWith('.md')) {
        for (const m of line.matchAll(/\]\(([A-Za-z0-9._/-]+\.md)\)/g)) refs.add(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
      }
      for (const ref of refs) if (!isKnown(ref)) broken.push(`${rel}:${i + 1} → ${ref}`);
    });
}

if (broken.length) {
  console.error(`docs-linkcheck: ${broken.length} broken reference(s)\n` + broken.map((b) => `  - ${b}`).join('\n'));
  process.exit(1);
}
console.info(`docs-linkcheck: OK (${files.length} files checked)`);
