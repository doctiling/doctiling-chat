import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TurnList } from '../../src/components/TurnList';
import { renderApp } from '../helpers/render';

// Spec 058 of doctiling-web (FR-033, TS-890/891): reading by parts is not noise in the tenant chat.
const read = (target: string) => ({ toolName: 'get_document', labelKey: 'kbAgent.activity.readingDocument', target });
const search = { toolName: 'search_knowledge_base', labelKey: 'kbAgent.activity.searching', target: 'penalty' };
const noop = () => undefined;

describe('TurnList — reading activity grouped by document', () => {
  it('a saved turn shows one line per document read', () => {
    renderApp(
      <TurnList
        turns={[{ id: 'a1', role: 'agent', content: 'done', activity: [read('Manual'), search, read('Manual'), read('Contrato'), read('Manual')] }]}
        live={null}
        hrefFor={(id) => `#${id}`}
        onOpenDoc={noop}
      />,
    );
    const lines = screen.getAllByTestId('activity-line').map((l) => l.textContent);
    expect(lines).toHaveLength(3);
    expect(lines.filter((l) => l?.includes('Manual'))).toHaveLength(1);
  });

  // 2026-11-20: like the studio chat, a finished turn folds its steps; the answer comes first.
  it('a saved turn folds its steps under a closed summary with the count', () => {
    renderApp(
      <TurnList
        turns={[{ id: 'a1', role: 'agent', content: 'done', activity: [read('Manual'), search, read('Contrato')] }]}
        live={null}
        hrefFor={(id) => `#${id}`}
        onOpenDoc={noop}
      />,
    );
    const fold = screen.getByTestId('turn-activity');
    expect(fold.tagName).toBe('DETAILS');
    expect(fold).not.toHaveAttribute('open');
    expect(fold.querySelector('summary')?.textContent).toContain('3');
  });

  it('live, the steps stay in view (not folded)', () => {
    renderApp(<TurnList turns={[]} live={{ text: '', thinking: false, activity: [search] }} hrefFor={(id) => `#${id}`} onOpenDoc={noop} />);
    expect(screen.queryByTestId('turn-activity')).toBeNull();
    expect(screen.getAllByTestId('activity-line')).toHaveLength(1);
  });

  it('live, the typing dots follow the line of the read in progress', () => {
    renderApp(
      <TurnList
        turns={[]}
        live={{ text: '', thinking: false, activity: [read('Manual'), search, read('Manual')] }}
        hrefFor={(id) => `#${id}`}
        onOpenDoc={noop}
      />,
    );
    const lines = screen.getAllByTestId('activity-line');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveAttribute('aria-live', 'polite');
    expect(lines[1]).not.toHaveAttribute('aria-live');
  });
});
