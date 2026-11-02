import { vi } from 'vitest';

/** A controllable EventSource: tests push server frames and drop/refuse the connection. */
export class FakeEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readonly url: string;
  readyState = FakeEventSource.CONNECTING;
  closed = false;
  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }
  open() {
    this.readyState = FakeEventSource.OPEN;
    this.dispatchEvent(new Event('open'));
  }
  emit(type: string, data: unknown = {}) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
  signal(data: unknown) {
    this.emit('signal', data);
  }
  /** A network drop: the browser keeps reconnecting. */
  drop() {
    this.readyState = FakeEventSource.CONNECTING;
    this.dispatchEvent(new Event('error'));
  }
  /** A refused stream (404 realtime off, 401, 403): the browser gives up. */
  refuse() {
    this.readyState = FakeEventSource.CLOSED;
    this.dispatchEvent(new Event('error'));
  }
}

export function stubEventSource() {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  return {
    get all() {
      return FakeEventSource.instances;
    },
    last: () => FakeEventSource.instances[FakeEventSource.instances.length - 1]!,
  };
}
