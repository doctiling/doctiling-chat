// PostToolUse: the cheapest feedback loop that exists — lint the file the
// agent just touched, and mark the tree as "gate pending" so the Stop hook can
// refuse to finish without a green gate. Config: .claude/harness.config.json.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, readPayload, emit, markerPath } from './harness.mjs';

const payload = await readPayload();
if (!payload) emit(null);

// The session cwd can sit in a subfolder (e.g. video/): resolve paths from the
// repo root, or video/src/x.ts is read as src/x.ts and linted as app code.
const cwd = payload.cwd ?? process.cwd();
let root = cwd;
try {
  root = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
} catch {
  // not a git checkout: keep cwd
}
const file = String(payload.tool_input?.file_path ?? '');
if (!file) emit(null);

const { gate } = loadConfig();
const rel = path.relative(root, file).replace(/\\/g, '/');
if (!new RegExp(gate.codePathPattern).test(rel)) emit(null);

try {
  writeFileSync(markerPath(root, gate.marker), `${rel}\n`, { flag: 'a' });
} catch {
  // no git dir at all (tarball, CI): the Stop gate simply doesn't arm
}

// gate.postEdit is the repo's own per-edit check (its thresholds included);
// appendFile=false runs a whole-project check such as `tsc --noEmit`.
const { command, appendFile } = gate.postEdit;
let lint = '';
try {
  execFileSync(command[0], [...command.slice(1), ...(appendFile ? [rel] : [])], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  });
} catch (e) {
  lint = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
}

if (lint) {
  emit({
    decision: 'block',
    reason: `[post-edit-check] \`${command.join(' ')}\` falla tras editar ${rel}. Lee el error real antes de reintentar:\n${lint.slice(0, 4000)}`,
  });
}
emit(null);
