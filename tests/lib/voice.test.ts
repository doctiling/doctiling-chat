import { describe, expect, it } from 'vitest';
import { pickVoice } from '../../src/lib/voice';

// Owner QA 2026-11-04: the chat read aloud with the system default voice — often a robotic,
// compact one. Same choice as doctiling-web src/hooks/use-speech.ts.
const v = (name: string, lang: string, extra: Partial<SpeechSynthesisVoice> = {}) =>
  ({ name, lang, localService: true, default: false, voiceURI: name, ...extra }) as SpeechSynthesisVoice;

describe('pickVoice', () => {
  it('prefers a natural voice in the language over the robotic default', () => {
    const voices = [v('Shelley', 'es-ES', { default: true }), v('Eddy', 'es-MX'), v('Google español', 'es-ES', { localService: false }), v('Samantha', 'en-US')];
    expect(pickVoice(voices, 'es')?.name).toBe('Google español');
  });

  it('prefers the exact region when quality ties', () => {
    const voices = [v('Paulina (Enhanced)', 'es-MX'), v('Mónica (Enhanced)', 'es-ES')];
    expect(pickVoice(voices, 'es-MX')?.name).toBe('Paulina (Enhanced)');
  });

  it('avoids compact and novelty voices', () => {
    const voices = [v('Zarvox', 'es-ES'), v('Jorge (compact)', 'es-ES'), v('Jorge', 'es-ES')];
    expect(pickVoice(voices, 'es')?.name).toBe('Jorge');
  });

  it('is null without voices', () => {
    expect(pickVoice([], 'es')).toBeNull();
  });
});
