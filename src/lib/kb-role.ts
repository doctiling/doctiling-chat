import * as React from 'react';
import type { ChatApi } from './api';
import type { KbRole } from './new-document';

/** The person's role on `kbId` as the bases list reports it; null while loading or when unknown. */
export function useKbRole(api: ChatApi, kbId: string): KbRole | null {
  const [role, setRole] = React.useState<KbRole | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    api
      .knowledgeBases()
      .then(({ items }) => {
        if (!cancelled) setRole(items.find((k) => k.id === kbId)?.role ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, kbId]);
  return role;
}
