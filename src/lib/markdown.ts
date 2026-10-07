// A deliberately small markdown → block model for agent replies and source
// documents: headings, paragraphs, lists, fenced code, blockquotes, tables and
// inline bold / italic / code / links. No HTML passthrough (everything is text),
// so nothing the agent writes can inject markup.

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: Inline[] };

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'code'; value: string; lang?: string }
  | { type: 'quote'; children: Inline[] }
  | { type: 'table'; header: Inline[][]; rows: Inline[][][] };

const INLINE_TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|_[^_]+_|\*[^*]+\*)/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  for (const part of text.split(INLINE_TOKEN)) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      out.push({ type: 'strong', children: parseInline(part.slice(2, -2)) });
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      out.push({ type: 'code', value: part.slice(1, -1) });
    } else if (part.startsWith('[')) {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
      if (m) out.push({ type: 'link', href: m[2] ?? '', children: parseInline(m[1] ?? '') });
      else out.push({ type: 'text', value: part });
    } else if ((part.startsWith('_') && part.endsWith('_')) || (part.startsWith('*') && part.endsWith('*'))) {
      if (part.length > 2) out.push({ type: 'em', children: parseInline(part.slice(1, -1)) });
      else out.push({ type: 'text', value: part });
    } else {
      out.push({ type: 'text', value: part });
    }
  }
  return out;
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

const isSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ type: 'paragraph', children: parseInline(para.join(' ').trim()) });
      para = [];
    }
  };
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (/^```/.test(line)) {
      flush();
      const lang = line.slice(3).trim() || undefined;
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i] ?? '')) {
        buf.push(lines[i] ?? '');
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', value: buf.join('\n'), lang });
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ type: 'heading', level: (h[1]?.length ?? 1) as 1 | 2 | 3, children: parseInline(h[2] ?? '') });
      i += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      flush();
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) {
        buf.push((lines[i] ?? '').replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', children: parseInline(buf.join(' ')) });
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && isSeparator(lines[i + 1] ?? '')) {
      flush();
      const header = splitRow(line).map(parseInline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && (lines[i] ?? '').includes('|')) {
        rows.push(splitRow(lines[i] ?? '').map(parseInline));
        i += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    const li = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const ordered = /\d/.test(li[1] ?? '');
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i] ?? '');
        if (!m) break;
        items.push(parseInline(m[2] ?? ''));
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    if (!line.trim()) {
      flush();
      i += 1;
      continue;
    }
    para.push(line);
    i += 1;
  }
  flush();
  return blocks;
}
