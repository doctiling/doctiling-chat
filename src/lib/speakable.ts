import { parseMarkdown, type Inline } from './markdown';

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
  for (const block of parseMarkdown(markdown)) {
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
