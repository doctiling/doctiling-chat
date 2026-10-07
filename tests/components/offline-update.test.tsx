import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineBanner } from '@/components/OfflineBanner';
import { UpdateToast } from '@/components/UpdateToast';
import { reportNetworkFailure, reportNetworkSuccess } from '@/lib/online';
import { registerServiceWorker } from '@/lib/sw-register';
import { renderApp } from '../helpers/render';

// T071 — OfflineBanner (navigator.onLine + fetch failures, Retry) and the update flow
// (waiting worker → toast → SKIP_WAITING → reload, token untouched). [TS-398, TS-401]
describe('OfflineBanner (T071, TS-398)', () => {
  afterEach(() => {
    reportNetworkSuccess();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('is hidden online, appears on the offline event with Retry, disappears online', async () => {
    const onRetry = vi.fn();
    renderApp(<OfflineBanner onRetry={onRetry} />);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(await screen.findByTestId('offline-banner')).toHaveTextContent(/you are offline/i);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument());
  });

  it('a reported fetch failure shows the banner even when the OS says online, until a success', async () => {
    renderApp(<OfflineBanner />, { language: 'es' });
    act(() => reportNetworkFailure());
    expect(await screen.findByTestId('offline-banner')).toHaveTextContent('Sin conexión');
    act(() => reportNetworkSuccess());
    await waitFor(() => expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument());
  });
});

describe('Update flow (T071, TS-401)', () => {
  it('registerServiceWorker offers the waiting worker and SKIP_WAITING is posted only on apply', async () => {
    const waiting = { postMessage: vi.fn(), state: 'installed' };
    const reg = { waiting, installing: null, addEventListener: vi.fn() };
    const register = vi.fn(async () => reg);
    const swListeners: Record<string, () => void> = {};
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: { register, controller: {}, addEventListener: (t: string, fn: () => void) => (swListeners[t] = fn) },
    });
    vi.stubEnv('DEV', false);
    const onUpdate = vi.fn();
    await registerServiceWorker({ onUpdate });
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(waiting.postMessage).not.toHaveBeenCalled();
    onUpdate.mock.calls[0]![0].apply();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    vi.unstubAllEnvs();
  });

  it('UpdateToast shows the sticky toast with the Update action', async () => {
    const waiting = { postMessage: vi.fn(), state: 'installed' };
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: { register: vi.fn(async () => ({ waiting, installing: null, addEventListener: vi.fn() })), controller: {}, addEventListener: vi.fn() },
    });
    vi.stubEnv('DEV', false);
    window.localStorage.setItem('doctiling-chat:token', JSON.stringify({ token: 'keep-me' }));
    renderApp(<UpdateToast />);
    expect(await screen.findByRole('status')).toHaveTextContent('A new version is ready.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Update' }));
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(window.localStorage.getItem('doctiling-chat:token')).toContain('keep-me');
    vi.unstubAllEnvs();
  });
});
