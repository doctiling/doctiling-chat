# The agent harness of doctiling-chat

Same definitions as <https://raalzate.github.io/agent-harness/>, scaled to a small React package.
**A rule without a command that makes it fail is a suggestion**: every row names that command.

## The gate

`npm run gate` (`scripts/gate.sh`) — the human, the agent (`Stop` hook, `gate-runner`, `/gate`) and CI
(`.github/workflows/gate.yml`, also on tags; `release.yml` on every `v*` tag) run the same line.

| Signal | Command | What it catches that no other signal sees |
|---|---|---|
| harness self-test | `node scripts/harness-selftest.mjs` | a hook that no longer bites (one sample derived from every rule), a guard that bites innocent work, the Stop hook dead in a worktree, a gate signal without `# why:`, a gotcha without its mechanism, CI not running the gate, `core.hooksPath` unset, a stale STATUS.md |
| docs link-check | `node scripts/docs-linkcheck.mjs` | a `docs/...` pointer to a file that is not tracked |
| link @doctiling/ui | `sh scripts/link-ui.sh` | no design-system checkout next to this repo (`../web/packages/ui` or `DOCTILING_UI_DIR`): typecheck and tests would resolve nothing |
| white-label guard | `node scripts/white-label-guard.mjs` | a vendor name anywhere under `src/` or `public/` (copy, SW source, offline page, code) |
| lint | `npm run lint` | a native `title=` in JSX, an `<IconButton>` without `label`, an import of `next` or `@/` (host-agnostic), unused code, type-only imports |
| typecheck | `npm run typecheck` | type errors, a broken import, a drift from the API types in `src/lib/api.ts`, a `ChatAppProps` contract break |
| tests | `npm test` | 401 → studio sign-in with return URL, bare 404 → not enabled, NDJSON parsing, stream rendering, confirm → resume, stop, lock/409, i18n parity, the generated service worker never caching the API, manifest shape per locale |

## Hooks

Generic files, byte-identical with doctiling-web / -cli / -mobile / -brand / -landing (doctiling-workspace
`scripts/harness-drift.sh` fails on drift); everything repo-specific is in `.claude/harness.config.json`.

| Event | Hook | What it does |
|---|---|---|
| SessionStart | `session-start.mjs` | prints branch, HEAD and `STATUS.md`; warns if the pre-commit is not installed |
| PreToolUse Write\|Edit | `protected-paths.mjs` | `.env*`, `package-lock.json`, `.git/`, `public/icons/` (generated) |
| PreToolUse Bash | `bash-guard.mjs` | `--no-verify`, `push --force`, `reset --hard`, `git add .` |
| PostToolUse Write\|Edit | `post-edit-check.mjs` | `tsc --noEmit` after editing `src/`, `tests/`, `scripts/`, `public/`; arms the Stop marker |
| Stop | `gate-stop.mjs` | refuses to finish with code edited and no green gate since |

`.githooks/pre-commit` applies the protected-paths list to what is staged. Install once per clone:
`npm run hooks:install`. Subagents: `gate-runner`, `reviewer`. Commands: `/gate`, `/lesson`, `/harness-audit`.

## Memory

`CLAUDE.md` (conventions) · `CONSTITUTION.md` (principles with strength and mechanism) · `STATUS.md`
(verified state, cites the gated commit) · `docs/harness/gotchas.md` (incidents, `/lesson`) · `DEBT.md`.

## Known debt

- The pre-commit is cheap on purpose (protected paths only); the full gate is the `Stop` hook and CI.
- The gate needs a doctiling-web checkout (private) for `@doctiling/ui`; a contributor without access cannot
  run typecheck or tests. Retire with a published `@doctiling/ui`.
