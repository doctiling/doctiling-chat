// Git half of the protected-paths rule: the same list the agent's PreToolUse
// hook reads (.claude/harness.config.json → protectedPaths), applied to the
// paths about to enter history. Rules with `agentOnly: true` stop the agent
// from editing a file, not a human from committing it (a regenerated lockfile,
// a generated migration). Staged paths arrive on stdin, one per line.
// Called by .githooks/pre-commit; the self-test feeds it samples.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { protectedPaths = [] } = JSON.parse(readFileSync(path.join(root, '.claude', 'harness.config.json'), 'utf8'));
const rules = protectedPaths.filter((r) => !r.agentOnly).map((r) => ({ ...r, re: new RegExp(r.pattern) }));

const staged = readFileSync(0, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const hits = staged.flatMap((f) => rules.filter((r) => r.re.test(f)).map((r) => `  - ${f}: ${r.reason}`));

if (hits.length) {
  console.error(`pre-commit: ruta protegida en el commit:\n${hits.join('\n')}`);
  process.exit(1);
}
