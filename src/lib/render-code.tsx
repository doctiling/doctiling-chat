import * as React from 'react';

/**
 * How the host draws a fenced block that has a language (a Mermaid diagram, say). The chat
 * stays free of product code: it only offers the seam. Return null to keep the block as plain code.
 */
export type RenderCode = (lang: string, source: string) => React.ReactNode | null;

const RenderCodeContext = React.createContext<RenderCode | undefined>(undefined);

export const RenderCodeProvider = RenderCodeContext.Provider;

export function useRenderCode(): RenderCode | undefined {
  return React.useContext(RenderCodeContext);
}
