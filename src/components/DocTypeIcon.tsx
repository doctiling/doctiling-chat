import { FileText, Table2, Waypoints } from 'lucide-react';
import type { DocumentListItem } from '../lib/api';

// One icon per document type, decorative (the type is spoken by the row text
// or the list context). Shared by the Documents list and the mention picker.
export function DocTypeIcon({ type, className = 'h-4 w-4' }: { type: DocumentListItem['type']; className?: string }) {
  const Icon = type === 'database' ? Table2 : type === 'graph' ? Waypoints : FileText;
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}
