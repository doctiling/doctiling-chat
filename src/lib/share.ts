// Share a link to a base's conversation: the system share sheet where the
// browser has one (phones, installed app), the clipboard otherwise. The link
// grants nothing — whoever opens it goes through the studio session and the
// server's permission check like any other visit.

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareLink({ title, url }: { title: string; url: string }): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (e) {
      // The person closed the sheet: nothing to report.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // NotAllowedError and friends: fall through to the clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
