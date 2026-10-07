// Citations as the agent writes them: `doc:ID "Title"`, `[doc:ID]`, `[[doc:ID]]`
// (port of doctiling-web src/lib/kb-agent/citations.ts). The markdown is
// rewritten into ordinary links to the in-app source route before rendering;
// fenced code is left alone.

const CITATION = /\[\[doc:([A-Za-z0-9_-]+)\]\]|\[doc:([A-Za-z0-9_-]+)\]|doc:([A-Za-z0-9_-]+)(?:\s+"([^"\n]+)")?/g;
const FENCE = /```[\s\S]*?```/g;

export function linkifyDocCitations(markdown: string, hrefFor: (id: string) => string): string {
  const fences: string[] = [];
  const withoutFences = markdown.replace(FENCE, (fence) => {
    fences.push(fence);
    return `\u0000${fences.length - 1}\u0000`;
  });
  const linked = withoutFences.replace(CITATION, (_m, a?: string, b?: string, c?: string, title?: string) => {
    const id = a ?? b ?? c ?? '';
    return `[${title ?? id}](${hrefFor(id)})`;
  });
  return linked.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => fences[Number(i)] ?? '');
}

export function citedDocumentIds(markdown: string): string[] {
  const ids = new Set<string>();
  for (const m of markdown.replace(FENCE, '').matchAll(CITATION)) ids.add(m[1] ?? m[2] ?? m[3] ?? '');
  ids.delete('');
  return [...ids];
}
