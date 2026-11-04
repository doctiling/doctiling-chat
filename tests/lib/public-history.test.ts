// Spec 074 (doctiling-web) US-3 — the visitor's history lives in the browser (TS-020, TS-021, TS-022).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicHistory, visitorId, PUBLIC_HISTORY_MAX_TURNS } from '../../src/lib/public-history';
import type { Turn } from '../../src/lib/api';

const turn = (id: string, role: Turn['role'], content: string): Turn => ({ id, role, content });

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('public history (browser only)', () => {
  it('[TS-020] keeps a conversation across visits in the same browser', async () => {
    const a = createPublicHistory();
    await a.save('slugA', [turn('1', 'user', 'hola'), turn('2', 'agent', 'hola!')]);
    const reopened = createPublicHistory();
    expect((await reopened.load('slugA')).map((t) => t.content)).toEqual(['hola', 'hola!']);
  });

  it('[TS-021] each public chat keeps its own history, and clearing one leaves the other', async () => {
    const h = createPublicHistory();
    await h.save('slugA', [turn('1', 'user', 'a')]);
    await h.save('slugB', [turn('1', 'user', 'b')]);
    await h.clear('slugA');
    expect(await h.load('slugA')).toEqual([]);
    expect((await h.load('slugB'))[0]!.content).toBe('b');
  });

  it('[TS-022] without browser storage the chat still works for the visit and forgets it', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const h = createPublicHistory();
    await h.save('slugA', [turn('1', 'user', 'a')]);
    expect((await h.load('slugA'))[0]!.content).toBe('a');
    expect(await createPublicHistory().load('slugA')).toEqual([]);
  });

  it('keeps only the most recent turns and drops the client-only references', async () => {
    const h = createPublicHistory();
    const many = Array.from({ length: PUBLIC_HISTORY_MAX_TURNS + 10 }, (_, i) => ({ ...turn(String(i), 'user', `m${i}`), references: [{ id: 'd', title: 'D' }] }));
    await h.save('slugA', many);
    const loaded = await h.load('slugA');
    expect(loaded).toHaveLength(PUBLIC_HISTORY_MAX_TURNS);
    expect(loaded.at(-1)?.content).toBe(`m${PUBLIC_HISTORY_MAX_TURNS + 9}`);
    expect(loaded[0]).not.toHaveProperty('references');
  });

  it('a stored value that is not a turn list reads as empty', async () => {
    window.localStorage.setItem('doctiling-public-chat:slugA', '{"nope":1}');
    expect(await createPublicHistory().load('slugA')).toEqual([]);
  });

  it('gives the browser a stable anonymous visitor id', () => {
    const a = visitorId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(visitorId()).toBe(a);
  });
});
