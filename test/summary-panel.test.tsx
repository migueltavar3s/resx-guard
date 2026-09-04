import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ResourceRow } from '@resx-guard/core-ts';
import { SummaryPanel } from '../packages/ui/components/SummaryPanel';
import { setLanguage } from '../packages/ui/i18n';

afterEach(cleanup);

const longToken = `Ohewefwehfjwehflwehfwehfwehfwefhwkefhwefwefwefwefwet${'x'.repeat(80)}`;

const row: ResourceRow = {
  familyId: 'fam',
  key: longToken,
  comment: '',
  values: { '': longToken, pt: 'pt' },
  issues: [
    {
      rule: 'keyPascalCase',
      severity: 'warning',
      message: `Key should be PascalCase of neutral value: expected "${longToken}"`,
      key: longToken,
      familyId: 'fam',
      suggestedKey: longToken,
    },
  ],
};

describe('SummaryPanel issue overflow markup', () => {
  it('renders issue messages as block divs so long PascalCase tokens can wrap', () => {
    const { container } = render(<SummaryPanel row={row} locales={['', 'pt']} />);
    const message = container.querySelector('.issue-item-message');
    const key = container.querySelector('.summary-key');

    expect(message?.tagName).toBe('DIV');
    expect(message?.textContent).toContain(longToken);
    expect(key?.tagName).toBe('DIV');
    expect(key?.textContent).toBe(longToken);
  });
});

describe('SummaryPanel naming apply', () => {
  it('does not put a rename action in the Summary', () => {
    setLanguage('en');
    const namingRow: ResourceRow = {
      familyId: 'fam',
      key: 'WrongKey',
      comment: '',
      values: { '': 'Save failed.' },
      issues: [
        {
          rule: 'keyPascalCase',
          severity: 'warning',
          message: 'Key should be PascalCase of neutral value: expected "SaveFailed"',
          key: 'WrongKey',
          familyId: 'fam',
          suggestedKey: 'SaveFailed',
        },
      ],
    };

    const { queryByRole, container } = render(
      <SummaryPanel row={namingRow} locales={['']} />
    );

    expect(container.querySelector('.issue-item-severity')?.textContent).toBe('Warning');
    expect(queryByRole('button', { name: /Rename to/ })).toBeNull();
  });

  it('explains warning vs issue in the Summary', () => {
    setLanguage('en');
    const clean: ResourceRow = {
      familyId: 'fam',
      key: 'Hello',
      comment: '',
      values: { '': 'Hello' },
      issues: [],
    };
    const { getByText } = render(<SummaryPanel row={clean} locales={['']} />);
    expect(getByText(/An issue is any validation finding/)).toBeTruthy();
  });
});
