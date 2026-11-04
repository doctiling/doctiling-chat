// The device voice to read with (port of doctiling-web src/hooks/use-speech.ts `pickVoice`).
// The system default is often a compact or novelty voice, which is why reading sounded robotic.
const GOOD_VOICE = /google|natural|neural|premium|enhanced|siri|microsoft|wavenet/i;
const POOR_VOICE = /compact|eloquence|espeak|pico/i;
const NOVELTY_VOICE =
  /^(albert|bad news|bahh|bells|boing|bubbles|cellos|eddy|flo|fred|good news|grandma|grandpa|jester|junior|kathy|organ|ralph|reed|rocko|sandy|shelley|superstar|trinoids|whisper|wobble|zarvox)\b/i;

export function pickVoice(voices: readonly SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const target = lang.toLowerCase();
  const base = target.split('-')[0] ?? target;
  const inLang = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  const pool = inLang.length ? inLang : voices;
  const score = (v: SpeechSynthesisVoice): number => {
    let s = 0;
    if (NOVELTY_VOICE.test(v.name)) s -= 10;
    if (v.lang.toLowerCase() === target) s += 4;
    if (target.endsWith('-419') && !v.lang.toLowerCase().endsWith('-es')) s += 2;
    if (GOOD_VOICE.test(v.name)) s += 3;
    if (POOR_VOICE.test(v.name)) s -= 3;
    if (!v.localService) s += 1;
    if (v.default) s += 0.5;
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** The UI language with the reader's region when the browser has one for it ("es" + es-CO → "es-CO"). */
export function speechLang(lang: string, browserLanguages: readonly string[]): string {
  if (lang.includes('-')) return lang;
  const base = lang.toLowerCase();
  return browserLanguages.find((l) => l.toLowerCase().split('-')[0] === base) ?? lang;
}
