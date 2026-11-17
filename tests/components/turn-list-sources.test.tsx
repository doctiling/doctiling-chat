import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TurnList, splitSources } from '../../src/components/TurnList';
import { renderApp } from '../helpers/render';

// doctiling-web spec 082 US5: the tenant chat shows citations and sources as the studio does.
const noop = () => undefined;
const search = (sources: Array<{ id: string; title: string }>) => ({ toolName: 'search_knowledge_base', labelKey: 'kbAgent.activity.searching', target: 'prima', sources });
const CARATULA = { id: 'kb1-c5', title: '05_Caratula_Poliza_VI-2026-004512' };
const others = [1, 2, 3, 4].map((n) => ({ id: `kb1-o${n}`, title: `Otro ${n}` }));

describe('TurnList — sources (spec 082 US5)', () => {
  it('cites with the real title, without technical residue, and keeps $ amounts as written (FR-013, FR-015)', () => {
    renderApp(
      <TurnList
        turns={[{ id: 'a1', role: 'agent', content: 'La prima total anual es $2.532.400 (mensual $211.033) [1] doc:kb1-c5#block-3 "Amparos contratados" › block-3.', activity: [search([CARATULA, ...others])] }]}
        live={null}
        hrefFor={(id) => `#${id}`}
        onOpenDoc={noop}
      />,
    );
    const bubble = screen.getByTestId('turn');
    expect(bubble).toHaveTextContent('$2.532.400 (mensual $211.033)');
    expect(bubble).toHaveTextContent('05_Caratula_Poliza_VI-2026-004512');
    expect(bubble).not.toHaveTextContent('Amparos contratados');
    expect(bubble).not.toHaveTextContent('[1]');
    expect(bubble).not.toHaveTextContent('› block-3');
    expect(bubble).not.toHaveTextContent('kb1-c5');
  });

  it('lists the cited document and folds the other four under «Consultados» (FR-014)', () => {
    renderApp(
      <TurnList
        turns={[{ id: 'a1', role: 'agent', content: 'Prima $2.532.400 doc:kb1-c5 "Carátula".', activity: [search([CARATULA, ...others])] }]}
        live={null}
        hrefFor={(id) => `#${id}`}
        onOpenDoc={noop}
      />,
    );
    const row = screen.getByTestId('turn-sources');
    const consulted = screen.getByTestId('turn-consulted');
    expect(consulted.tagName).toBe('DETAILS');
    expect(within(consulted).getAllByRole('button').map((b) => b.textContent)).toEqual(['Otro 1', 'Otro 2', 'Otro 3', 'Otro 4']);
    const cited = within(row).getAllByRole('button').filter((b) => !b.closest('details'));
    expect(cited.map((b) => b.textContent)).toEqual([CARATULA.title]);
  });

  it('without citations every document read is a source', () => {
    const first = others[0]!;
    expect(splitSources('Sin citas.', [CARATULA, first])).toEqual({ cited: [CARATULA, first], consulted: [] });
  });
});
