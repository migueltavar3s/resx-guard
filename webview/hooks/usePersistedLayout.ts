import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'resxGuard.gridLayout.v4';

export interface GridLayout {
  showKey: boolean;
  showIssues: boolean;
  widths: {
    key: number;
    issues: number;
    locales: Record<string, number>;
  };
  summaryOpen: boolean;
  summaryWidth: number;
  sidebarWidth: number;
}

export const DEFAULT_LAYOUT: GridLayout = {
  showKey: true,
  showIssues: true,
  widths: {
    key: 180,
    issues: 92,
    locales: {},
  },
  summaryOpen: false,
  summaryWidth: 260,
  sidebarWidth: 196,
};

function loadLayout(): GridLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_LAYOUT;
    }
    const parsed = JSON.parse(raw) as Partial<GridLayout>;
    return {
      ...DEFAULT_LAYOUT,
      ...parsed,
      widths: {
        ...DEFAULT_LAYOUT.widths,
        ...(parsed.widths ?? {}),
        locales: { ...DEFAULT_LAYOUT.widths.locales, ...(parsed.widths?.locales ?? {}) },
      },
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function usePersistedLayout(): [
  GridLayout,
  (patch: Partial<GridLayout> | ((prev: GridLayout) => Partial<GridLayout>)) => void,
] {
  const [layout, setLayout] = useState<GridLayout>(loadLayout);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  const patch = useCallback(
    (partial: Partial<GridLayout> | ((prev: GridLayout) => Partial<GridLayout>)) => {
      setLayout((prev) => {
        const next = typeof partial === 'function' ? partial(prev) : partial;
        return {
          ...prev,
          ...next,
          widths: next.widths
            ? {
                ...prev.widths,
                ...next.widths,
                locales: { ...prev.widths.locales, ...(next.widths.locales ?? {}) },
              }
            : prev.widths,
        };
      });
    },
    []
  );

  return [layout, patch];
}

export const PANEL_LIMITS = {
  sidebar: { min: 148, max: 420 },
  summary: { min: 200, max: 560 },
} as const;

export function clampPanelWidth(width: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(width)));
}

export const COLUMN_MIN = {
  key: 110,
  issues: 72,
  locale: 140,
} as const;

export function localeWidth(layout: GridLayout, locale: string): number {
  return layout.widths.locales[locale] ?? 220;
}

export function columnMin(kind: 'key' | 'issues' | 'locale'): number {
  return COLUMN_MIN[kind];
}

/** Scale preferred widths so they fill `available` while respecting mins. */
export function distributeToWidth(
  preferred: number[],
  mins: number[],
  available: number
): number[] {
  const n = preferred.length;
  if (n === 0) {
    return [];
  }
  const minSum = mins.reduce((sum, min) => sum + min, 0);
  if (available <= minSum) {
    return [...mins];
  }

  const weights = preferred.map((width, i) => Math.max(width, mins[i], 1));
  const weightSum = weights.reduce((sum, width) => sum + width, 0);
  const widths = weights.map((width, i) =>
    Math.max(mins[i], Math.floor((width / weightSum) * available))
  );

  let leftover = available - widths.reduce((sum, width) => sum + width, 0);
  let guard = 0;
  while (leftover !== 0 && guard < n * 8) {
    const i = n - 1 - (guard % n);
    if (leftover > 0) {
      widths[i] += 1;
      leftover -= 1;
    } else if (widths[i] > mins[i]) {
      widths[i] -= 1;
      leftover += 1;
    }
    guard += 1;
  }
  return widths;
}

/** Drag-resize one column; leftover space is taken from / given to the others. */
export function applyColumnResize(
  displayed: number[],
  mins: number[],
  index: number,
  delta: number,
  available: number
): number[] {
  const next = [...displayed];
  if (next.length === 0) {
    return next;
  }
  const maxForIndex =
    available - mins.reduce((sum, min, i) => (i === index ? sum : sum + min), 0);
  next[index] = Math.max(mins[index], Math.min(maxForIndex, next[index] + delta));

  let overflow = next.reduce((sum, width) => sum + width, 0) - available;
  if (overflow > 0) {
    for (let i = next.length - 1; i >= 0 && overflow > 0; i--) {
      if (i === index) {
        continue;
      }
      const take = Math.min(next[i] - mins[i], overflow);
      next[i] -= take;
      overflow -= take;
    }
  } else if (overflow < 0) {
    const growIdx = index < next.length - 1 ? next.length - 1 : 0;
    next[growIdx] -= overflow;
  }
  return next;
}
