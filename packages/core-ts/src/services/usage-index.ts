/**
 * Counts resource-key usages in project source text.
 *
 * `wordBoundary` is the default: `\bKey\b`, which matches C# members
 * (`Resources.SaveFailed`), quoted strings, and Razor/JS identifiers.
 * The extractor is mode-based so a stricter strategy can be added later
 * without changing the incremental index.
 */

export const USAGE_MATCH_MODES = ['wordBoundary'] as const;
export type UsageMatchMode = (typeof USAGE_MATCH_MODES)[number];

export const USAGE_SOURCE_EXTENSIONS = new Set([
  '.cs',
  '.cshtml',
  '.razor',
  '.vb',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.html',
  '.aspx',
  '.ascx',
  '.master',
  '.vue',
]);

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const IDENTIFIER_TOKEN = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function wordBoundaryPattern(key: string): string {
  return `\\b${escapeRegExp(key)}\\b`;
}

export function normalizeUsagePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function isExcludedUsagePath(filePath: string): boolean {
  const normalized = normalizeUsagePath(filePath).toLowerCase();
  if (
    normalized.includes('/bin/') ||
    normalized.includes('/obj/') ||
    normalized.includes('/node_modules/') ||
    normalized.includes('/.git/') ||
    normalized.includes('/.vs/')
  ) {
    return true;
  }
  if (normalized.endsWith('.resx') || normalized.endsWith('.designer.cs') || normalized.endsWith('.min.js')) {
    return true;
  }
  return false;
}

export function isUsageSourcePath(filePath: string): boolean {
  if (isExcludedUsagePath(filePath)) {
    return false;
  }
  const normalized = normalizeUsagePath(filePath);
  const dot = normalized.lastIndexOf('.');
  if (dot < 0) {
    return false;
  }
  return USAGE_SOURCE_EXTENSIONS.has(normalized.slice(dot).toLowerCase());
}

export interface UsageExtractor {
  readonly mode: UsageMatchMode;
  /** Token → count for every match this strategy can see in `text`. */
  extractCounts(text: string): Map<string, number>;
  countKey(text: string, key: string): number;
}

function countWordBoundary(text: string, key: string): number {
  if (!key) {
    return 0;
  }
  const re = new RegExp(wordBoundaryPattern(key), 'g');
  let count = 0;
  while (re.exec(text)) {
    count++;
  }
  return count;
}

function extractWordBoundaryCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  IDENTIFIER_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IDENTIFIER_TOKEN.exec(text))) {
    counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  }
  return counts;
}

export function createUsageExtractor(mode: UsageMatchMode = 'wordBoundary'): UsageExtractor {
  if (mode === 'wordBoundary') {
    return {
      mode,
      extractCounts: extractWordBoundaryCounts,
      countKey: countWordBoundary,
    };
  }
  const exhaustive: never = mode;
  return exhaustive;
}

export function countKeyUsages(
  text: string,
  key: string,
  mode: UsageMatchMode = 'wordBoundary'
): number {
  return createUsageExtractor(mode).countKey(text, key);
}

export function countAllKeyUsages(
  text: string,
  keys: readonly string[],
  mode: UsageMatchMode = 'wordBoundary'
): Map<string, number> {
  const extractor = createUsageExtractor(mode);
  const tokens = extractor.extractCounts(text);
  const result = new Map<string, number>();
  for (const key of keys) {
    if (!key) {
      continue;
    }
    let n = 0;
    if (mode === 'wordBoundary' && IDENTIFIER.test(key)) {
      n = tokens.get(key) ?? 0;
    } else {
      n = extractor.countKey(text, key);
    }
    if (n > 0) {
      result.set(key, n);
    }
  }
  return result;
}

/**
 * Per-file inverted index. File changes re-tokenize that file only.
 * Identifier bags mean adding/removing resource keys does not need a rescan.
 */
export class UsageIndex {
  private readonly perFile = new Map<string, Map<string, number>>();
  private readonly extractor: UsageExtractor;

  constructor(mode: UsageMatchMode = 'wordBoundary') {
    this.extractor = createUsageExtractor(mode);
  }

  get mode(): UsageMatchMode {
    return this.extractor.mode;
  }

  indexFile(filePath: string, text: string): void {
    const normalized = normalizeUsagePath(filePath);
    if (!isUsageSourcePath(normalized)) {
      this.removeFile(normalized);
      return;
    }
    this.perFile.set(normalized, this.extractor.extractCounts(text));
  }

  removeFile(filePath: string): void {
    this.perFile.delete(normalizeUsagePath(filePath));
  }

  count(key: string): number {
    if (!key) {
      return 0;
    }
    let total = 0;
    for (const tokens of this.perFile.values()) {
      total += tokens.get(key) ?? 0;
    }
    if (total > 0 || (this.extractor.mode === 'wordBoundary' && IDENTIFIER.test(key))) {
      return total;
    }
    return total;
  }

  clear(): void {
    this.perFile.clear();
  }

  get indexedFileCount(): number {
    return this.perFile.size;
  }
}
