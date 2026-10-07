# DEBT — doctiling-chat

Declared debt, each with the condition that retires it.

- **`@doctiling/ui` is a host requirement, not a declared peer.** The design system lives in doctiling-web
  `packages/ui` (private, unpublished); declaring it in `peerDependencies` made npm drop web's workspace link
  on every install (same lesson as `@doctiling/landing`). This repo resolves it through the `.ui` symlink.
  Retire when `@doctiling/ui` ships as its own package pinned by tag: declare the peer, delete `link-ui.sh`.
- **`Sheet` composes the Radix Dialog primitive directly.** `@doctiling/ui/molecules/sheet` bakes an English
  close button and a hidden "Navigation Menu" title into `SheetContent`; the chat uses the design system's
  `Sheet`, `SheetOverlay`, `SheetTitle`, `SheetDescription`, `SheetClose` and its own translated, labelled
  close. Retire when the design system exposes a content part without baked-in copy.
- **Local `Toast`.** `@doctiling/ui/molecules/toast` ships the Radix primitives without the `useToast` hook
  (web keeps its own). The chat keeps a small context-based toaster. Retire when the hook moves into the
  design system.
- **No attachments.** The chat sends `query` or `resume` only; the API answers 400 `attachments_not_supported`
  (FR, plan P8). Out of scope of 045.
- **No push notifications.** The studio's web push is not wired into the chat (plan P8). A pending
  confirmation is only visible when the app is open.
- **Automatic reconnection.** A dropped stream shows a notice and the person retries (FR-023). No resume.
- **Markdown renderer is minimal** (`src/lib/markdown.ts`): headings, lists, code, quotes, tables, inline
  marks and links. No images, no nested lists, no HTML. Enough for agent replies and reading view; revisit if
  documents render poorly.
- **Service worker precache is static.** Next's hashed chunks are cached on first use (cache-first), not at
  install; the first offline open after an update may miss a chunk until it was visited online once.
- **Lighthouse / real-device measurements** (SC-001, SC-004, SC-008) pending the first studio release with the
  chat mounted (`studio.doctiling.app/es/chat`).
