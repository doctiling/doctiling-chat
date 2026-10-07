// White-label guard (CONSTITUTION P1, BLOCKING): no AI vendor name reaches the
// person. Scans everything under src/ and public/ (code, copy, dictionaries,
// manifest, offline page) on disk, not only what git tracks, so a fresh clone
// before its first commit is checked the same way as CI.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Shared shape with doctiling-landing scripts/lib/vendor-pattern.mjs, extended
// with the other vendors the plan names: the chat is a client of whatever model
// the tenant runs and must never say which.
export const VENDOR = /\b(anthropic|claude|sonnet|haiku|opus|openai|gpt(?:-?\d+)?|gemini)\b/i;

const SCAN_DIRS = ['src', 'public'];
const EXT = /\.(tsx?|mjs|js|json|webmanifest|html|css|md)$/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (EXT.test(entry)) yield p;
  }
}

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const targets = files.length > 0 ? files.map((f) => path.resolve(root, f)) : SCAN_DIRS.flatMap((d) => [...walk(path.join(root, d))]);

const hits = [];
for (const file of targets) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    if (VENDOR.test(line)) hits.push(`${path.relative(root, file)}:${i + 1}: ${line.trim().slice(0, 100)}`);
  });
}

if (hits.length > 0) {
  console.error('white-label guard: BLOCKED — vendor name in the product surface (CONSTITUTION P1):');
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.info(`white-label guard: OK (${targets.length} file(s) checked under ${SCAN_DIRS.join(', ')})`);
