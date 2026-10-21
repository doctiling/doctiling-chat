import type { Activity } from './api';

type Line = { activity: Activity; last: number };

/** Every read of one document in a turn is one line, at its first read (doctiling-web spec 058, FR-033);
 *  `last` is the index of the newest step the line stands for, where the live indicator belongs. */
export function groupDocumentReads(activity: readonly Activity[]): Line[] {
  const out: Line[] = [];
  const byDocument = new Map<string, Line>();
  activity.forEach((a, i) => {
    const key = a.toolName === 'get_document' && a.target ? a.target : null;
    const line = key === null ? undefined : byDocument.get(key);
    if (line) {
      line.last = i;
      return;
    }
    const fresh = { activity: a, last: i };
    if (key !== null) byDocument.set(key, fresh);
    out.push(fresh);
  });
  return out;
}
