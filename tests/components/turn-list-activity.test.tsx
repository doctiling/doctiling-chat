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
