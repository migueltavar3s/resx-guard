import { toPascalCaseKey, type ResourceRow } from '@resx-guard/core-ts';

export function resolveAddedKey(
  key: string,
  neutralValue: string,
  keyNaming: 'pascalFromNeutral' | 'manual'
): string {
  let finalKey = key.trim();
  if (!finalKey && keyNaming === 'pascalFromNeutral') {
    finalKey = toPascalCaseKey(neutralValue);
  }
  return finalKey || 'NewKey';
}

export interface RevealTarget {
  familyId: string;
  key: string;
}

export function rowMatchingReveal(rows: ResourceRow[], reveal: RevealTarget | null): ResourceRow | null {
  if (!reveal) {
    return null;
  }
  return rows.find((row) => row.familyId === reveal.familyId && row.key === reveal.key) ?? null;
}

export function applySnapshotSelection(
  rows: ResourceRow[],
  previous: ResourceRow | null,
  reveal: RevealTarget | null
): ResourceRow | null {
  const added = rowMatchingReveal(rows, reveal);
  if (added) {
    return added;
  }
  if (!previous) {
    return null;
  }
  return rows.find((row) => row.familyId === previous.familyId && row.key === previous.key) ?? null;
}

/** First empty visible locale, otherwise the first visible locale (so Add can type a value immediately). */
export function revealFocusLocale(row: ResourceRow, visibleLocales: string[]): string | undefined {
  const locales = visibleLocales.length > 0 ? visibleLocales : [''];
  const empty = locales.find((locale) => !(row.values[locale] ?? '').trim());
  return empty ?? locales[0];
}
