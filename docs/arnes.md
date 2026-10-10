# The agent harness of doctiling-chat

This repo carries [raalzate/agent-harness](https://github.com/raalzate/agent-harness)
(<https://raalzate.github.io/agent-harness/>): generic hooks and scripts, byte-identical with
upstream and with every doctiling repo that carries the harness (doctiling-workspace
`scripts/harness-files.txt`, checked there by `node scripts/harness-drift.mjs`), and one <!-- linkcheck:ignore — doctiling-workspace paths -->
repo-specific file, `.claude/harness.config.json`. Every row names the command that fails.
If this page says something no command enforces, that is the bug.

## The gate

`npm run gate` (`node scripts/gate.mjs`; `scripts/gate.sh` is a one-line wrapper) — the human, the agent
(`Stop` hook, `gate-runner`, `/gate`) and CI (`.github/workflows/gate.yml` on every push, PR and `v*`
tag; `release.yml` on every tag) run the same line. Signals are declared in `gate.signals`, each with
its `why`.

| Signal | Command | What it catches that no other signal sees |
|---|---|---|
| harness self-test | `node scripts/harness-selftest.mjs` | a hook that no longer bites (one sample derived from every rule), a guard that bites innocent work, a config key pointing at nothing |
| docs link-check | `node scripts/docs-linkcheck.mjs` | a doc pointer to a file that does not exist |
| convention lint | `node scripts/repo-lint.mjs` | reuse, purity and invariant rules of the config (`--rules` lists them) |
| artifacts in place | `node scripts/artifacts-check.mjs` | a spec or plan loose here (specs live in doctiling-web) |
| link @doctiling/ui | `npm run link-ui` (`scripts/link-ui.sh`) | no design-system checkout next to this repo (`../web/packages/ui` or `DOCTILING_UI_DIR`): typecheck and tests would resolve nothing |
| white-label guard | `node scripts/white-label-guard.mjs` | a vendor name anywhere under `src/` or `public/` (copy, SW source, offline page, code) |
| lint | `npm run lint` | a native `title=` in JSX, an `<IconButton>` without `label`, an import of `next` or `@/` (host-agnostic), unused code, type-only imports |
| typecheck | `npm run typecheck` | type errors, a broken import, a drift from the API types in `src/lib/api.ts`, a `ChatAppProps` contract break |
| tests | `npm test` | 401 → studio sign-in with return URL, bare 404 → not enabled, NDJSON parsing, stream rendering, confirm → resume, stop, lock/409, i18n parity, the generated service worker never caching the API, manifest shape per locale |
| code index (codegraph) | `codegraph status` | a stale index; **omitted** until `codegraph init` |
| harness cost (hook latency) | `node scripts/hooks-timing.mjs` | a hook that got slow enough to be disabled |

An **omitted** signal is not green, and `npm run gate:fast` is not a deliverable.

## The hooks

| Event | Hook | What it does |
|---|---|---|
| SessionStart | `session-start.mjs` | prints branch, HEAD, uncommitted changes and `STATUS.md` |
| UserPromptSubmit | `ask-first.mjs` | a question is answered, not acted on |
| UserPromptSubmit | `sdd-router.mjs` | puts the right criteria in front of the agent by request size (`sdd.routes`) |
| UserPromptSubmit | `graph-first.mjs` | index first, files after (`graph`) |
| PreToolUse | `action-guard.mjs` | no repo edits while the turn is a question |
| PreToolUse | `protected-paths.mjs` | `.env*`, `package-lock.json`, `.git/`, `public/icons/` (generated), `.ui/` (doctiling-web's design system) |
| PreToolUse | `reuse-guard.mjs` | `localStorage` outside `src/lib/storage.ts`, `fetch(` outside `src/lib/api.ts` / `src/pwa.ts` |
| PreToolUse | `bash-guard.mjs` | `--no-verify`, `push --force`, `reset --hard`, `clean -f`, `git add .`, in-place `sed` over source, `find -delete`, `curl \| sh`; asks on `--force-with-lease`, `branch -D` |
| PostToolUse | `post-edit-check.mjs` | lints the edited file (`repo-lint --file`) and arms the Stop marker |
| Stop | `gate-stop.mjs` | refuses to finish with code edited and no green gate since |
| SubagentStop | `subagent-contract.mjs` | `reviewer` and `gate-runner` close with their `VEREDICTO:` line |

Contract: exit 0 = continue, exit 2 = block. A missing or invalid config **lets through**.

Git hooks (`npm run hooks:install` once per clone): `pre-commit` (protected paths + lint of staged
files), `commit-msg` (code commits reference `#N` or declare `no-issue: <why>`), `pre-push` (`main` only
by PR; branch names via `scripts/cycle-check.mjs`), `post-commit` (no-op without `postCommit`).

Subagents: `explorer`, `reviewer`, `gate-runner`. Commands: `/gate`, `/lesson`, `/harness-audit`,
`/architecture`, `/code-index`. Skill: `new-guardrail`. Map: `node scripts/harness-map.mjs`.
Scheduled sweep (`.github/workflows/drift.yml`): `node scripts/drift-check.mjs`.

## Memory

`CLAUDE.md` (conventions) · `CONSTITUTION.md` (principles with strength and mechanism) · `STATUS.md`
(verified state) · `docs/gotchas.md` (incidents, `/lesson`) · `DEBT.md`.

## What no machine verifies

- The pre-commit is cheap on purpose; the full gate is the `Stop` hook and CI.
- The gate needs a doctiling-web checkout (private) for `@doctiling/ui`; a contributor without access
  cannot run typecheck or tests. Retire with a published `@doctiling/ui`.
- That the generic files equal upstream is checked from doctiling-workspace, not from this repo's CI.
