// Spec 072 (doctiling-web): change signals for an open base. One EventSource per
// base, shared by every subscriber and closed when the last one leaves. Signals
// carry ids, never content: a subscriber refetches what it shows. The server
// answers 404 when real time is switched off — EventSource then closes for good
// and the app behaves as before (lists load once, the sheet loads on open).
// `emitLocal` lets the conversation announce its own agent writes (`Applied`)
// through the same channel, so the list and the sheet react even without a stream.
import * as React from 'react';
import type { ChatApi } from './api';

export type Signal =
  | { kind: 'doc.changed'; kbId: string; docId: string; blockIds?: string[] }
  | { kind: 'doc.index' | 'doc.ocr'; kbId: string; docId: string }
  | { kind: 'kb.documents'; kbId: string }
  | { kind: 'kb.relations'; kbId: string; docId?: string }
  | { kind: 'job.run'; kbId: string; jobId: string; runId: string; status: string }
  | { kind: 'wiki.comments'; kbId: string; docId: string }
  | { kind: 'kb.access'; kbId: string; email: string }
  | { kind: 'notification'; email: string; unread: number };

/** A signal scoped to one base (everything but the person's own `notification`). */
export type KbSignal = Extract<Signal, { kbId: string }>;

/** `resync` = the stream (re)connected after a gap: refetch everything on screen. */
export type RealtimeEvent = { type: 'signal'; signal: Signal } | { type: 'resync' };
export type RealtimeListener = (event: RealtimeEvent) => void;

/** A local write whose document is not known (a block, a collection): every open document refetches. */
export const ANY_DOCUMENT = '*';

type Channel = { url: string; listeners: Set<RealtimeListener>; source: EventSource | null; broken: boolean };

const channels = new Map<string, Channel>();

function dispatch(channel: Channel, event: RealtimeEvent) {
  for (const l of [...channel.listeners]) {
    try {
      l(event);
    } catch {
      /* one subscriber failing must not starve the others */
    }
  }
}

function open(channel: Channel) {
  if (typeof EventSource === 'undefined') return;
  const source = new EventSource(channel.url);
  channel.source = source;
  source.addEventListener('signal', (e) => {
    try {
      dispatch(channel, { type: 'signal', signal: JSON.parse((e as MessageEvent<string>).data) as Signal });
    } catch {
      /* malformed frame: ignore */
    }
  });
  source.addEventListener('resync', () => dispatch(channel, { type: 'resync' }));
  source.addEventListener('closed', () => {
    source.close();
    channel.source = null;
  });
  source.addEventListener('open', () => {
    // Back after a drop (sleep, network change, deploy): what changed meanwhile is unknown.
    if (channel.broken) dispatch(channel, { type: 'resync' });
    channel.broken = false;
  });
  source.addEventListener('error', () => {
    channel.broken = true;
    // CLOSED = the server refused (404 off, 401, 403): stay quiet, never retry.
    if (source.readyState === EventSource.CLOSED) channel.source = null;
  });
}

function channelFor(url: string): Channel {
  let channel = channels.get(url);
  if (!channel) {
    channel = { url, listeners: new Set(), source: null, broken: false };
    channels.set(url, channel);
  }
  return channel;
}

/** Listen to the signals of `kbId`; the returned function unsubscribes (and closes the stream when idle). */
export function subscribeRealtime(api: Pick<ChatApi, 'realtimeUrl'>, kbId: string, listener: RealtimeListener): () => void {
  const url = api.realtimeUrl(kbId);
  // No URL = no live updates for this host (a public chat visitor): nothing to open.
  if (!url) return () => {};
  const channel = channelFor(url);
  channel.listeners.add(listener);
  if (channel.listeners.size === 1 && !channel.source) open(channel);
  return () => {
    channel.listeners.delete(listener);
    if (channel.listeners.size > 0) return;
    channel.source?.close();
    channels.delete(channel.url);
  };
}

/** Deliver a signal to the subscribers of its base as if the server had sent it (the conversation's own writes). */
export function emitLocal(api: Pick<ChatApi, 'realtimeUrl'>, signal: KbSignal) {
  const channel = channels.get(api.realtimeUrl(signal.kbId));
  if (channel) dispatch(channel, { type: 'signal', signal });
}

/** React binding: `listener` always sees the latest closure; the subscription follows `kbId`. */
export function useRealtime(api: Pick<ChatApi, 'realtimeUrl'>, kbId: string | null, listener: RealtimeListener) {
  const latest = React.useRef(listener);
  latest.current = listener;
  React.useEffect(() => {
    if (!kbId) return;
    return subscribeRealtime(api, kbId, (e) => latest.current(e));
  }, [api, kbId]);
}

/** Test seam: forget every channel (the module outlives a test's render). */
export function resetRealtime() {
  for (const c of channels.values()) c.source?.close();
  channels.clear();
}

/**
 * What an `Applied` agent event means for the open views: the list may have a new or changed
 * entry, and the touched document (or, for a block or collection, any open one) must refetch.
 * A failed or rejected action changed nothing.
 */
export function appliedSignals(kbId: string, action: unknown): KbSignal[] {
  const a = (action ?? {}) as { targetKind?: string; targetId?: string; outcome?: string };
  if (a.outcome === 'failed' || a.outcome === 'rejected') return [];
  if (a.targetKind === 'job') return [];
  const docId = a.targetKind === 'document' && typeof a.targetId === 'string' ? a.targetId : ANY_DOCUMENT;
  return [
    { kind: 'kb.documents', kbId },
    { kind: 'doc.changed', kbId, docId },
  ];
}
