// Generic half of the harness self-test: everything here reads
// .claude/harness.config.json and knows nothing about this repo. The same file
// is copied into every Doctiling repo (web, cli, mobile); each repo's
// scripts/harness-selftest.mjs calls it and adds its own cases.
// Definitions: https://raalzate.github.io/agent-harness/ (P2, P3, P6, P7, P8, P10, P13).

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * A concrete string the config regex should match, derived from the regex itself, so a new
 * rule is covered without writing a case. Ported from agent-harness/scripts/harness-selftest.mjs.
 * Returns null when the pattern cannot be reduced: the case is reported as omitted, never passed.
 */
export function sampleFromPattern(pattern) {
  if (/\(\?<|\\k</.test(pattern)) return null;
  const PH = { '|': '\u0001', '(': '\u0002', ')': '\u0003', '[': '\u0004', ']': '\u0005', '{': '\u0006', '}': '\u0007' };
  let s = pattern.replace(/\\([.\/\-*+?^$|(){}[\]])/g, (_m, c) => PH[c] ?? c);
  s = s.replace(/\(\?[!=][^)]*\)/g, '');
  s = s.replace(/\(\?:/g, '(');
  for (let i = 0; i < 2; i += 1) {
    s = s.replace(/\(([^()]*)\)[*?]/g, '');
    s = s.replace(/\(([^()]*)\)\+?/g, (_m, inner) => inner.split('|')[0]);
  }
  s = s.replace(/\[\^[^\]]*\][*?]/g, '');
  s = s.replace(/\[\^[^\]]*\]\+?/g, 'x');
  s = s.replace(/\[[^\]]*\][*?]/g, '');
  s = s.replace(/\[([^\]]*)\]\+?/g, (_m, inner) => inner.replace(/^(.)-.*/, '$1').charAt(0) || 'a');
  s = s.replace(/\\s\+/g, ' ').replace(/\\s\*/g, '').replace(/\\s/g, ' ');
  s = s.replace(/\\W\+/g, ' ').replace(/\\W\*/g, '').replace(/\\W/g, ' ');
  s = s.replace(/\\d\+?/g, '1').replace(/\\w\+?/g, 'x');
  s = s.replace(/\\b|\\B/g, '');
  s = s.replace(/\.[*+]/g, ' x ');
  s = s.replace(/[?*+]/g, '');
  s = s.replace(/[\^$]/g, '');
  if (/[\\[\]{}]/.test(s) || !s.trim()) return null;
  for (const [c, ph] of Object.entries(PH)) s = s.split(ph).join(c);
  try {
    if (!new RegExp(pattern).test(s)) return null;
  } catch {
    return null;
  }
  return s;
}

export function makeRunner(root) {
  const runHook = (hook, payload) => {
    const out = execFileSync('node', [path.join(root, '.claude', 'hooks', hook)], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      cwd: root,
      timeout: 90_000,
    });
    return out.trim() ? JSON.parse(out) : null;
  };
  const decision = (res) => res?.hookSpecificOutput?.permissionDecision ?? res?.decision ?? 'allow';
  const tryDecision = (hook, payload) => {
    try {
      return decision(runHook(hook, payload));
    } catch (e) {
      return `crash (${e.message.split('\n')[0]})`;
    }
  };
  return { runHook, decision, tryDecision };
}

const asFile = (sample) => (sample.endsWith('/') ? `${sample}x` : sample);

// 1. Every hook wired in settings.json exists; every path the config names exists.
function checkWiring({ root, cfg, settings, check }) {
  const commands = Object.values(settings.hooks ?? {}).flatMap((group) => group.flatMap((e) => (e.hooks ?? []).map((h) => h.command)));
  for (const command of commands) {
    const file = command.match(/hooks\/([\w.-]+\.mjs)/)?.[1];
    check('settings.json → hook inexistente', !file || existsSync(path.join(root, '.claude', 'hooks', file)), file);
  }
  for (const [key, rel] of Object.entries(cfg.docs ?? {})) {
    check('config.docs apunta a la nada', existsSync(path.join(root, rel)), `${key} → ${rel}`);
  }
  check('hooksPath del config no existe', existsSync(path.join(root, cfg.hooksPath)), cfg.hooksPath);
}

// 2. One derived sample per rule: a rule that does not bite its own sample is dead.
function checkDerivedSamples({ root, cfg, check, skip, runHook, tryDecision }) {
  const abs = (sample) => (sample.startsWith('/') ? `${root}${sample}` : `${root}/${sample}`);
  const derive = (kind, pattern) => {
    const sample = sampleFromPattern(pattern);
    if (!sample) skip(`${kind}: sin muestra derivable de \`${pattern}\` — probarla a mano`);
    return sample;
  };
  for (const rule of cfg.protectedPaths ?? []) {
    const sample = derive('protectedPaths', rule.pattern);
    if (!sample) continue;
    const got = tryDecision('protected-paths.mjs', { tool_input: { file_path: abs(asFile(sample)) } });
    check(`protected-paths debe bloquear la muestra \`${asFile(sample)}\``, got === 'deny', `obtuvo ${got}`);
  }
  for (const rule of cfg.bashRules ?? []) {
    const sample = derive('bashRules', rule.pattern);
    if (!sample) continue;
    const got = tryDecision('bash-guard.mjs', { tool_input: { command: sample } });
    check(`bash-guard debe bloquear la muestra \`${sample.trim()}\``, got === 'deny', `obtuvo ${got}`);
  }
  for (const rule of cfg.reuseRules ?? []) {
    const texts = (rule.textPatternAll ?? [rule.textPattern]).map(sampleFromPattern);
    if (texts.some((t) => !t)) {
      skip(`reuseRules ${rule.id}: sin muestra derivable — probarla a mano`);
      continue;
    }
    const dir = (rule.pathIncludes?.[0] ?? 'src/').replace(/^\//, '');
    const res = runHook('reuse-guard.mjs', { tool_input: { file_path: `${root}/${dir}selftest-sample.tsx`, content: texts.join('\n') } });
    const got = res?.hookSpecificOutput?.permissionDecision ?? 'allow';
    const warned = Boolean(res?.hookSpecificOutput?.additionalContext);
    const ok = rule.level === 'deny' ? got === 'deny' : got === 'allow' && warned;
    check(`reuse-guard ${rule.id} (${rule.level}) no reacciona a su muestra`, ok, `obtuvo ${got}`);
  }
}

// 3. ...and lets the innocent through (a guard that bites legitimate work gets disabled by hand).
function checkInnocents({ root, cfg, check, tryDecision }) {
  check('protected-paths deja pasar un archivo normal', tryDecision('protected-paths.mjs', { tool_input: { file_path: `${root}/README.md` } }) === 'allow');
  check('bash-guard deja pasar el comando del gate', tryDecision('bash-guard.mjs', { tool_input: { command: cfg.gate.command } }) === 'allow');
  check('bash-guard deja pasar git status', tryDecision('bash-guard.mjs', { tool_input: { command: 'git status' } }) === 'allow');
  check('post-edit-check ignora lo que no es código', tryDecision('post-edit-check.mjs', { cwd: root, tool_input: { file_path: `${root}/README.md` } }) === 'allow');
}

// 4. The git half of protected paths: same list, applied to what enters history.
function checkStaged({ root, cfg, check, read, git }) {
  const staged = (input) => spawnSync('node', [path.join(root, 'scripts', 'protected-staged.mjs')], { cwd: root, input, encoding: 'utf8' });
  check('.githooks/pre-commit no llama a scripts/protected-staged.mjs', read(path.join(cfg.hooksPath, 'pre-commit')).includes('scripts/protected-staged.mjs'));
  for (const rule of cfg.protectedPaths ?? []) {
    const sample = sampleFromPattern(rule.pattern);
    if (!sample) continue;
    const rel = asFile(sample).replace(/^\//, '');
    const want = rule.agentOnly ? 0 : 1;
    const got = staged(`${rel}\n`).status;
    check(`protected-staged con \`${rel}\` esperaba exit ${want}`, got === want, `exit ${got}`);
  }
  check('protected-staged bloquea archivos ya versionados (falso rojo)', staged(git(['ls-files'])).status === 0);
}

// 5. Every gate signal says what it catches (P6) and the harness doc names every signal (P10).
function checkGateSignals({ cfg, check, read }) {
  const gateSh = read('scripts/gate.sh').split('\n');
  const harnessDoc = read(cfg.docs.harness);
  let signals = 0;
  gateSh.forEach((line, i) => {
    const m = line.match(/^\s*run\s+"[^"]+"\s+(.+?)\s*\\?$/);
    if (!m) return;
    signals += 1;
    check(`gate.sh:${i + 1} señal sin "# why:" encima`, /^\s*# why:/.test(gateSh[i - 1] ?? ''), line.trim());
    check(`${cfg.docs.harness} no nombra la señal del gate`, harnessDoc.includes(`\`${m[1]}\``), m[1]);
  });
  check('gate.sh no declara ninguna señal (run "…")', signals > 0);
}

// 6. Every incident leaves a mechanism (P13): the four lines are mandatory.
function checkGotchas({ root, cfg, check, read }) {
  if (!cfg.docs.gotchas || !existsSync(path.join(root, cfg.docs.gotchas))) return;
  const blocks = read(cfg.docs.gotchas).split(/^### /m).filter((b) => b.startsWith('GOTCHA'));
  for (const b of blocks) {
    const title = b.split('\n')[0].slice(0, 70);
    for (const field of ['Síntoma:', 'Causa:', 'Regla:', 'Mecanismo:']) {
      check(`gotcha sin ${field}`, new RegExp(`^${field}`, 'm').test(b), title);
    }
  }
}

// 7. CI runs THE SAME gate and no step tolerates failure.
function checkCi({ root, cfg, check, read }) {
  if (!cfg.ci?.workflow) return;
  check('CI no corre el gate', read(cfg.ci.workflow).includes(`run: ${cfg.gate.command}`), cfg.ci.workflow);
  const wfDir = path.join(root, '.github', 'workflows');
  for (const f of existsSync(wfDir) ? readdirSync(wfDir) : []) {
    check('workflow tolera fallos (continue-on-error: true)', !/continue-on-error:\s*true/.test(read(`.github/workflows/${f}`)), f);
  }
}

// 8. Installed and dead: the pre-commit only runs if git points at it.
function checkHooksPath({ cfg, check, skip, git }) {
  if (process.env.CI) {
    skip('core.hooksPath: CI no instala hooks de git');
    return;
  }
  let hooksPath = '';
  try {
    hooksPath = git(['config', '--get', 'core.hooksPath']);
  } catch {
    /* unset */
  }
  check(`pre-commit instalado y muerto: core.hooksPath ≠ ${cfg.hooksPath}`, hooksPath === cfg.hooksPath, `corre \`${cfg.hooksInstallCommand}\``);
}

// 9. The Stop gate bites with the real link: a real git repo, and a worktree of it.
function checkStopHook({ cfg, check, git, tryDecision }) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'harness-selftest-'));
  try {
    const repo = path.join(tmp, 'repo');
    git(['init', '-q', repo], tmp);
    git(['-c', 'core.hooksPath=/dev/null', '-c', 'user.email=selftest@example.invalid', '-c', 'user.name=selftest', 'commit', '-q', '--allow-empty', '-m', 'x'], repo);
    const markerRel = cfg.gate.marker.replace(/^\.git\//, '');
    writeFileSync(path.join(repo, '.git', markerRel), 'src/x.ts\n');
    check('gate-stop debe bloquear con el marcador puesto', tryDecision('gate-stop.mjs', { cwd: repo }) === 'block');
    check('gate-stop no debe bloquear dos veces el mismo turno', tryDecision('gate-stop.mjs', { cwd: repo, stop_hook_active: true }) === 'allow');
    const wt = path.join(tmp, 'wt');
    git(['worktree', 'add', '-q', '--detach', wt], repo);
    check('gate-stop debe bloquear también en un worktree', tryDecision('gate-stop.mjs', { cwd: wt }) === 'block');
    rmSync(path.join(repo, '.git', markerRel));
    check('gate-stop sin marcador debe permitir', tryDecision('gate-stop.mjs', { cwd: repo }) === 'allow');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// 10. STATUS.md is worth something only if its numbers come from a gate on a nearby commit.
function checkStatus({ root, cfg, check, skip, read, git, maxStatusDrift }) {
  if (!existsSync(path.join(root, cfg.docs.status))) return; // reported by checkWiring
  const cited = read(cfg.docs.status).match(/sobre\s+`([0-9a-f]{7,40})`/)?.[1];
  check('STATUS.md no cita el commit verificado (formato: sobre `<hash>`)', Boolean(cited));
  if (!cited) return;
  const ok = (args) => {
    try {
      return git(args);
    } catch {
      return null;
    }
  };
  const shallow = ok(['rev-parse', '--is-shallow-repository']) !== 'false';
  const known = ok(['cat-file', '-e', `${cited}^{commit}`]) !== null;
  if (!known && shallow) {
    skip(`STATUS.md: commit ${cited} fuera del clon shallow — deriva no medible`);
    return;
  }
  check('STATUS.md cita un commit que no existe en este repo', known, cited);
  if (!known) return;
  const drift = Number(git(['rev-list', '--count', `${cited}..HEAD`]));
  check(`STATUS.md desactualizado: ${drift} commits desde el gate citado (máx ${maxStatusDrift})`, drift <= maxStatusDrift, `corre ${cfg.gate.command} y actualiza ${cfg.docs.status}`);
}

export function runCoreChecks({ root, cfg, settings, check, skip, maxStatusDrift = 25 }) {
  const ctx = {
    root,
    cfg,
    settings,
    check,
    skip,
    maxStatusDrift,
    ...makeRunner(root),
    read: (rel) => readFileSync(path.join(root, rel), 'utf8'),
    git: (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
  };
  for (const run of [checkWiring, checkDerivedSamples, checkInnocents, checkStaged, checkGateSignals, checkGotchas, checkCi, checkHooksPath, checkStopHook, checkStatus]) {
    run(ctx);
  }
}
