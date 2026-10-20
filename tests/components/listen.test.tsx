import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TurnList } from '../../src/components/TurnList';
import { SpeechProvider } from '../../src/lib/speech';
import { PREFS_KEY } from '../../src/lib/storage';
import type { Turn } from '../../src/lib/api';
import { renderApp } from '../helpers/render';

type U = { text: string; lang: string; onend: (() => void) | null; onerror: (() => void) | null };

function installSpeech() {
  const spoken: U[] = [];
  const synth = {
    speak: vi.fn((u: U) => spoken.push(u)),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [],
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      lang = '';
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    },
  );
  return { synth, spoken };
}

const user: Turn = { id: 'u1', role: 'user', content: 'Hello?' };
const agent: Turn = { id: 'a1', role: 'agent', content: 'First answer. Second sentence.\n\n```mermaid\nflowchart TD\n  A --> B\n```' };

const list = (turns: Turn[]) => (
  <SpeechProvider language="en">
    <TurnList turns={turns} live={null} hrefFor={(id) => `/d/${id}`} onOpenDoc={() => {}} />
  </SpeechProvider>
);

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'speechSynthesis');
});

describe('listening to a reply', () => {
  it('offers a listen button on agent replies only, and reads the prose without the diagram', () => {
    const { spoken } = installSpeech();
    renderApp(list([user, agent]));
    expect(screen.getAllByRole('button', { name: 'Listen' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
    expect(spoken[0]!.text).toBe('First answer.');
    act(() => spoken[0]!.onend?.());
    expect(spoken[1]!.text).toBe('Second sentence.');
    act(() => spoken[1]!.onend?.());
    expect(spoken).toHaveLength(2); // the diagram is not read
  });

  it('turns into pause/resume and a stop button while reading', () => {
    const { synth } = installSpeech();
    renderApp(list([user, agent]));
    fireEvent.click(screen.getByRole('button', { name: 'Listen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause reading' }));
    expect(synth.pause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Resume reading' }));
    expect(synth.resume).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stop reading' }));
    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Listen' })).toBeInTheDocument();
  });

  it('shows no voice controls when the browser cannot speak', () => {
    Reflect.deleteProperty(window, 'speechSynthesis');
    renderApp(list([user, agent]));
    expect(screen.queryByRole('button', { name: 'Listen' })).not.toBeInTheDocument();
  });

  it('does not offer to read a reply that is only a diagram', () => {
    installSpeech();
    renderApp(list([user, { id: 'a2', role: 'agent', content: '```mermaid\nflowchart TD\n  A --> B\n```' }]));
    expect(screen.queryByRole('button', { name: 'Listen' })).not.toBeInTheDocument();
  });
});

describe('voice mode: replies read aloud as they arrive', () => {
  const fresh: Turn = { id: 'a2', role: 'agent', content: 'A brand new reply.' };

  it('reads a newly arrived reply when voice mode is on, never the history on load', () => {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ voiceReplies: true }));
    const { spoken } = installSpeech();
    const { rerender } = renderApp(list([user, agent]));
    expect(spoken).toHaveLength(0); // history is silent
    rerender(list([user, agent, { id: 'u2', role: 'user', content: 'More?' }, fresh]));
    expect(spoken[0]?.text).toBe('A brand new reply.');
  });

  it('stays silent when voice mode is off', () => {
    const { spoken } = installSpeech();
    const { rerender } = renderApp(list([user, agent]));
    rerender(list([user, agent, fresh]));
    expect(spoken).toHaveLength(0);
  });
});
