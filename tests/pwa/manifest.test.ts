import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lightColors } from '@doctiling/brand';

const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
const indexHtml = readFileSync(path.join(root, 'index.html'), 'utf8');

// T069 — own name, icons and colors; scope and start_url of the chat; standalone; launch_handler. [TS-396, TS-402]
describe('manifest (T069)', () => {
  it('declares the chat identity: name, short_name, standalone, own scope and start (TS-402)', () => {
    expect(manifest.name).toBe('Doctiling Chat');
    expect(manifest.short_name).toBe('Chat');
    expect(manifest.display).toBe('standalone');
    expect(manifest.scope).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.launch_handler).toEqual({ client_mode: 'navigate-existing' });
  });

  it('ships its own icons (any + maskable, 192 and 512) and they exist', () => {
    const purposes = (p: string) => manifest.icons.filter((i: { purpose: string }) => i.purpose === p).map((i: { sizes: string }) => i.sizes).sort();
    expect(purposes('any')).toEqual(['192x192', '512x512']);
    expect(purposes('maskable')).toEqual(['192x192', '512x512']);
    for (const icon of manifest.icons) {
      const file = path.join(root, 'public', icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const head = readFileSync(file).subarray(0, 8);
      expect([...head]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    }
  });

  it('colors come from the brand tokens and index.html agrees on theme-color (TS-396)', () => {
    expect(manifest.theme_color.toLowerCase()).toBe(lightColors.primary.toLowerCase());
    expect(manifest.background_color.toLowerCase()).toBe(lightColors.background.toLowerCase());
    const meta = /<meta name="theme-color" content="([^"]+)"/.exec(indexHtml);
    expect(meta?.[1]?.toLowerCase()).toBe(lightColors.primary.toLowerCase());
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(indexHtml).toContain('viewport-fit=cover');
  });

  it('index.html carries the config placeholder the server replaces', () => {
    expect(indexHtml).toContain('<script id="doctiling-chat-config">');
  });
});
