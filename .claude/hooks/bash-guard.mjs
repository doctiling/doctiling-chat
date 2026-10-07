// PreToolUse guard for Bash: irreversible or gate-skipping commands.
// The rule list lives in .claude/harness.config.json → bashRules.

import { loadConfig, readPayload, deny, emit } from './harness.mjs';

const payload = await readPayload();
if (!payload) emit(null);

const cmd = String(payload.tool_input?.command ?? '');
if (!cmd) emit(null);

const { bashRules, docs } = loadConfig();
const hit = bashRules.find((rule) => new RegExp(rule.pattern).test(cmd));

if (hit) {
  deny('PreToolUse', `[bash-guard] ${hit.reason} Ver ${docs.harness} §Sandbox.`);
}
emit(null);
