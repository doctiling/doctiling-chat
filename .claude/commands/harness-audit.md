---
description: Audit the agent harness for "installed and dead" rules — every rule must have a command that fails when violated
---

Audit against `docs/harness/harness.md` and `CONSTITUTION.md`. For every rule, answer: **which concrete command fails if someone violates it?** If the answer is "none", the rule is dead. Verify, do not assume:

- `git config core.hooksPath` is `.githooks` and `.githooks/pre-commit` is executable.
- `node scripts/harness-selftest.mjs` is green and its omissions are expected.
- `scripts/gate.sh` signals match `docs/harness/harness.md`, and `.github/workflows/gate.yml` runs `npm run gate`.
- Every BLOCKING principle in `CONSTITUTION.md` names a command that exists.
- `STATUS.md` cites the commit of a real green gate.

Report: rule → enforcing command → LIVE / DEAD, then the single highest-return next step. Do not fix anything unless asked.
