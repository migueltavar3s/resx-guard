import { describe, expect, it } from 'vitest';
import { mergeVisibleLocales } from '../src/services/locale-columns';

describe('mergeVisibleLocales', () => {
  it('shows every locale on first load', () => {
    expect(mergeVisibleLocales([], ['', 'pt'])).toEqual(['', 'pt']);
  });

  it('appends a newly created culture so the grid gets a column', () => {
    expect(mergeVisibleLocales(['', 'pt'], ['', 'fr', 'pt'])).toEqual(['', 'pt', 'fr']);
  });

  it('drops locales whose files disappeared', () => {
    expect(mergeVisibleLocales(['', 'pt', 'es'], ['', 'pt'])).toEqual(['', 'pt']);
  });
});
