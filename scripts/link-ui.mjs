#!/usr/bin/env node
// The design system (@doctiling/ui) is a peer that lives in the sibling doctiling-web checkout:
// `.ui` → web/packages/ui, so typecheck and tests resolve it. Node, not sh: a gate signal must
// run on every OS. Override the location with DOCTILING_UI_DIR.
import { existsSync, rmSync, symlinkSync, readlinkSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UI = path.resolve(process.env.DOCTILING_UI_DIR ?? path.join(ROOT, '..', 'web', 'packages', 'ui'));
const LINK = path.join(ROOT, '.ui');

if (!existsSync(path.join(UI, 'package.json'))) {
  console.error(`link-ui: no @doctiling/ui at ${UI} — clone doctiling-web next to this repo or set DOCTILING_UI_DIR`);
  process.exit(1);
}
try {
  if (lstatSync(LINK)) rmSync(LINK, { recursive: true, force: true });
} catch {
  /* nothing to remove */
}
symlinkSync(UI, LINK, 'dir');
console.log(`link-ui: .ui -> ${readlinkSync(LINK)}`);
