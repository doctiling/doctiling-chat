// The agent may close a Dialogue-mode answer with a <followups> block (spec 009
// FR-007). The studio shows it as tappable chips, never as raw text; so does the chat.
const BLOCK = /<followups>([\s\S]*?)<\/followups>/i;

export type SplitFollowups = { text: string; followups: string[] };

export function splitFollowups(markdown: string): SplitFollowups {
  const m = BLOCK.exec(markdown);
  if (!m) return { text: markdown, followups: [] };
  const followups = (m[1] ?? "")
    .split(/\n|(?=→)/)
    .map((line) => line.replace(/^[\s→•\-*]+/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const text = (markdown.slice(0, m.index) + markdown.slice(m.index + m[0].length)).trim();
  return { text, followups };
}
