import * as path from 'path';
import * as XLSX from 'xlsx';
import { NEUTRAL_LOCALE, type ResxFamily, type ResourceRow } from '../models/types';

export interface ExcelTranslationRow {
  resource: string;
  key: string;
  comment: string;
  values: Record<string, string>;
}

export interface ExcelWorkbookPayload {
  locales: string[];
  rows: ExcelTranslationRow[];
}

const HEADER_RESOURCE = new Set([
  'resource',
  'family',
  'file',
  'recurso',
  'ficheiro',
  'arquivo',
]);
const HEADER_KEY = new Set(['key', 'chave']);
const HEADER_COMMENT = new Set([
  'comment',
  'comments',
  'comentario',
  'comentário',
  'comentarios',
  'comentários',
]);
const HEADER_NEUTRAL = new Set([
  'neutral',
  'neutro',
  'default',
  'invariant',
  'neutral/default',
  'invariant culture',
]);
const HEADER_SKIP = new Set(['project', 'projeto', 'project name', 'id']);

export function localeColumnName(locale: string): string {
  return locale === NEUTRAL_LOCALE || locale === '' ? 'Neutral' : locale;
}

export function normalizeHeaderName(raw: string): string {
  return raw.replace(/^\uFEFF/, '').trim().toLowerCase();
}

export function matchImportedLocale(imported: string, knownLocales: string[]): string {
  if (imported === NEUTRAL_LOCALE || imported === '') {
    return NEUTRAL_LOCALE;
  }
  const exact = knownLocales.find((locale) => locale === imported);
  if (exact !== undefined) {
    return exact;
  }
  const ci = knownLocales.find((locale) => locale.toLowerCase() === imported.toLowerCase());
  if (ci !== undefined) {
    return ci;
  }
  return imported;
}

export function remapImportedLocales(
  values: Record<string, string>,
  knownLocales: string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [locale, value] of Object.entries(values)) {
    const mapped = matchImportedLocale(locale, knownLocales);
    const previous = out[mapped];
    if (previous !== undefined && previous !== '' && value === '') {
      continue;
    }
    out[mapped] = value;
  }
  return out;
}

export function resolveFamilyForImport(
  families: ResxFamily[],
  resource: string,
  selectedFamilyIds: Iterable<string> = []
): ResxFamily | undefined {
  const name = resource.trim();
  const selected = new Set(selectedFamilyIds);

  if (!name) {
    if (selected.size === 1) {
      const id = [...selected][0];
      return families.find((family) => family.id === id);
    }
    return families.length === 1 ? families[0] : undefined;
  }

  const lower = normalizePath(name).toLowerCase();

  return (
    uniqueMatch(
      families.filter((family) => family.displayName === name),
      selected
    ) ??
    uniqueMatch(
      families.filter((family) => family.id === name),
      selected
    ) ??
    uniqueMatch(
      families.filter((family) => normalizePath(family.displayName).toLowerCase() === lower),
      selected
    ) ??
    uniqueMatch(
      families.filter((family) => family.id.toLowerCase() === lower),
      selected
    ) ??
    uniqueMatch(
      families.filter((family) => familyBasename(family).toLowerCase() === lower),
      selected
    ) ??
    uniqueMatch(
      families.filter((family) => {
        const display = normalizePath(family.displayName).toLowerCase();
        return display === lower || display.endsWith(`/${lower}`);
      }),
      selected
    ) ??
    uniqueMatch(
      families.filter((family) => {
        const file = normalizePath(family.basePath).toLowerCase();
        return file.endsWith(`/${lower}.resx`) || file.endsWith(`/${lower}`);
      }),
      selected
    )
  );
}

export function buildExcelPayload(
  families: ResxFamily[],
  rows: ResourceRow[],
  locales: string[]
): ExcelWorkbookPayload {
  const byId = new Map(families.map((family) => [family.id, family]));
  const orderedLocales = orderLocales(locales);
  return {
    locales: orderedLocales,
    rows: rows.map((row) => ({
      resource: byId.get(row.familyId)?.displayName ?? row.familyId,
      key: row.key,
      comment: row.comment ?? '',
      values: { ...row.values },
    })),
  };
}

export function workbookBuffer(payload: ExcelWorkbookPayload, bookType: 'xlsx' | 'xls' = 'xlsx'): Buffer {
  const headers = ['Resource', 'Key', 'Comment', ...payload.locales.map(localeColumnName)];
  const aoa: string[][] = [headers];
  for (const row of payload.rows) {
    aoa.push([
      row.resource,
      row.key,
      row.comment,
      ...payload.locales.map((locale) => row.values[locale] ?? ''),
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = headers.map((_, i) => ({ wch: i < 3 ? 24 : 36 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Translations');
  return XLSX.write(wb, { bookType, type: 'buffer' }) as Buffer;
}

export function parseWorkbook(buffer: Buffer): ExcelWorkbookPayload {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const name = wb.SheetNames[0];
  if (!name) {
    return { locales: [NEUTRAL_LOCALE], rows: [] };
  }
  const sheet = wb.Sheets[name];
  const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  const header = (aoa[0] ?? []).map((cell) => cellText(cell));
  const map = mapHeaders(header);
  const locales = map.locales.map((item) => item.locale);
  const rows: ExcelTranslationRow[] = [];

  for (const line of aoa.slice(1)) {
    const cells = (line ?? []).map((cell) => cellText(cell));
    const key = (cells[map.key] ?? '').trim();
    if (!key) {
      continue;
    }
    const values: Record<string, string> = {};
    for (const item of map.locales) {
      values[item.locale] = cells[item.index] ?? '';
    }
    rows.push({
      resource: (cells[map.resource] ?? '').trim(),
      key,
      comment: (cells[map.comment] ?? '').trim(),
      values,
    });
  }

  return { locales: locales.length > 0 ? locales : [NEUTRAL_LOCALE], rows };
}

function cellText(cell: string | number | boolean | undefined): string {
  if (cell === undefined || cell === null) {
    return '';
  }
  if (typeof cell === 'string') {
    return cell.replace(/^\uFEFF/, '');
  }
  if (typeof cell === 'number') {
    return Number.isInteger(cell) ? String(cell) : String(cell);
  }
  if (typeof cell === 'boolean') {
    return cell ? 'TRUE' : 'FALSE';
  }
  return String(cell);
}

function orderLocales(locales: string[]): string[] {
  return [...locales].sort((a, b) => {
    if (a === NEUTRAL_LOCALE) {
      return -1;
    }
    if (b === NEUTRAL_LOCALE) {
      return 1;
    }
    return a.localeCompare(b);
  });
}

function mapHeaders(header: string[]): {
  resource: number;
  key: number;
  comment: number;
  locales: { locale: string; index: number }[];
} {
  let resource = -1;
  let key = -1;
  let comment = -1;
  const locales: { locale: string; index: number }[] = [];
  const seenLocales = new Set<string>();
  let hasNeutral = false;

  header.forEach((raw, index) => {
    const name = normalizeHeaderName(raw);
    if (!name) {
      return;
    }
    if (HEADER_SKIP.has(name)) {
      return;
    }
    if (HEADER_RESOURCE.has(name)) {
      resource = index;
      return;
    }
    if (HEADER_KEY.has(name)) {
      key = index;
      return;
    }
    if (HEADER_COMMENT.has(name)) {
      comment = index;
      return;
    }
    const locale = HEADER_NEUTRAL.has(name) ? NEUTRAL_LOCALE : raw.replace(/^\uFEFF/, '').trim();
    if (locale === NEUTRAL_LOCALE) {
      if (hasNeutral) {
        return;
      }
      hasNeutral = true;
    }
    const localeKey = locale === NEUTRAL_LOCALE ? NEUTRAL_LOCALE : locale.toLowerCase();
    if (seenLocales.has(localeKey)) {
      return;
    }
    seenLocales.add(localeKey);
    locales.push({ locale, index });
  });

  if (key < 0) {
    key = 1;
  }
  if (resource < 0) {
    resource = 0;
  }
  if (comment < 0) {
    comment = 2;
  }
  if (locales.length === 0) {
    locales.push({ locale: NEUTRAL_LOCALE, index: 3 });
  }

  return { resource, key, comment, locales };
}

function uniqueMatch(matches: ResxFamily[], selected: Set<string>): ResxFamily | undefined {
  if (matches.length === 1) {
    return matches[0];
  }
  if (matches.length === 0) {
    return undefined;
  }
  const inSelection = matches.filter((family) => selected.has(family.id));
  return inSelection.length === 1 ? inSelection[0] : undefined;
}

function familyBasename(family: ResxFamily): string {
  const fromDisplay = normalizePath(family.displayName).split('/').pop() ?? '';
  if (fromDisplay) {
    return fromDisplay;
  }
  return path.basename(family.basePath, '.resx');
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}
