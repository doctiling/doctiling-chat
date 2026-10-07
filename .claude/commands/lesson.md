---
description: Record an incident that just cost time, using the strongest mechanism available
---

An incident just cost time: $ARGUMENTS

1. **Mine it.** Observable symptom, root cause (confirmed, not guessed), the rule that prevents it. If it was already in `docs/harness/gotchas.md`, the finding is different: the rule existed and did not stop anything, so it needs a **stronger** mechanism, not another entry.
2. **Pick the strongest mechanism**, in this order: test (`tests/`) > hook or config rule (`.claude/hooks/`, `.claude/harness.config.json`, `.githooks/pre-commit`, `.github/workflows/gate.yml`) > command or script (`scripts/`, `.claude/commands/`) > markdown. Justify in one line why nothing stronger fits.
3. **Write the entry** in `docs/harness/gotchas.md`: `### GOTCHA: <symptom>` then `Síntoma:` / `Causa:` / `Regla:` / `Mecanismo:` (the self-test fails without the four).
4. **Validate.** `npm run gate`. Green → it stays. Red → revert and record the attempt.
