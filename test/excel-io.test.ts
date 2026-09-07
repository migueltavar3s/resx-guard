import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { NEUTRAL_LOCALE, type ResxFamily } from '@resx-guard/core-ts';
import {
  buildExcelPayload,
  localeColumnName,
  matchImportedLocale,
  normalizeHeaderName,
  parseWorkbook,
  remapImportedLocales,
  resolveFamilyForImport,
  workbookBuffer,
} from '@resx-guard/core-ts';

function workbookFromRows(rows: (string | number)[][]): Buffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Translations');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}

describe('excel import/export', () => {
  it.each(['xlsx', 'xls'] as const)('round-trips keys, comments, and all locales through %s', (bookType) => {
    const payload = buildExcelPayload(
      [
        {
          id: 'fam1',
          basePath: '/p/Resources.resx',
          displayName: 'Properties/Resources',
          projectName: 'p',
          files: { '': '/p/Resources.resx', pt: '/p/Resources.pt.resx' },
        },
      ],
      [
        {
          familyId: 'fam1',
          key: 'WelcomeMessage',
          comment: 'Shown on the sign-in screen',
          values: { '': 'Welcome\nback', pt: 'Bem-vindo\nà loja' },
          issues: [],
        },
        {
          familyId: 'fam1',
          key: '42',
          comment: 'Numeric-looking strings',
          values: { '': '42', pt: '0042' },
          issues: [],
        },
      ],
      ['', 'pt']
    );

    const buffer = workbookBuffer(payload, bookType);
    const parsed = parseWorkbook(buffer);

    expect(parsed.locales).toEqual(['', 'pt']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.key).toBe('WelcomeMessage');
    expect(parsed.rows[0]?.resource).toBe('Properties/Resources');
    expect(parsed.rows[0]?.comment).toBe('Shown on the sign-in screen');
    expect(parsed.rows[0]?.values[NEUTRAL_LOCALE]).toBe('Welcome\nback');
    expect(parsed.rows[0]?.values.pt).toBe('Bem-vindo\nà loja');
    expect(parsed.rows[1]).toEqual({
      resource: 'Properties/Resources',
      key: '42',
      comment: 'Numeric-looking strings',
      values: { '': '42', pt: '0042' },
    });
  });

  it('skips empty keys', () => {
    const payload = parseWorkbook(
      workbookBuffer({
        locales: [''],
        rows: [
          { resource: 'R', key: '', comment: '', values: { '': 'x' } },
          { resource: 'R', key: 'Ok', comment: '', values: { '': 'OK' } },
        ],
      })
    );
    expect(payload.rows.map((r) => r.key)).toEqual(['Ok']);
  });
});

describe('Excel header parsing', () => {
  it('maps Portuguese headers to resource, key, comment, neutral, and locale fields', () => {
    const parsed = parseWorkbook(
      workbookFromRows([
        ['Recurso', 'Chave', 'Comentário', 'Neutro', 'pt'],
        ['Properties/Resources', 'Welcome', 'Saudação inicial', 'Welcome', 'Bem-vindo'],
      ])
    );

    expect(parsed).toEqual({
      locales: ['', 'pt'],
      rows: [
        {
          resource: 'Properties/Resources',
          key: 'Welcome',
          comment: 'Saudação inicial',
          values: { '': 'Welcome', pt: 'Bem-vindo' },
        },
      ],
    });
  });

  it('does not treat empty trailing header columns as another neutral locale', () => {
    const parsed = parseWorkbook(
      workbookFromRows([
        ['Resource', 'Key', 'Comment', 'Neutral', ''],
        ['Resources', 'Save', '', 'Save', ''],
      ])
    );

    expect(parsed.locales).toEqual(['']);
    expect(parsed.rows[0]?.values).toEqual({ '': 'Save' });
  });

  it('strips a BOM from the first header before matching Resource', () => {
    const parsed = parseWorkbook(
      workbookFromRows([
        ['\uFEFFResource', 'Key', 'Comment', 'Neutral'],
        ['Properties/Resources', 'Open', '', 'Open'],
      ])
    );

    expect(parsed.rows[0]?.resource).toBe('Properties/Resources');
    expect(parsed.rows[0]?.key).toBe('Open');
  });

  it('uses the first duplicate locale column and emits the locale once', () => {
    const parsed = parseWorkbook(
      workbookFromRows([
        ['Resource', 'Key', 'Comment', 'pt', 'PT'],
        ['Resources', 'Save', '', 'Guardar', 'Substituir'],
      ])
    );

    expect(parsed.locales).toEqual(['pt']);
    expect(parsed.rows[0]?.values).toEqual({ pt: 'Guardar' });
  });

  it('ignores Project instead of treating it as a locale', () => {
    const parsed = parseWorkbook(
      workbookFromRows([
        ['Project', 'Resource', 'Key', 'Comment', 'Neutral', 'pt'],
        ['Shop', 'Properties/Resources', 'Cancel', '', 'Cancel', 'Cancelar'],
      ])
    );

    expect(parsed.locales).toEqual(['', 'pt']);
    expect(parsed.rows[0]).toEqual({
      resource: 'Properties/Resources',
      key: 'Cancel',
      comment: '',
      values: { '': 'Cancel', pt: 'Cancelar' },
    });
  });
});

describe('Excel locale helpers', () => {
  it('normalizes locale column names and imported header text', () => {
    expect(localeColumnName('')).toBe('Neutral');
    expect(localeColumnName('pt')).toBe('pt');
    expect(normalizeHeaderName('\uFEFF  Recurso  ')).toBe('recurso');
  });

  it('matches imported locale casing while preserving unknown locales', () => {
    expect(matchImportedLocale('PT', ['', 'pt'])).toBe('pt');
    expect(matchImportedLocale('es', ['', 'pt'])).toBe('es');
  });

  it('remaps locale casing without replacing a non-empty value with an empty duplicate', () => {
    expect(remapImportedLocales({ PT: 'Bem-vindo', pt: '', es: 'Hola' }, ['', 'pt'])).toEqual({
      pt: 'Bem-vindo',
      es: 'Hola',
    });
  });
});

describe('resolveFamilyForImport', () => {
  const properties: ResxFamily = {
    id: 'properties',
    basePath: '/app/Properties/Resources.resx',
    displayName: 'Properties/Resources',
    projectName: 'app',
    files: { '': '/app/Properties/Resources.resx' },
  };
  const admin: ResxFamily = {
    id: 'admin',
    basePath: '/app/Admin/Resources.resx',
    displayName: 'Admin/Resources',
    projectName: 'app',
    files: { '': '/app/Admin/Resources.resx' },
  };
  const strings: ResxFamily = {
    id: 'strings',
    basePath: '/app/Features/Strings.resx',
    displayName: 'Features/Strings',
    projectName: 'app',
    files: { '': '/app/Features/Strings.resx' },
  };

  it('resolves an exact display name', () => {
    expect(resolveFamilyForImport([properties, admin], 'Properties/Resources')).toBe(properties);
  });

  it('resolves a basename when it is unique', () => {
    expect(resolveFamilyForImport([properties, strings], 'Resources')).toBe(properties);
  });

  it('rejects an ambiguous basename unless selection identifies one family', () => {
    expect(resolveFamilyForImport([properties, admin], 'Resources')).toBeUndefined();
    expect(resolveFamilyForImport([properties, admin], 'Resources', ['admin'])).toBe(admin);
  });

  it('uses the sole selected family for an empty resource', () => {
    expect(resolveFamilyForImport([properties, admin], '', ['properties'])).toBe(properties);
  });

  it('rejects an empty resource when multiple families have no unique selection', () => {
    expect(resolveFamilyForImport([properties, admin], '')).toBeUndefined();
    expect(resolveFamilyForImport([properties, admin], '', ['properties', 'admin'])).toBeUndefined();
  });

  it('does not greedily choose the first family when multiple base paths share a short suffix', () => {
    const first = {
      ...properties,
      displayName: 'One/Labels',
      basePath: '/app/One/Shared.resx',
    };
    const second = {
      ...admin,
      displayName: 'Two/Messages',
      basePath: '/app/Two/Shared.resx',
    };

    expect(resolveFamilyForImport([first, second], 'Shared')).toBeUndefined();
  });
});
