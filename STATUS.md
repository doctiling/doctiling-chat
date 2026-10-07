# STATUS — verified state (doctiling-chat)

Printed by the `SessionStart` hook. **Only what a command verified goes here**; what is assumed goes
under "Known debt". The harness self-test fails if the commit cited below is more than 25 commits
behind HEAD.

- **Last full gate:** 2026-10-07, branch `docs-mentions-readonly` (working tree, not yet committed), sobre `dfd0660`
- **Verdict:** GREEN (`npm run gate`: harness self-test · docs link-check · link @doctiling/ui · white-label
  guard · lint · typecheck · tests — 109 tests, 21 files)
- **Documents, `@` mentions and read-only verified in jsdom** (`tests/screens/Documents.test.tsx` TS-461,
  `tests/components/mentions.test.tsx` TS-462, `tests/screens/Conversation.readonly.test.tsx` TS-463, both
  viewports via `setViewport`): the list shows exactly what `GET …/documents` returns (private badge,
  not-indexed hint, filter, tap → reading view), one fetch per base shared with the picker; `@` opens the
  picker, filters, ↑↓/Enter/Esc, chips, `referencedDocumentIds` in the POST body, cap at 10 with notice; the
  read-only badge follows `session.access.canWrite` and disappears when it is true or absent.
- **Coded against the web API described by the orchestrator, not run against it**: `GET …/documents`,
  `session.access`, `referencedDocumentIds` on `POST …/agent`. The real response shapes must be checked when
  web ships them (`specs/045-tenant-chat-pwa/contracts/chat-api.md`).
- **Responsive shell verified in jsdom** (`tests/screens/Desktop.test.tsx`, `matchMedia` mocked by
  `setViewport`): at ≥ 768 px `/kb/:id` renders list + conversation, `/` list + empty state, `/settings`
  list + settings, the source is `role="complementary"` and Enter sends; below it the stacked navigation,
  the source dialog and "Enter = newline" hold (TS-397). The visual result at a real 768–1280 px
  viewport is **not** verified (no browser run).
- **Verified against web's API surface** (read, not run): `src/lib/chat/route.ts` answers a bare `404` when
  `chatEnabled()` is false and `chatError(404, 'not_found', …)` for a missing document; the client tells the
  two apart by the JSON body (`tests/lib/api.test.ts`).

## Not yet verified

- Consumption from doctiling-web (`transpilePackages`, Tailwind glob, `(chat)` layout, PWA routes): the
  web side of the amendment is not written yet. The host's Tailwind `content` glob must keep covering
  `src/**/*.tsx` so the new `md:` classes are compiled.
- Install on a real iOS Safari / Android Chrome under `/{locale}/chat/` scope, full-screen launch, offline
  notice < 3 s (SC-008): needs a studio release with the chat mounted.
- `v0.4.0` tag (owner pushes the tag).

## Known debt

- See `DEBT.md`.
