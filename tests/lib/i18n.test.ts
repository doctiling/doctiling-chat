import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '@/i18n/en.json';
import es from '@/i18n/es.json';
import { detectLanguage, flattenKeys, interpolate, translate } from '@/i18n';

// T056 — EN/ES parity (BLOCKING, CONSTITUTION P2), detection, no literal copy in screens. [TS-446]
describe('i18n (T056, TS-446)', () => {
  it('en and es expose exactly the same key set', () => {
    const enKeys = flattenKeys(en);
    const esKeys = flattenKeys(es);
    const onlyEn = enKeys.filter((k) => !esKeys.includes(k));
    const onlyEs = esKeys.filter((k) => !enKeys.includes(k));
    expect({ onlyEn, onlyEs }).toEqual({ onlyEn: [], onlyEs: [] });
    expect(enKeys.length).toBeGreaterThan(100);
  });

  it('every value is a non-empty string and placeholders match across locales', () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of flattenKeys(en)) {
      const a = translate('en', key);
      const b = translate('es', key);
      expect(a, key).not.toBe('');
      expect(b, key).not.toBe('');
      expect(placeholders(b), key).toEqual(placeholders(a));
    }
  });

  it('translates with interpolation and falls back to the key', () => {
    expect(translate('es', 'connect.button')).toBe('Conectar');
    expect(translate('en', 'kb.documents', { count: 3 })).toBe('3 documents');
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist');
    expect(interpolate('a {x} {y}', { x: 1 })).toBe('a 1 {y}');
  });

  it('detects Spanish from navigator.language and defaults to English', () => {
    expect(detectLanguage('es-CO')).toBe('es');
    expect(detectLanguage('ES')).toBe('es');
    expect(detectLanguage('en-US')).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
  });

  it('screens and components render copy through t(), never a literal sentence', () => {
    const root = path.resolve(__dirname, '../../src');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d)) {
        const p = path.join(d, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx$/.test(e)) files.push(p);
      }
    };
    walk(path.join(root, 'screens'));
    walk(path.join(root, 'components'));
    // JSX text node with two or more words and a space: `>Some words<`.
    const literal = />\s*[A-Za-zÁÉÍÓÚáéíóúñ][^<>{}]*\s[^<>{}]*[a-záéíóúñ]\s*</;
    const offenders = files.flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => literal.test(line) && !/^\s*(\/\/|\*|{\/\*)/.test(line))
        .map(({ line, i }) => `${path.relative(root, f)}:${i + 1}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
