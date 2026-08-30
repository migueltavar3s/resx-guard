import { describe, expect, it } from 'vitest';
import { estimateRowHeight } from '../packages/ui/utils/rowSize';
import { issuesForCell, tooltipLines } from '../packages/ui/utils/issueMeta';
import { setLanguage } from '../packages/ui/i18n';
import type { ValidationIssue } from '@resx-guard/core-ts';

describe('estimateRowHeight', () => {
  it('stays compact for a single short line', () => {
    expect(estimateRowHeight(['Save'], [140])).toBe(32);
  });

  it('grows when text wraps or has newlines', () => {
    const short = estimateRowHeight(['Hi'], [140]);
    const wrapped = estimateRowHeight(['A'.repeat(80)], [140]);
    const multiline = estimateRowHeight(['one\ntwo\nthree\nfour'], [200]);
    expect(wrapped).toBeGreaterThan(short);
    expect(multiline).toBeGreaterThan(short);
  });

  it('grows for a long key without spaces in a narrow key column', () => {
    const short = estimateRowHeight(['ShortKey'], [120]);
    const long = estimateRowHeight(['K'.repeat(200)], [120]);

    expect(long).toBeGreaterThan(short);
  });
});

describe('issuesForCell', () => {
  const issues: ValidationIssue[] = [
    {
      rule: 'keyPascalCase',
      severity: 'warning',
      message: 'Key naming',
      key: 'Confirm',
      familyId: 'f',
    },
    {
      rule: 'matchingSuffix',
      severity: 'warning',
      message: 'Ending mismatch',
      key: 'Confirm',
      locale: 'pt',
      familyId: 'f',
    },
    {
      rule: 'missingTranslation',
      severity: 'warning',
      message: 'Missing pt',
      key: 'Empty',
      locale: 'pt',
      familyId: 'f',
    },
  ];

  it('keeps key-level issues on the key column only', () => {
    expect(issuesForCell(issues).map((i) => i.rule)).toEqual(['keyPascalCase']);
  });

  it('keeps locale issues on that language column only', () => {
    expect(issuesForCell(issues, 'pt').map((i) => i.rule)).toEqual([
      'matchingSuffix',
      'missingTranslation',
    ]);
    expect(issuesForCell(issues, '')).toEqual([]);
  });
});

describe('tooltipLines', () => {
  it('includes rule label, severity and locale', () => {
    setLanguage('en');
    const lines = tooltipLines([
      {
        rule: 'matchingSuffix',
        severity: 'warning',
        message: 'Ending does not match',
        key: 'Confirm',
        locale: 'pt',
        familyId: 'f',
      },
    ]);
    expect(lines[0]?.label).toBe('Suffix');
    expect(lines[0]?.severity).toBe('warning');
    expect(lines[0]?.localeLabel).toBe('pt');
    expect(lines[0]?.message).toContain('Ending');
  });
});
