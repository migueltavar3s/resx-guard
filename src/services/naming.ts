/**
 * Convert a human string into a PascalCase C# identifier.
 * "Invalid resource file:" → "InvalidResourceFile"
 */
export function toPascalCaseKey(input: string): string {
  if (!input) {
    return '';
  }

  const cleaned = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`´]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  let result = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  // C# identifiers cannot start with a digit
  if (/^[0-9]/.test(result)) {
    result = 'N' + result;
  }

  return result;
}

/** Extract format placeholders like {0}, {1}, {name}. */
export function extractPlaceholders(text: string): string[] {
  if (!text) {
    return [];
  }
  const matches = text.match(/\{[^{}]+\}/g);
  if (!matches) {
    return [];
  }
  return [...new Set(matches)].sort();
}

/**
 * Suffix used for "ends the same way" checks:
 * trailing whitespace + terminal punctuation (. ? ! : ; …)
 */
export function extractEndingSuffix(text: string): string {
  if (!text) {
    return '';
  }
  const match = text.match(/([\s]*[.?!…:;]+[\s]*|[ \t\r\n]+)$/);
  return match ? match[0] : '';
}

export function endingsMatch(neutral: string, translation: string): boolean {
  if (!translation) {
    return true; // missing handled elsewhere
  }
  return extractEndingSuffix(neutral) === extractEndingSuffix(translation);
}

export function placeholdersMatch(neutral: string, translation: string): boolean {
  if (!translation) {
    return true;
  }
  const a = extractPlaceholders(neutral);
  const b = extractPlaceholders(translation);
  if (a.length !== b.length) {
    return false;
  }
  return a.every((p, i) => p === b[i]);
}

/** Parse culture from filename: Resources.pt.resx → "pt", Resources.pt-PT.resx → "pt-PT" */
export function parseLocaleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.resx$/i, '');
  const parts = base.split('.');
  if (parts.length === 1) {
    return '';
  }
  const culture = parts[parts.length - 1];
  // Culture tags: 2-3 letter lang, optional script, optional region
  if (/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)*$/.test(culture) && culture.length <= 12) {
    return culture;
  }
  return '';
}

export function getBaseName(fileName: string): string {
  const base = fileName.replace(/\.resx$/i, '');
  const locale = parseLocaleFromFileName(fileName);
  if (!locale) {
    return base;
  }
  return base.slice(0, -(locale.length + 1));
}

export function normalizeSearch(text: string): string {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
