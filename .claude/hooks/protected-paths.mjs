// PreToolUse guard: read-only paths for the agent (harness pillar 4).
// The list itself lives in .claude/harness.config.json → protectedPaths.

import { loadConfig, readPayload, deny, emit } from './harness.mjs';

const payload = await readPayload();
if (!payload) emit(null);

const p = String(payload.tool_input?.file_path ?? '').replace(/\\/g, '/');
if (!p) emit(null);

const { protectedPaths, docs } = loadConfig();
const hit = protectedPaths.find((rule) => new RegExp(rule.pattern).test(p));

if (hit) {
  deny('PreToolUse', `[protected-paths] ${p}: ${hit.reason} Ver ${docs.harness} §Rutas protegidas.`);
}
emit(null);
