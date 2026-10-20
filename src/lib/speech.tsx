'use client';

import * as React from 'react';
import { splitSentences } from './speakable';

type SpeechApi = {
  /** The browser can speak (no server voice: this is the device's own). */
  supported: boolean;
  /** Which message is being read, or null. */
  speakingId: string | null;
  paused: boolean;
  /** Start reading `text` for `id`; the same id again pauses, then resumes. Another id replaces the current one. */
  toggle: (id: string, text: string) => void;
  stop: () => void;
};

const SpeechContext = React.createContext<SpeechApi | null>(null);

const OFF: SpeechApi = { supported: false, speakingId: null, paused: false, toggle: () => {}, stop: () => {} };

function synthesis(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

export function SpeechProvider({ language, children }: { language: string; children: React.ReactNode }) {
  const [speakingId, setSpeakingId] = React.useState<string | null>(null);
  const [paused, setPaused] = React.useState(false);
  // Every run gets a generation: a cancelled run's late `end` event must not resume it.
  const runRef = React.useRef(0);
  const supported = synthesis() !== null;

  const stop = React.useCallback(() => {
    runRef.current += 1;
    synthesis()?.cancel();
    setSpeakingId(null);
    setPaused(false);
  }, []);

  const start = React.useCallback(
    (id: string, text: string) => {
      const synth = synthesis();
      const sentences = splitSentences(text);
      if (!synth || sentences.length === 0) return;
      synth.cancel();
      const run = ++runRef.current;
      setSpeakingId(id);
      setPaused(false);
      const speakAt = (i: number) => {
        if (run !== runRef.current) return;
        if (i >= sentences.length) {
          setSpeakingId(null);
          return;
        }
        const u = new SpeechSynthesisUtterance(sentences[i]);
        u.lang = language;
        u.onend = () => speakAt(i + 1);
        u.onerror = () => {
          if (run === runRef.current) setSpeakingId(null);
        };
        synth.speak(u);
      };
      speakAt(0);
    },
    [language],
  );

  const toggle = React.useCallback(
    (id: string, text: string) => {
      const synth = synthesis();
      if (!synth) return;
      if (speakingId === id) {
        if (paused) {
          synth.resume();
          setPaused(false);
        } else {
          synth.pause();
          setPaused(true);
        }
        return;
      }
      start(id, text);
    },
    [speakingId, paused, start],
  );

  // Leaving the screen silences the voice.
  React.useEffect(() => () => synthesis()?.cancel(), []);

  const value = React.useMemo<SpeechApi>(
    () => ({ supported, speakingId, paused, toggle, stop }),
    [supported, speakingId, paused, toggle, stop],
  );
  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
}

export function useSpeech(): SpeechApi {
  return React.useContext(SpeechContext) ?? OFF;
}
