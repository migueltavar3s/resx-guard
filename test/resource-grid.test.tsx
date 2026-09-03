import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { DEFAULT_LAYOUT } from '../packages/ui/hooks/usePersistedLayout';
import {
  emptyColumnFilters,
  hasActiveColumnFilters,
  ResourceGrid,
} from '../packages/ui/components/ResourceGrid';
import { setLanguage } from '../packages/ui/i18n';

beforeAll(() => {
  class MockResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const noop = () => undefined;

describe('hasActiveColumnFilters', () => {
  it('treats the default filters as inactive', () => {
    expect(hasActiveColumnFilters(emptyColumnFilters())).toBe(false);
  });

  it('detects issue-type and text filters', () => {
    expect(hasActiveColumnFilters({ ...emptyColumnFilters(), issues: 'errors' })).toBe(true);
    expect(hasActiveColumnFilters({ ...emptyColumnFilters(), key: 'Save' })).toBe(true);
    expect(hasActiveColumnFilters({ ...emptyColumnFilters(), locales: { pt: 'olá' } })).toBe(true);
    expect(hasActiveColumnFilters({ ...emptyColumnFilters(), usage: '0' })).toBe(true);
  });
});

describe('ResourceGrid empty filters', () => {
  it('keeps the header and lets you clear a filter that matches nothing', () => {
    setLanguage('en');
    const onFiltersChange = vi.fn();
    const { getByText, getByRole } = render(
      <ResourceGrid
        rows={[]}
        allLocales={['']}
        visibleLocales={['']}
        layout={DEFAULT_LAYOUT}
        onLayoutWidths={noop}
        filters={{ key: '', usage: '', issues: 'errors', locales: {} }}
        onFiltersChange={onFiltersChange}
        selected={null}
        onSelect={noop}
        familyLabel={(id) => id}
        onUpdateCell={noop}
        onRenameKey={noop}
      />
    );

    expect(getByText('Issues')).toBeTruthy();
    expect(getByText('Errors')).toBeTruthy();
    expect(getByText('No rows match the filters.')).toBeTruthy();

    fireEvent.click(getByRole('button', { name: 'Clear filters' }));
    expect(onFiltersChange).toHaveBeenCalledWith(emptyColumnFilters());
  });
});

describe('ResourceGrid suggestion and usage', () => {
  it('shows a Usage column header next to Key', () => {
    setLanguage('en');
    const { getByText } = render(
      <ResourceGrid
        rows={[]}
        allLocales={['']}
        visibleLocales={['']}
        layout={DEFAULT_LAYOUT}
        onLayoutWidths={noop}
        filters={emptyColumnFilters()}
        onFiltersChange={noop}
        selected={null}
        onSelect={noop}
        familyLabel={(id) => id}
        onUpdateCell={noop}
        onRenameKey={noop}
      />
    );

    expect(getByText('Usage')).toBeTruthy();
    expect(getByText('Key')).toBeTruthy();
  });
});
