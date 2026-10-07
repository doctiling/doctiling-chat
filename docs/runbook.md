# Runbook — doctiling-chat

## What runs where

Nothing of its own. The chat is a package (`@doctiling/chat`, pinned by tag) compiled into the tenant's
**web** service (studio edition) and served at `https://<studio host>/{locale}/chat`. It is switched on per
tenant with the variable `DOCTILING_CHAT_ENABLED=true` on the web service
(`doctiling tenant chat enable <name> --yes`; `disable` removes it; both redeploy). Never in self-host or
the local profile. No chat domain, no image, no registry.

## Health

- `GET https://<studio host>/{locale}/chat` → `200` (session) or a redirect to `signin` means the route is
  mounted; `404` means the flag is off (or the web release predates the chat).
- `GET https://<studio host>/api/chat/me` → `401` without a session means the API is on; `404` (empty body)
  means `DOCTILING_CHAT_ENABLED` is not set.
- `GET https://<studio host>/{locale}/chat/sw.js` → `Cache-Control: no-store`, body starts with
  `/* Doctiling Chat service worker <version>`.
- `doctiling tenant check <name>` shows `chat: enabled/disabled` and checks the route.

## Symptoms

| Symptom | Likely cause | Check |
|---|---|---|
| "The chat is not enabled here" | web has no `DOCTILING_CHAT_ENABLED`, or self-host/local profile | `curl -i https://<studio>/api/chat/me` → 404 empty |
| Opening the chat bounces to sign-in in a loop | the studio session cookie is not sent (different host than the studio's, third-party cookie block) | open the chat from the studio host itself |
| Styles missing (unstyled list, no bubbles) | web's Tailwind `content` lacks the chat glob, or `@doctiling/chat/styles.css` is not imported | `tailwind.config.ts`, `(chat)/layout.tsx` |
| "Update" toast never appears | `/{locale}/chat/sw.js` cached by a proxy, or `version` not bumped | `curl -I …/sw.js` → must be `no-store`; body version |
| Installed app opens the studio instead of the chat | manifest `scope`/`start_url` wrong | `curl …/chat/manifest.webmanifest` → `scope` = `/{locale}/chat/` |
| Offline opens a blank page instead of the notice | `offline.html` route missing or not precached | `curl …/{locale}/chat/offline.html` → 200 |

## Release

1. Bump `version` in `package.json` (same commit as the change). `npm run gate` green.
2. Tag `vX.Y.Z`, push the tag. `release.yml` runs the gate and checks the tag against `version`.
3. In web: `npx -y npm@10.8.2 install @doctiling/chat@https://codeload.github.com/doctiling/doctiling-chat/tar.gz/refs/tags/vX.Y.Z`,
   release web, `doctiling-ops deploy --tenant <name> --ref <web tag>`.

## Rollback

Pin the previous tag in web and redeploy web; the installed app offers "Update" on next open and reloads
(the studio session is untouched). Switching the chat off without a release: `doctiling tenant chat disable <name>`.
