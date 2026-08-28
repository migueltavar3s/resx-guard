/** Keep user-visible language columns in sync when .resx files appear or vanish. */
export function mergeVisibleLocales(current: string[], discovered: string[]): string[] {
  if (discovered.length === 0) {
    return [];
  }
  if (current.length === 0) {
    return [...discovered];
  }
  const known = new Set(discovered);
  const kept = current.filter((locale) => known.has(locale));
  const added = discovered.filter((locale) => !current.includes(locale));
  const next = [...kept, ...added];
  return next.length > 0 ? next : [...discovered];
}
