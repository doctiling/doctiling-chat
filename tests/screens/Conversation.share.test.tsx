import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../../src/screens/Conversation';
import { json, mockFetch, on, renderApp } from '../helpers/render';

const session = () => json({ turns: [], actions: [], pending: null, isRunning: false });

// Share: the system sheet when the browser has one, the clipboard otherwise. The
// link is the base's conversation URL; access is still decided by the server.
describe('Conversation share', () => {
  const nav = navigator as Navigator & { share?: unknown };
  const original = { share: nav.share, clipboard: navigator.clipboard };
  afterEach(() => {
    Object.defineProperty(navigator, 'share', { value: original.share, configurable: true, writable: true });
    Object.defineProperty(navigator, 'clipboard', { value: original.clipboard, configurable: true, writable: true });
  });

  it('opens the system share sheet with the base name and its conversation URL', async () => {
    // userEvent installs its own clipboard stub: set it up before replacing navigator.clipboard.
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
    mockFetch([{ match: on('GET', /\/session$/), respond: session }]);
    renderApp(<Conversation kbId="kb-pol" kbName="Políticas" />);
    await user.click(await screen.findByRole('button', { name: 'Share a link to this base' }));
    expect(share).toHaveBeenCalledWith({ title: 'Políticas', url: `${window.location.origin}/es/chat/kb/kb-pol` });
    expect(screen.queryByText(/link copied/i)).not.toBeInTheDocument();
  });

  it('copies the link and says so when there is no share sheet', async () => {
    // userEvent installs its own clipboard stub: set it up before replacing navigator.clipboard.
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });
    mockFetch([{ match: on('GET', /\/session$/), respond: session }]);
    renderApp(<Conversation kbId="kb-pol" kbName="Políticas" />);
    await user.click(await screen.findByRole('button', { name: 'Share a link to this base' }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/es/chat/kb/kb-pol`);
    expect(screen.getByText(/link copied/i)).toBeInTheDocument();
  });

  it('stays quiet when the person closes the share sheet', async () => {
    // userEvent installs its own clipboard stub: set it up before replacing navigator.clipboard.
    const user = userEvent.setup();
    const share = vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError'));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true });
    mockFetch([{ match: on('GET', /\/session$/), respond: session }]);
    renderApp(<Conversation kbId="kb-pol" kbName="Políticas" />);
    await user.click(await screen.findByRole('button', { name: 'Share a link to this base' }));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports an error when neither the sheet nor the clipboard work', async () => {
    // userEvent installs its own clipboard stub: set it up before replacing navigator.clipboard.
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true, writable: true });
    mockFetch([{ match: on('GET', /\/session$/), respond: session }]);
    renderApp(<Conversation kbId="kb-pol" kbName="Políticas" />);
    await user.click(await screen.findByRole('button', { name: 'Share a link to this base' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be shared/i);
  });
});
