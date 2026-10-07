# Gotchas — what already cost us hours

Fixed format: **observable symptom → root cause → rule → the mechanism that now fails**. Written when
the cost is paid (`/lesson <incident>`). The `Mecanismo:` line is mandatory and the harness self-test
enforces the four lines; with no executable mechanism, write "ninguno ejecutable: <why>".

---

### GOTCHA: a self-test that demands a commit hash in a repo with no commits

Síntoma: the first `npm run gate` of this repo was red at the harness self-test: "STATUS.md cita un commit
         que no existe", with nothing to cite (2026-10-07, scaffold before the first commit).
Causa:   `scripts/harness-core-checks.mjs` (generic, byte-identical across repos) resolves the hash in
         `STATUS.md` with `git cat-file`; an empty repository has no HEAD.
Regla:   the generic file is never patched locally (harness drift); repo-specific tolerance lives in
         `scripts/harness-selftest.mjs`, only while `git rev-parse HEAD` fails, and is reported as omitted.
Mecanismo: `node scripts/harness-selftest.mjs` — once HEAD exists the omission disappears and a wrong hash in
         `STATUS.md` fails the gate again.
