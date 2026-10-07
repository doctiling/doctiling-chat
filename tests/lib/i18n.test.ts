import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import es from '../../src/i18n/es.json';
import { flattenKeys, interpolate, translate } from '../../src/i18n';

// T056 — EN/ES parity (BLOCKING, CONSTITUTION P2), no connect/token keys left, no literal copy in screens. [TS-446]
describe('i18n (T056, TS-446)', () => {
  it('en and es expose exactly the same key set', () => {
    const enKeys = flattenKeys(en);
    const esKeys = flattenKeys(es);
    const onlyEn = enKeys.filter((k) => !esKeys.includes(k));
    const onlyEs = esKeys.filter((k) => !enKeys.includes(k));
    expect({ onlyEn, onlyEs }).toEqual({ onlyEn: [], onlyEs: [] });
    expect(enKeys.length).toBeGreaterThan(100);
  });

  it('carries the not-enabled copy and nothing of the old connect / token flow', () => {
    const keys = flattenKeys(en);
    expect(keys).toEqual(expect.arrayContaining(['notEnabled.title', 'notEnabled.body', 'notEnabled.cta']));
    expect(keys.filter((k) => /^connect\.|token|sessionUntil|signingOut/.test(k))).toEqual([]);
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
    expect(translate('es', 'settings.signOut')).toBe('Cerrar sesión');
    expect(translate('en', 'kb.documents', { count: 3 })).toBe('3 documents');
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist');
    expect(interpolate('a {x} {y}', { x: 1 })).toBe('a 1 {y}');
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
