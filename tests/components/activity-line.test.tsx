import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityLine } from '../../src/components/ActivityLine';
import { renderApp } from '../helpers/render';

// A retry reminder from the agent loop (web 0.28.4, `retry_nudge`) reads in product
// language, like every other step, instead of the generic "Working…" fallback.
describe('ActivityLine — retry reminder', () => {
  it('labels a retry_nudge step by its own text with the failed tool as target', () => {
    renderApp(
      <ActivityLine
        activity={{ toolName: 'retry_nudge', labelKey: 'kbAgent.activity.retryNudge', target: 'create_document' }}
      />,
    );
    const line = screen.getByTestId('activity-line');
    expect(line).toHaveTextContent('Retry requested · create_document');
    expect(line).not.toHaveTextContent('Working…');
  });
});
