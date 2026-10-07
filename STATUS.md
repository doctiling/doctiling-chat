# STATUS — verified state (doctiling-chat)

Printed by the `SessionStart` hook. **Only what a command verified goes here**; what is assumed goes
under "Known debt". The harness self-test fails if the commit cited below is more than 25 commits
behind HEAD.

- **Last full gate:** 2026-10-07, branch `main`, working tree before the first commit (sobre `a477ca0` —
  replace with the hash of the first commit; until then the self-test reports that one check as omitted)
- **Verdict:** GREEN (`npm run gate`: harness self-test · docs link-check · white-label guard · lint ·
  typecheck · tests · build)
- **Verified against web local** (`DOCTILING_CHAT_HOST=localhost:5173`, API at `http://localhost:3100`):
  `GET /api/chat/me` without token → `401 {error:'invalid', messageKey}`; `POST /api/chat/token` with a bad
  code → `400 {error:'invalid_code'}`. Conversation endpoints were still being implemented in web when this
  was written; the stream is exercised by `tests/screens/Conversation.*.test.tsx` with synthetic NDJSON.

## Not yet verified

- Install on a real iOS Safari / Android Chrome, full-screen launch, offline notice < 3 s (SC-008): needs the
  image served over HTTPS (`chat.doctiling.app`, phase 10).
- `v0.1.0` tag and `ghcr.io/doctiling/chat:0.1.0` (owner pushes the tag).
- Lighthouse "installable" on the build served by `server/serve.mjs`.

## Known debt

- See `DEBT.md`.
