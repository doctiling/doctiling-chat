// Connectivity signal (FR-023): navigator.onLine plus fetch failures reported
// by the screens, so the banner appears within seconds even when the OS still
// believes it is online.
import * as React from 'react';

type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();
let forcedOffline = false;

function current(): boolean {
  if (forcedOffline) return false;
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

function emit() {
  const v = current();
  for (const l of listeners) l(v);
}

/** A screen saw a network failure: show offline until a request succeeds or the OS says online. */
export function reportNetworkFailure() {
  forcedOffline = true;
  emit();
}

export function reportNetworkSuccess() {
  if (!forcedOffline) return;
  forcedOffline = false;
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    forcedOffline = false;
    emit();
  });
  window.addEventListener('offline', emit);
}

export function useOnline(): boolean {
  const [online, setOnline] = React.useState(current);
  React.useEffect(() => {
    listeners.add(setOnline);
    setOnline(current());
    return () => {
      listeners.delete(setOnline);
    };
  }, []);
  return online;
}
