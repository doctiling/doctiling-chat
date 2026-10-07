import en from './en.json';
import es from './es.json';
import type { Language } from '@/lib/storage';

export const dictionaries: Record<Language, Record<string, unknown>> = { en, es };

export const LANGUAGES: Language[] = ['en', 'es'];

function lookup(dict: Record<string, unknown>, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

/** Translate `key` in `language`; falls back to English, then to the key itself. */
export function translate(language: Language, key: string, values?: Record<string, string | number>): string {
  const hit = lookup(dictionaries[language], key) ?? lookup(dictionaries.en, key);
  return interpolate(hit ?? key, values);
}

/** True when the key exists in the dictionary (used to decide on generic fallbacks). */
export function hasKey(language: Language, key: string): boolean {
  return lookup(dictionaries[language], key) !== undefined;
}

export function detectLanguage(navigatorLanguage: string | undefined): Language {
  return (navigatorLanguage ?? '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

/** Flatten a dictionary to its dotted key set (parity test + tooling). */
export function flattenKeys(dict: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(dict)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') out.push(...flattenKeys(v as Record<string, unknown>, key));
    else out.push(key);
  }
  return out.sort();
}
