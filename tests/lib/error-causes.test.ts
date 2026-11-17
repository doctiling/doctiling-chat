// Spec 085 (doctiling-web) — TS-029, TS-030, TS-033: the chat names the cause the server sent,
// infers it from the status when there is no JSON body, and checks size and type before uploading.
import { describe, it, expect } from 'vitest';
import { ApiError, codeFromStatus } from '../../src/lib/api';
import { MAX_UPLOAD_MB, errorCode, errorKey, precheckFile } from '../../src/lib/new-document';
import es from '../../src/i18n/es.json';
import en from '../../src/i18n/en.json';

describe('codeFromStatus (no JSON body: a proxy or platform page)', () => {
  it.each([
    [402, 'credit_exceeded'],
    [413, 'file_too_large'],
    [415, 'unsupported_type'],
    [429, 'rate_limited'],
    [502, 'unavailable'],
    [503, 'unavailable'],
    [504, 'unavailable'],
    [500, 'unknown'],
  ])('%i → %s', (status, code) => {
    expect(codeFromStatus(status)).toBe(code);
  });

  it('every inferred code has its own send message (TS-029)', () => {
    for (const status of [402, 429, 502]) {
      const key = codeFromStatus(status) as keyof typeof es.conversation.errors;
      expect(es.conversation.errors[key], key).toBeTruthy();
      expect(en.conversation.errors[key], key).toBeTruthy();
    }
  });
});

describe('ApiError', () => {
  it('keeps the server messageKey (TS-030)', () => {
    expect(new ApiError(409, 'runInProgress', 'kbAgent.errors.runInProgress').messageKey).toBe('kbAgent.errors.runInProgress');
  });
});

describe('precheckFile (TS-033)', () => {
  const big = { name: 'acta.pdf', size: (MAX_UPLOAD_MB + 5) * 1024 * 1024 } as File;
  it('a file over the limit is refused before uploading, with the MB in the message', () => {
    expect(precheckFile(big)).toBe('file_too_large');
    expect(es.newDocument.errors.file_too_large).toContain('{mb}');
  });

  it('an unsupported type is refused; a PDF passes', () => {
    expect(precheckFile({ name: 'setup.exe', size: 10 } as File)).toBe('unsupported_type');
    expect(precheckFile({ name: 'acta.PDF', size: 10 } as File)).toBeNull();
  });

  it('a stream cut mid-read is a network cause, not unknown', () => {
    expect(errorCode(new TypeError('network error'))).toBe('network');
  });

  it('the new file causes have copy in both languages', () => {
    for (const code of ['file_encrypted', 'file_corrupt', 'unavailable', 'file_too_large']) {
      expect(errorKey(code)).toBe(`newDocument.errors.${code}`);
      expect((en.newDocument.errors as Record<string, string>)[code], code).toBeTruthy();
    }
  });
});
