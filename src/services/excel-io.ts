import { NEUTRAL_LOCALE, type ResxFamily, type ResourceRow } from '../models/types';
import * as XLSX from 'xlsx';

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

const HEADER_RESOURCE = ['resource', 'family', 'file'];
const HEADER_KEY = ['key'];
const HEADER_COMMENT = ['comment', 'comments', 'comentario', 'comentário'];
const HEADER_NEUTRAL = ['neutral', 'neutro', 'default', 'invariant', 'neutral/default'];

export function localeColumnName(locale: string): string {
  return locale === NEUTRAL_LOCALE || locale === '' ? 'Neutral' : locale;
}

export function buildExcelPayload(
  families: ResxFamily[],
  rows: ResourceRow[],
  locales: string[]
): ExcelWorkbookPayload {
  const byId = new Map(families.map((f) => [f.id, f]));
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
  sheet['!cols'] = headers.map((h, i) => ({ wch: i < 3 ? 24 : 36 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Translations');
  return XLSX.write(wb, { bookType, type: 'buffer' }) as Buffer;
}

export function parseWorkbook(buffer: Buffer): ExcelWorkbookPayload {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const name = wb.SheetNames[0];
  if (!name) {
    return { locales: [NEUTRAL_LOCALE], rows: [] };
  }
  const sheet = wb.Sheets[name];
  const aoa = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });
  const header = (aoa[0] ?? []).map((cell) => String(cell ?? '').trim());
  const map = mapHeaders(header);
  const locales = map.locales.map((item) => item.locale);
  const rows: ExcelTranslationRow[] = [];

  for (const line of aoa.slice(1)) {
    const cells = (line ?? []).map((cell) => String(cell ?? ''));
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

  header.forEach((raw, index) => {
    const name = raw.toLowerCase();
    if (HEADER_RESOURCE.includes(name)) {
      resource = index;
      return;
    }
    if (HEADER_KEY.includes(name)) {
      key = index;
      return;
    }
    if (HEADER_COMMENT.includes(name)) {
      comment = index;
      return;
    }
    if (HEADER_NEUTRAL.includes(name) || raw === '') {
      locales.push({ locale: NEUTRAL_LOCALE, index });
      return;
    }
    locales.push({ locale: raw, index });
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
