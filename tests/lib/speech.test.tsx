import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechProvider, useSpeech } from '../../src/lib/speech';

type FakeUtterance = { text: string; lang: string; onend: (() => void) | null; onerror: (() => void) | null };

function installSpeech() {
  const spoken: FakeUtterance[] = [];
  const synth = {
    speaking: false,
    paused: false,
    speak: vi.fn((u: FakeUtterance) => {
      synth.speaking = true;
      spoken.push(u);
    }),
    cancel: vi.fn(() => {
      synth.speaking = false;
    }),
    pause: vi.fn(() => {
      synth.paused = true;
    }),
    resume: vi.fn(() => {
      synth.paused = false;
    }),
    getVoices: () => [],
  };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string;
      lang = '';
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  return { synth, spoken };
}

const wrapper = ({ children }: { children: React.ReactNode }) => <SpeechProvider language="es">{children}</SpeechProvider>;

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'speechSynthesis');
});

describe('useSpeech', () => {
  it('reports unsupported when the browser has no speech synthesis, and does nothing', () => {
    Reflect.deleteProperty(window, 'speechSynthesis');
    const { result } = renderHook(() => useSpeech(), { wrapper });
    expect(result.current.supported).toBe(false);
    act(() => result.current.toggle('a', 'Hola.'));
    expect(result.current.speakingId).toBeNull();
  });

  it('speaks sentence by sentence in the UI language and clears when done', () => {
    const { spoken } = installSpeech();
    const { result } = renderHook(() => useSpeech(), { wrapper });
    expect(result.current.supported).toBe(true);
    act(() => result.current.toggle('a', 'Uno. Dos.'));
    expect(result.current.speakingId).toBe('a');
    expect(spoken[0]).toMatchObject({ text: 'Uno.', lang: 'es' });
    act(() => spoken[0]!.onend?.());
    expect(spoken[1]!.text).toBe('Dos.');
    act(() => spoken[1]!.onend?.());
    expect(result.current.speakingId).toBeNull();
  });

  it('pauses and resumes the same message when toggled again', () => {
    const { synth } = installSpeech();
    const { result } = renderHook(() => useSpeech(), { wrapper });
    act(() => result.current.toggle('a', 'Uno. Dos.'));
    act(() => result.current.toggle('a', 'Uno. Dos.'));
    expect(synth.pause).toHaveBeenCalled();
    expect(result.current.paused).toBe(true);
    act(() => result.current.toggle('a', 'Uno. Dos.'));
    expect(synth.resume).toHaveBeenCalled();
    expect(result.current.paused).toBe(false);
  });

  it('switching to another message cancels the first and ignores its stale end event', () => {
    const { synth, spoken } = installSpeech();
    const { result } = renderHook(() => useSpeech(), { wrapper });
    act(() => result.current.toggle('a', 'Uno. Dos.'));
    const stale = spoken[0]!;
    act(() => result.current.toggle('b', 'Tres.'));
    expect(synth.cancel).toHaveBeenCalled();
    expect(result.current.speakingId).toBe('b');
    const before = spoken.length;
    act(() => stale.onend?.());
    expect(spoken.length).toBe(before); // the old run did not continue
  });

  it('stop cancels everything', () => {
    const { synth } = installSpeech();
    const { result } = renderHook(() => useSpeech(), { wrapper });
    act(() => result.current.toggle('a', 'Uno.'));
    act(() => result.current.stop());
    expect(synth.cancel).toHaveBeenCalled();
    expect(result.current.speakingId).toBeNull();
  });

  it('ignores empty text', () => {
    const { synth } = installSpeech();
    const { result } = renderHook(() => useSpeech(), { wrapper });
    act(() => result.current.toggle('a', '   '));
    expect(synth.speak).not.toHaveBeenCalled();
    expect(result.current.speakingId).toBeNull();
  });
});
