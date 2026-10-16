// Citations as the agent writes them: `doc:ID "Title"`, `[doc:ID]`, `[[doc:ID]]`
// (port of doctiling-web src/lib/kb-agent/citations.ts). The markdown is
// rewritten into ordinary links to the in-app source route before rendering;
// fenced code is left alone.

const CITATION = /\[\[doc:([A-Za-z0-9_-]+)\]\]|\[doc:([A-Za-z0-9_-]+)\]|doc:([A-Za-z0-9_-]+)(?:\s+"([^"\n]+)")?/g;
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
};

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
  const label = (id: string, title?: string) => title ?? labels.titleFor?.(id) ?? labels.fallbackLabel ?? id;
  const linked = withoutFences
    .replace(TITLED_CITATION, (_m, title: string, id: string) => `[${title}](${hrefFor(id)})`)
    .replace(CITATION, (m, a?: string, b?: string, c?: string, title?: string) => {
      const id = a ?? b ?? c ?? '';
      if (!ID_LIKE.test(id)) return m.replace(STRAY, '').replace(/^\[\[(.*)\]\]$|^\[(.*)\]$/, '$1$2');
      return `[${label(id, title)}](${hrefFor(id)})`;
    });
  return linked.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => fences[Number(i)] ?? '');
}

export function citedDocumentIds(markdown: string): string[] {
  const ids = new Set<string>();
  for (const m of markdown.replace(FENCE, '').matchAll(CITATION)) {
    const id = m[1] ?? m[2] ?? m[3] ?? '';
    if (ID_LIKE.test(id)) ids.add(id);
  }
  return [...ids];
}
