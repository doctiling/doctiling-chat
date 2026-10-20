import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Markdown } from '../../src/components/Markdown';
import { RenderCodeProvider } from '../../src/lib/render-code';

const doc = 'Intro\n\n```mermaid\nflowchart TD\n  A --> B\n```\n\n```ts\nconst x = 1;\n```\n';

describe('Markdown code blocks and the host renderer', () => {
  it('without a host renderer a diagram fence stays plain code', () => {
    render(<Markdown markdown={doc} />);
    expect(document.querySelector('pre code')?.textContent).toContain('flowchart TD');
    expect(screen.queryByTestId('host-diagram')).not.toBeInTheDocument();
  });

  it('hands a fenced block to the host renderer with its language and source', () => {
    const renderCode = vi.fn((lang: string, source: string) =>
      lang === 'mermaid' ? <div data-testid="host-diagram">{source}</div> : null,
    );
    render(
      <RenderCodeProvider value={renderCode}>
        <Markdown markdown={doc} />
      </RenderCodeProvider>,
    );
    expect(screen.getByTestId('host-diagram').textContent).toContain('flowchart TD');
    expect(renderCode).toHaveBeenCalledWith('mermaid', 'flowchart TD\n  A --> B');
  });

  it('falls back to plain code when the host declines (returns null) and for blocks without a language', () => {
    const renderCode = vi.fn(() => null);
    render(
      <RenderCodeProvider value={renderCode}>
        <Markdown markdown={'```\nplain\n```\n\n```ts\nconst x = 1;\n```'} />
      </RenderCodeProvider>,
    );
    expect(document.querySelectorAll('pre code')).toHaveLength(2);
    expect(renderCode).toHaveBeenCalledTimes(1); // only the block that declares a language
  });
});
