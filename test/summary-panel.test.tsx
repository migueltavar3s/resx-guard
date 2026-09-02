import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
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
  it('renames to the suggested key from a naming warning', () => {
    setLanguage('en');
    const onApply = vi.fn();
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

    const { getByRole, container } = render(
      <SummaryPanel row={namingRow} locales={['']} onApplyNamingSuggestion={onApply} />
    );

    expect(container.querySelector('.issue-item-severity')?.textContent).toBe('Warning');
    fireEvent.click(getByRole('button', { name: 'Rename to SaveFailed' }));
    expect(onApply).toHaveBeenCalledWith('fam', 'WrongKey', 'SaveFailed');
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
