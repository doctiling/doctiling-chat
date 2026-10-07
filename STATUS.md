# STATUS — verified state (doctiling-chat)

Printed by the `SessionStart` hook. **Only what a command verified goes here**; what is assumed goes
under "Known debt". The harness self-test fails if the commit cited below is more than 25 commits
behind HEAD.

- **Last full gate:** 2026-10-07, branch `package-in-studio` (working tree, not yet committed), sobre `a726dfe`
- **Verdict:** GREEN (`npm run gate`: harness self-test · docs link-check · link @doctiling/ui · white-label
  guard · lint · typecheck · tests — 82 tests, 17 files)
- **Verified against web's API surface** (read, not run): `src/lib/chat/route.ts` answers a bare `404` when
  `chatEnabled()` is false and `chatError(404, 'not_found', …)` for a missing document; the client tells the
  two apart by the JSON body (`tests/lib/api.test.ts`).

## Not yet verified

- Consumption from doctiling-web (`transpilePackages`, Tailwind glob, `(chat)` layout, PWA routes): the
  web side of the amendment is not written yet.
- Install on a real iOS Safari / Android Chrome under `/{locale}/chat/` scope, full-screen launch, offline
  notice < 3 s (SC-008): needs a studio release with the chat mounted.
- `v0.2.0` tag (owner pushes the tag).

## Known debt

- See `DEBT.md`.
