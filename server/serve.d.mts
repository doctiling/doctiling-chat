// Types for tests/server/serve.test.ts; the runtime is plain Node (no deps).
import type { IncomingMessage, ServerResponse } from 'node:http';

export type RuntimeConfig = {
  apiOrigin: string;
  chatHost: string;
  version: string;
  port: number;
  dist: string;
};

export function readRuntimeConfig(env?: Record<string, string | undefined>): RuntimeConfig;
export function securityHeaders(apiOrigin: string): Record<string, string>;
export function injectConfig(html: string, cfg: Pick<RuntimeConfig, 'apiOrigin' | 'chatHost' | 'version'>): string;
export function createApp(cfg: RuntimeConfig): (req: IncomingMessage, res: ServerResponse) => void;
