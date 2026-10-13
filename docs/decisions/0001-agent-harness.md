# ADR 0001 — Agent harness from raalzate/agent-harness, byte-identical across the doctiling repos

**Date**: 2026-10-12 · **Status**: accepted

## Context

Each doctiling repo carried its own copy of the agent harness (hooks, gate, self-test), hand-edited
per repo. The copies drifted: a fix in one repo never reached the others, the workspace's drift check
was red, and the shell-based gate did not run on every OS.

## Decision

The harness is the generic one of github.com/raalzate/agent-harness, pinned by commit in the workspace
repo's file list and copied byte for byte into every doctiling repo. The ONLY repo-specific file is
`.claude/harness.config.json` (gate signals with their `why`, protected paths, bash rules, reuse rules,
purity, docs scope, tracker + commit policy). Repo-specific pre-commit steps go through `preCommit.extra`.
A generic file changes upstream first, then in every repo in the same change.

## Consequences

- `node scripts/harness-selftest.mjs` proves every brake bites; the workspace drift check (harness-drift)
  fails on any byte of drift.
- Signals are argv (no shell): `scripts/gate.sh` is only a wrapper over `scripts/gate.mjs`.
- Commits touching code reference a GitHub item (`#N`) or carry `no-issue: <motivo>` (same policy as the workspace).
