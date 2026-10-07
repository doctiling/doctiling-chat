// Stop hook: no "listo" without a green signal. If code files were edited in
// this session and the gate never ran green afterwards, block the stop once and
// name the pending files. Config: .claude/harness.config.json → gate.

import { readFileSync, existsSync } from 'node:fs';
import { loadConfig, readPayload, emit, markerPath } from './harness.mjs';

const payload = await readPayload();
if (!payload) emit(null);

// Already blocked once this turn: don't loop the agent forever.
if (payload.stop_hook_active) emit(null);

const { gate } = loadConfig();
const root = payload.cwd ?? process.cwd();
const marker = markerPath(root, gate.marker);
if (!existsSync(marker)) emit(null);

const files = [...new Set(readFileSync(marker, 'utf8').split('\n').filter(Boolean))];
const fast = gate.fastCommand ? ` (o \`${gate.fastCommand}\` si el build no aplica y dilo explícitamente al entregar)` : '';

emit({
  decision: 'block',
  reason: `[gate-stop] Editaste código sin gate verde: ${files.join(', ')}. Corre \`${gate.command}\`${fast}. El gate limpia ${gate.marker} al pasar. Si el trabajo se abandona a propósito, borra ese marcador y explica por qué.`,
});
