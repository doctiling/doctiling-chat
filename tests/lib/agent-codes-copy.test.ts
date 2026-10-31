import { describe, expect, it } from 'vitest';
import { summaryKeyFor } from '../../src/components/ConfirmCard';
import { hasKey, translate } from '../../src/i18n';
import type { Pending } from '../../src/lib/api';

// Codes the studio's agent emits (doctiling-web #261, #262, #277) must read as their own sentence, not the generic one.
describe('copy for agent codes from the studio', () => {
  const pending = {
    id: 'p1',
    toolName: 'append_blocks',
    summaryKey: 'kbAgent.confirm.summary.append_blocks',
    summaryValues: { name: 'Guide' },
  } as Pending;

  it.each(['en', 'es'] as const)('append_blocks confirmation has its own summary (%s)', (language) => {
    expect(summaryKeyFor(pending, language)).toBe('conversation.confirm.summary.append_blocks');
    expect(translate(language, 'conversation.confirm.summary.append_blocks', { name: 'Guide' })).toContain('Guide');
  });

  it.each(['en', 'es'] as const)('provider_unavailable error has its own message (%s)', (language) => {
    expect(hasKey(language, 'conversation.errors.provider_unavailable')).toBe(true);
    expect(translate(language, 'conversation.errors.provider_unavailable')).not.toBe(
      translate(language, 'conversation.errors.unknown'),
    );
  });

  it.each(['en', 'es'] as const)('empty_answer error has its own message (%s)', (language) => {
    expect(hasKey(language, 'conversation.errors.empty_answer')).toBe(true);
    expect(translate(language, 'conversation.errors.empty_answer')).not.toBe(
      translate(language, 'conversation.errors.unknown'),
    );
  });
});
