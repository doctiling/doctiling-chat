import { describe, expect, it, vi } from 'vitest';
import { ANY_DOCUMENT, appliedSignals, emitLocal, subscribeRealtime, type RealtimeEvent } from '../../src/lib/realtime';
import { stubEventSource } from '../helpers/event-source';

const api = { realtimeUrl: (kbId: string) => `https://studio.test/api/realtime?kb=${kbId}` };

// Spec 072 (doctiling-web T016): one stream per base, shared, closed when idle; 404 = off, quietly.
describe('realtime channel', () => {
  it('opens one EventSource per base for every subscriber and closes it with the last one', () => {
    const es = stubEventSource();
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeRealtime(api, 'kb1', a);
    const offB = subscribeRealtime(api, 'kb1', b);
    expect(es.all).toHaveLength(1);
    expect(es.last().url).toBe('https://studio.test/api/realtime?kb=kb1');
    es.last().signal({ kind: 'kb.documents', kbId: 'kb1' });
    expect(a).toHaveBeenCalledWith({ type: 'signal', signal: { kind: 'kb.documents', kbId: 'kb1' } });
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    expect(es.last().closed).toBe(false);
    offB();
    expect(es.last().closed).toBe(true);
  });

  it('forwards resync frames and turns a reconnect after a drop into resync', () => {
    const es = stubEventSource();
    const events: RealtimeEvent[] = [];
    subscribeRealtime(api, 'kb1', (e) => events.push(e));
    const source = es.last();
    source.open();
    expect(events).toEqual([]);
    source.emit('resync');
    source.drop();
    source.open();
    expect(events).toEqual([{ type: 'resync' }, { type: 'resync' }]);
  });

  it('a refused stream (realtime off) stays closed and silent; local signals still flow', () => {
    const es = stubEventSource();
    const cb = vi.fn();
    subscribeRealtime(api, 'kb1', cb);
    es.last().refuse();
    expect(cb).not.toHaveBeenCalled();
    emitLocal(api, { kind: 'kb.documents', kbId: 'kb1' });
    expect(cb).toHaveBeenCalledWith({ type: 'signal', signal: { kind: 'kb.documents', kbId: 'kb1' } });
    expect(es.all).toHaveLength(1);
  });

  it('is a no-op without EventSource (SSR, old browsers), local signals included', () => {
    vi.stubGlobal('EventSource', undefined);
    const cb = vi.fn();
    const off = subscribeRealtime(api, 'kb1', cb);
    emitLocal(api, { kind: 'doc.changed', kbId: 'kb1', docId: 'd1' });
    expect(cb).toHaveBeenCalledTimes(1);
    off();
  });

  it('ignores a malformed frame', () => {
    const es = stubEventSource();
    const cb = vi.fn();
    subscribeRealtime(api, 'kb1', cb);
    es.last().dispatchEvent(new MessageEvent('signal', { data: '{not json' }));
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('appliedSignals', () => {
  it('a document write → list + that document', () => {
    expect(appliedSignals('kb1', { targetKind: 'document', targetId: 'd1', outcome: 'applied' })).toEqual([
      { kind: 'kb.documents', kbId: 'kb1' },
      { kind: 'doc.changed', kbId: 'kb1', docId: 'd1' },
    ]);
  });
  it('a block write (document unknown) → every open document', () => {
    expect(appliedSignals('kb1', { targetKind: 'block', targetId: 'b1' })[1]).toEqual({ kind: 'doc.changed', kbId: 'kb1', docId: ANY_DOCUMENT });
  });
  it('a failed or rejected action, or a job proposal, changes nothing on screen', () => {
    expect(appliedSignals('kb1', { targetKind: 'document', targetId: 'd1', outcome: 'failed' })).toEqual([]);
    expect(appliedSignals('kb1', { targetKind: 'document', targetId: 'd1', outcome: 'rejected' })).toEqual([]);
    expect(appliedSignals('kb1', { targetKind: 'job', targetId: 'j1' })).toEqual([]);
  });
});
