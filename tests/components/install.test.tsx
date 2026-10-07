import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstallButton } from '../../src/components/InstallButton';
import { IosInstallHint } from '../../src/components/IosInstallHint';
import { _setDeferredPromptForTests, isStandalone, type BeforeInstallPromptEvent } from '../../src/lib/install';
import { getPrefs } from '../../src/lib/storage';
import { renderApp } from '../helpers/render';

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';

function setStandalone(matches: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('standalone') && matches, media: q, addEventListener() {}, removeEventListener() {} }));
}

// T072 — beforeinstallprompt → Install button; iOS hint only outside standalone, dismissable, in the language. [TS-400]
describe('InstallButton (T072)', () => {
  afterEach(() => _setDeferredPromptForTests(null));

  it('is hidden without a deferred prompt and prompts once when available', async () => {
    setStandalone(false);
    renderApp(<InstallButton />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    const prompt = vi.fn(async () => {});
    act(() => _setDeferredPromptForTests({ prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) } as unknown as BeforeInstallPromptEvent));
    const button = await screen.findByRole('button', { name: 'Install' });
    act(() => button.focus());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/home screen/i);
    await userEvent.setup().click(button);
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('is hidden when already installed (standalone)', () => {
    setStandalone(true);
    act(() => _setDeferredPromptForTests({ prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'dismissed' }) } as unknown as BeforeInstallPromptEvent));
    renderApp(<InstallButton />);
    expect(isStandalone()).toBe(true);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('IosInstallHint (T072, TS-400)', () => {
  it.each([
    ['navegador', false, true],
    ['instalado', true, false],
  ])('on iOS in mode %s the instructions shown = %s', (_mode, standalone, visible) => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: IOS_UA, language: 'es-CO' });
    setStandalone(standalone);
    renderApp(<IosInstallHint />, { language: 'es' });
    if (visible) expect(screen.getByTestId('ios-install-hint')).toHaveTextContent('Instala en tu iPhone');
    else expect(screen.queryByTestId('ios-install-hint')).not.toBeInTheDocument();
  });

  it('is not shown on Android and can be dismissed on iOS (pref persisted)', async () => {
    setStandalone(false);
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile' });
    const { unmount } = renderApp(<IosInstallHint />);
    expect(screen.queryByTestId('ios-install-hint')).not.toBeInTheDocument();
    unmount();
    vi.stubGlobal('navigator', { ...navigator, userAgent: IOS_UA });
    renderApp(<IosInstallHint />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('ios-install-hint')).not.toBeInTheDocument();
    expect(getPrefs().iosHintDismissed).toBe(true);
  });
});
