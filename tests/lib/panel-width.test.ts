import { describe, expect, it } from 'vitest';
import { CONVERSATION_MIN, PANEL_MIN, clampWidth, expandedWidth } from '../../src/lib/panel-width';

// The document panel never squeezes the conversation below its minimum, nor shrinks below its own.
describe('panel width', () => {
  it('clamps between the panel minimum and what leaves the conversation room', () => {
    expect(clampWidth(100, 1600)).toBe(PANEL_MIN);
    expect(clampWidth(5000, 1600)).toBe(1600 - CONVERSATION_MIN);
    expect(clampWidth(500.4, 1600)).toBe(500);
  });

  it('on a narrow window the minimum wins', () => {
    expect(clampWidth(600, 500)).toBe(PANEL_MIN);
  });

  it('expanded is 65 % of the window, still clamped', () => {
    expect(expandedWidth(1600)).toBe(1040);
    expect(expandedWidth(800)).toBe(800 - CONVERSATION_MIN);
  });
});
