import { describe, expect, it } from 'vitest';
import { applyColumnResize, clampPanelWidth, distributeToWidth } from '../webview/hooks/usePersistedLayout';

describe('distributeToWidth', () => {
  it('fills the available width proportionally', () => {
    const widths = distributeToWidth([180, 160, 220, 220], [110, 140, 140, 140], 800);
    expect(widths.reduce((sum, w) => sum + w, 0)).toBe(800);
    expect(widths.every((w, i) => w >= [110, 140, 140, 140][i])).toBe(true);
  });

  it('falls back to mins when the container is too narrow', () => {
    expect(distributeToWidth([180, 220], [110, 140], 200)).toEqual([110, 140]);
  });
});

describe('applyColumnResize', () => {
  it('keeps the total equal to the available width', () => {
    const next = applyColumnResize([200, 200, 400], [110, 140, 140], 0, 80, 800);
    expect(next.reduce((sum, w) => sum + w, 0)).toBe(800);
    expect(next[0]).toBeGreaterThan(200);
  });
});

describe('clampPanelWidth', () => {
  it('clamps sidebar and summary sizes', () => {
    expect(clampPanelWidth(100, 148, 420)).toBe(148);
    expect(clampPanelWidth(900, 200, 560)).toBe(560);
    expect(clampPanelWidth(240.6, 200, 560)).toBe(241);
  });
});
