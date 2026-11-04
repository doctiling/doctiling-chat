import { parseMarkdown, type Inline } from './markdown';

// Citations are for the eye: aloud, an id or a block number is noise (owner QA 2026-11-04).
const TITLED_CITATION = /"([^"\n]+)"\s*\(\s*\[{0,2}doc:[A-Za-z0-9_-]+(?:#[^)\n]*)?\]{0,2}\s*\)/g;
const CITATION = /\s*(?:\[\[doc:[^\]\n]+\]\]|\[doc:[^\]\n]+\]|doc:[A-Za-z0-9_-]+(?:#[^\s"\])]+)?(?:\s+"[^"\n]+")?)/g;
const BLOCK_MARK = /\s*(?:›\s*#\d+|\[#\d+(?:\s*[,y]\s*#?\d+)*\]|\(#\d+(?:\s*[,y]\s*#?\d+)*\))/g;

function withoutCitations(markdown: string): string {
  return markdown.replace(TITLED_CITATION, '$1').replace(CITATION, '').replace(BLOCK_MARK, '');
}

function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) => (n.type === 'text' || n.type === 'code' ? n.value : inlineText(n.children)))
    .join('');
}

/**
 * What a person should hear for a Markdown message: headings, paragraphs, lists and quotes as plain
 * text. Code, diagrams and tables are skipped — spelled out aloud they are noise.
 */
export function speakableText(markdown: string): string {
  const parts: string[] = [];
  for (const block of parseMarkdown(withoutCitations(markdown))) {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
        parts.push(inlineText(block.children));
        break;
      case 'list':
        parts.push(block.items.map(inlineText).join('\n'));
        break;
      default:
        break; // code, table
    }
  }
  return parts.filter((p) => p.trim()).join('\n\n');
}

/** Sentences to speak one at a time, so pause and stop answer quickly. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
