// Shared plumbing for the hooks: read the hook payload from stdin, load the
// repo-specific config, emit the decision. No hook hardcodes a repo path.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadConfig() {
  return JSON.parse(readFileSync(path.join(here, '..', 'harness.config.json'), 'utf8'));
}

export async function readPayload() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

export function emit(value) {
  if (value) process.stdout.write(JSON.stringify(value));
  process.exit(0);
}

export function deny(hookEventName, reason) {
  emit({
    hookSpecificOutput: { hookEventName, permissionDecision: 'deny', permissionDecisionReason: reason },
  });
}

export function context(hookEventName, additionalContext) {
  emit({ hookSpecificOutput: { hookEventName, additionalContext } });
}

// A marker under `.git/` lives in the git COMMON dir: in a worktree `.git` is a
// file, so `<root>/.git/<x>` can neither be written nor read and the Stop gate
// never armed there. gate.sh clears the same resolved path.
export function markerPath(root, marker) {
  if (!marker.startsWith('.git/')) return path.join(root, marker);
  try {
    const common = execFileSync('git', ['-C', root, 'rev-parse', '--git-common-dir'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return path.resolve(root, common, marker.slice('.git/'.length));
  } catch {
    return path.join(root, marker);
  }
}
