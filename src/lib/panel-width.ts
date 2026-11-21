import * as React from 'react';

// The desktop document panel: its width is the person's to choose (drag the edge, arrow keys,
// or the expand toggle) and is remembered on this device only. Storage may be blocked: the
// panel then simply opens at the default width.

export const PANEL_WIDTH_KEY = 'doctiling-chat:source-width';
export const PANEL_DEFAULT = 420;
export const PANEL_MIN = 320;
/** The conversation keeps at least this much room next to the panel. */
export const CONVERSATION_MIN = 360;
/** Expanded = this share of the window (still leaving the conversation its minimum). */
export const EXPANDED_SHARE = 0.65;
export const KEY_STEP = 32;

export function clampWidth(width: number, viewport: number): number {
  const max = Math.max(PANEL_MIN, viewport - CONVERSATION_MIN);
  return Math.round(Math.min(Math.max(width, PANEL_MIN), max));
}

export function expandedWidth(viewport: number): number {
  return clampWidth(viewport * EXPANDED_SHARE, viewport);
}

function readStored(): number | null {
  try {
    const raw = window.localStorage.getItem(PANEL_WIDTH_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function store(width: number) {
  try {
    window.localStorage.setItem(PANEL_WIDTH_KEY, String(width));
  } catch {
    /* blocked storage: the width just does not survive a reload */
  }
}

const windowWidth = () => (typeof window === 'undefined' ? 1280 : window.innerWidth);

/**
 * Width of the document panel, with setters for dragging, keys and the expand toggle.
 * `panelRef` is the panel itself: limits are measured against the row it sits in (the
 * conversation + the panel), not the window, so a list column beside them is not counted.
 */
export function usePanelWidth(panelRef?: React.RefObject<HTMLElement | null>) {
  const viewportWidth = React.useCallback(() => {
    const row = panelRef?.current?.parentElement?.clientWidth;
    return row && row > 0 ? row : windowWidth();
  }, [panelRef]);
  const [width, setWidthState] = React.useState(() => clampWidth(readStored() ?? PANEL_DEFAULT, windowWidth()));

  /** Call when the panel mounts: from then on its row is watched, so the conversation keeps its room. */
  const watch = React.useCallback(() => {
    const reclamp = () => setWidthState((w) => clampWidth(w, viewportWidth()));
    reclamp();
    const row = panelRef?.current?.parentElement;
    if (row && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(reclamp);
      observer.observe(row);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, [panelRef, viewportWidth]);

  const setWidth = React.useCallback((next: number, persist = true) => {
    const clamped = clampWidth(next, viewportWidth());
    setWidthState(clamped);
    if (persist) store(clamped);
  }, [viewportWidth]);

  const expanded = width >= expandedWidth(viewportWidth()) - 1;
  const toggleExpanded = React.useCallback(() => {
    setWidth(expanded ? PANEL_DEFAULT : expandedWidth(viewportWidth()));
  }, [expanded, setWidth, viewportWidth]);

  return { width, setWidth, expanded, toggleExpanded, watch };
}
