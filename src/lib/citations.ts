// Citations as the agent writes them: `doc:ID "Title"`, `[doc:ID]`, `[[doc:ID]]`
// (port of doctiling-web src/lib/kb-agent/citations.ts). The markdown is
// rewritten into ordinary links to the in-app source route before rendering;
// fenced code is left alone.

// doctiling-web notebook/84 §6: `doc:ID#Entity "Title"` cites one entity of a graph; the
// entity runs until the title, a closing bracket or the end of the line.
const CITATION = /\[\[doc:([A-Za-z0-9_-]+)\]\]|\[doc:([A-Za-z0-9_-]+)\]|doc:([A-Za-z0-9_-]+)(?:#([^"\]\n)#]{1,80}?)(?=\s*"|\]|\)|[.,;:]?\s*$))?(?:\s+"([^"\n]+)")?/gm;
// `"Title" (doc:ID)` — the model names the document and cites it in parentheses:
// one link with the title, never the id next to it (doctiling-web #137).
const TITLED_CITATION = /"([^"\n]+)"\s*\(\s*\[{0,2}doc:([A-Za-z0-9_-]+)\]{0,2}(?:\s+"[^"\n]+")?\s*\)/g;
const FENCE = /```[\s\S]*?```/g;
// A model that writes the title where the id goes (`doc:Grafo de conceptos …`): a
// real id carries a digit or a dash (`<kb>-<uid>`); a bare word is not one and
// must not become a link to a 404.
const ID_LIKE = /[0-9-]/;
const STRAY = /doc:(?=[^\s"()[\]]+)/g;

export type CitationLabels = {
  /** Title known to the UI for a document id. */
  titleFor?: (id: string) => string | undefined;
  /** What a citation without a title reads as; the id never renders as text. */
  fallbackLabel?: string;
  /** How `doc:ID#block-N` names the block (web spec 059, nb/86): "bloque 3". */
  blockLabel?: (n: number) => string;
};

const BLOCK_ENTITY = /^block-(\d+)$/;

export function linkifyDocCitations(
  markdown: string,
  hrefFor: (id: string) => string,
  labels: CitationLabels = {},
): string {
  const fences: string[] = [];
  const withoutFences = markdown.replace(FENCE, (fence) => {
    fences.push(fence);
    return `\u0000${fences.length - 1}\u0000`;
  });
  // doctiling-web spec 082 US5 (agent spec RQA-02/08): the document's real title wins over the
  // one the model wrote — never an invented title, the file name or a section heading.
  const label = (id: string, title?: string) => labels.titleFor?.(id) ?? title ?? labels.fallbackLabel ?? id;
  const linked = withoutFences
    .replace(TITLED_CITATION, (_m, title: string, id: string) => `[${label(id, title)}](${hrefFor(id)})`)
    .replace(CITATION, (m, a?: string, b?: string, c?: string, entity?: string, title?: string) => {
      const id = a ?? b ?? c ?? '';
      if (!ID_LIKE.test(id)) return m.replace(STRAY, '').replace(/^\[\[(.*)\]\]$|^\[(.*)\]$/, '$1$2');
      const part = entity?.trim();
      const block = part ? BLOCK_ENTITY.exec(part) : null;
      const shown = block ? (labels.blockLabel?.(Number(block[1])) ?? `#${block[1]}`) : part;
      const text = shown ? `${label(id, title)} › ${shown}` : label(id, title);
      return `[${text}](${hrefFor(id)})`;
    });
  return tidyCitationResidue(linked).replace(/\u0000(\d+)\u0000/g, (_m, i: string) => fences[Number(i)] ?? '');
}

const MD_LINK = /\[[^\]\n]*\]\([^)\s]*\)/g;
// What a model leaves around a citation once it is a link (agent spec D-03): a footnote number
// before it ("[1] [Título](…)") and raw locators ("› block-5", "#block-6", "fila-1 · 2]").
// Only the text between links is touched; a reply without links is left as written.
function tidyCitationResidue(markdown: string): string {
  const links = [...markdown.matchAll(MD_LINK)];
  if (links.length === 0) return markdown;
  const clean = (text: string, afterLink: boolean, beforeLink: boolean) => {
    let out = text.replace(/\s*(?:›\s*)?#(?:block|fila|row)-\d+\b/gi, '').replace(/\s*›\s*(?:block|fila|row)-\d+\b/gi, '');
    if (afterLink) out = out.replace(/^\s*(?:block|fila|row)-\d+(?:\s*·\s*\d+)?\]?/i, '');
    if (beforeLink) out = out.replace(/\[\d{1,3}\]\s*$/, '');
    return out;
  };
  const parts: string[] = [];
  let last = 0;
  links.forEach((m, i) => {
    parts.push(clean(markdown.slice(last, m.index), i > 0, true), m[0]);
    last = (m.index ?? 0) + m[0].length;
  });
  parts.push(clean(markdown.slice(last), true, false));
  return parts.join('');
}

export function citedDocumentIds(markdown: string): string[] {
  const ids = new Set<string>();
  const text = markdown.replace(FENCE, '');
  for (const m of text.matchAll(CITATION)) {
    const id = m[1] ?? m[2] ?? m[3] ?? '';
    if (ID_LIKE.test(id)) ids.add(id);
  }
  for (const m of text.matchAll(TITLED_CITATION)) {
    const id = m[2] ?? '';
    if (ID_LIKE.test(id)) ids.add(id);
  }
  return [...ids];
}
