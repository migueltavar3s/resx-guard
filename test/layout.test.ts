import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { applyColumnResize, clampPanelWidth, distributeToWidth } from '../webview/hooks/usePersistedLayout';

const styles = fs.readFileSync(path.resolve(__dirname, '../webview/styles.css'), 'utf8');

function selectorBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(match).not.toBeNull();
  return match?.[1] ?? '';
}

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

describe('summary overflow CSS', () => {
  it('allows the summary flex pane to shrink within the workspace', () => {
    expect(selectorBlock('.summary-panel')).toMatch(/\bmin-width\s*:\s*0\s*;/);
  });

  it('wraps and bounds long summary keys', () => {
    const block = selectorBlock('.summary-key');

    expect(block).toMatch(/\boverflow-wrap\s*:\s*anywhere\s*;/);
    expect(block).toMatch(/\bword-break\s*:\s*break-all\s*;/);
    expect(block).toMatch(/\bmax-height\s*:\s*[^;]+\s*;/);
  });

  it('wraps issue messages and editable cell text', () => {
    expect(selectorBlock('.issue-item-message')).toMatch(/\bword-break\s*:\s*break-all\s*;/);
    expect(selectorBlock('.issue-item-message')).toMatch(/\bdisplay\s*:\s*block\s*;/);
    expect(selectorBlock('.cell-textarea')).toMatch(/\bword-break\s*:\s*break-all\s*;/);
  });
});
