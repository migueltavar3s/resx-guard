import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { IssueChip } from '../packages/ui/components/IssueChip';
import { setLanguage } from '../packages/ui/i18n';

afterEach(cleanup);

const namingIssue = {
  rule: 'keyPascalCase' as const,
  severity: 'warning' as const,
  message: 'Key should be PascalCase of neutral value: expected "SaveFailed"',
  key: 'WrongKey',
  familyId: 'fam',
  suggestedKey: 'SaveFailed',
};

describe('IssueChip suggestion action', () => {
  it('is a clickable chip with the suggested key, not a separate Apply button', () => {
    setLanguage('en');
    const onClick = vi.fn();
    const { getByRole, queryByRole, getByText } = render(
      <IssueChip
        rule="keyPascalCase"
        issues={[namingIssue]}
        count={1}
        action={{
          label: 'SaveFailed',
          title: 'Rename to SaveFailed',
          onClick,
        }}
      />
    );

    expect(getByText('Naming')).toBeTruthy();
    expect(getByText('SaveFailed')).toBeTruthy();
    expect(queryByRole('button', { name: 'Apply' })).toBeNull();
    fireEvent.click(getByRole('button', { name: 'Rename to SaveFailed' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('stays a non-button chip when there is no action', () => {
    setLanguage('en');
    const { queryByRole, getByText } = render(
      <IssueChip rule="keyPascalCase" issues={[namingIssue]} count={1} />
    );
    expect(getByText('Naming')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });
});
