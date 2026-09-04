import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { IssueChip } from '../packages/ui/components/IssueChip';
import { IssueIndicators } from '../packages/ui/components/ResourceGrid';
import { SettingsPage } from '../packages/ui/components/SettingsPage';
import { defaultSettings } from '../packages/core-ts/src/services/validation-engine';
import { setLanguage } from '../packages/ui/i18n';
import type { ResourceRow } from '@resx-guard/core-ts';

afterEach(cleanup);

const namingIssue = {
  rule: 'keyPascalCase' as const,
  severity: 'warning' as const,
  message: 'Key should be PascalCase of neutral value: expected "SaveFailed"',
  key: 'WrongKey',
  familyId: 'fam',
  suggestedKey: 'SaveFailed',
};

const namingRow: ResourceRow = {
  familyId: 'fam',
  key: 'WrongKey',
  comment: '',
  values: { '': 'Save failed.' },
  issues: [namingIssue],
};

describe('IssueChip', () => {
  it('is a non-button chip with a hover tooltip', () => {
    setLanguage('en');
    const { queryByRole, getByText } = render(
      <IssueChip rule="keyPascalCase" issues={[namingIssue]} count={1} />
    );
    expect(getByText('Naming')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });
});

describe('IssueIndicators apply action', () => {
  it('shows Apply next to Naming when suggestions are on', () => {
    setLanguage('en');
    const onApply = vi.fn();
    const { getByRole, getByText, queryByText } = render(
      <IssueIndicators row={namingRow} namingSuggestions onApplyNaming={onApply} />
    );

    expect(getByText('Naming')).toBeTruthy();
    expect(queryByText('SaveFailed')).toBeNull();
    const apply = getByRole('button', { name: 'Apply' });
    expect(apply.getAttribute('title')).toBe('Rename to SaveFailed');
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledWith('SaveFailed');
  });

  it('hides Apply when suggestions are off, but keeps the Naming chip', () => {
    setLanguage('en');
    const { getByText, queryByRole } = render(
      <IssueIndicators row={namingRow} namingSuggestions={false} onApplyNaming={() => undefined} />
    );
    expect(getByText('Naming')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });
});

describe('SettingsPage naming suggestions', () => {
  it('puts the suggestions toggle in the Key naming card', () => {
    setLanguage('en');
    const { getByText } = render(
      <SettingsPage settings={defaultSettings()} onChange={() => undefined} />
    );
    const card = getByText('Key naming').closest('.setting-card');
    expect(card).toBeTruthy();
    expect(within(card as HTMLElement).getByText('Show naming suggestions')).toBeTruthy();
    expect(within(card as HTMLElement).getByText('PascalCase from English')).toBeTruthy();
  });
});
