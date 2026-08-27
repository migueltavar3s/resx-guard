import { describe, expect, it } from 'vitest';
import { NEUTRAL_LOCALE } from '../src/models/types';
import {
  buildExcelPayload,
  parseWorkbook,
  workbookBuffer,
} from '../src/services/excel-io';

describe('excel import/export', () => {
  it('round-trips keys and all locales', () => {
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
          comment: '',
          values: { '': 'Welcome', pt: 'Bem-vindo' },
          issues: [],
        },
      ],
      ['', 'pt']
    );

    const buffer = workbookBuffer(payload, 'xlsx');
    const parsed = parseWorkbook(buffer);

    expect(parsed.locales).toEqual(['', 'pt']);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.key).toBe('WelcomeMessage');
    expect(parsed.rows[0]?.resource).toBe('Properties/Resources');
    expect(parsed.rows[0]?.values[NEUTRAL_LOCALE]).toBe('Welcome');
    expect(parsed.rows[0]?.values.pt).toBe('Bem-vindo');
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
