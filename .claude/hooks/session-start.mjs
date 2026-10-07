// SessionStart: load verified project state instead of re-deriving it, and
// self-check the harness (a hook that isn't installed is "instalado y muerto").
// Config: .claude/harness.config.json.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, readPayload, context, markerPath } from './harness.mjs';

const payload = (await readPayload()) ?? {};
const cfg = loadConfig();
const root = payload.cwd ?? process.cwd();

const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const lines = [];
lines.push(`rama: ${git(['rev-parse', '--abbrev-ref', 'HEAD']) || '?'} · último commit: ${git(['log', '-1', '--oneline']) || '?'}`);
lines.push(`archivos con cambios sin commitear: ${git(['status', '--porcelain']).split('\n').filter(Boolean).length}`);

if (git(['config', 'core.hooksPath']) !== cfg.hooksPath) {
  lines.push(`AVISO: pre-commit NO instalado (core.hooksPath ≠ ${cfg.hooksPath}). Corre \`${cfg.hooksInstallCommand}\`.`);
}

if (existsSync(markerPath(root, cfg.gate.marker))) {
  lines.push(`AVISO: hay ediciones sin gate verde pendientes (${cfg.gate.marker}). Corre \`${cfg.gate.command}\`.`);
}

const status = path.join(root, cfg.docs.status);
if (existsSync(status)) {
  lines.push('', `— ${cfg.docs.status} (estado verificado) —`, readFileSync(status, 'utf8').split('\n').slice(0, 40).join('\n'));
}

context('SessionStart', lines.join('\n'));
