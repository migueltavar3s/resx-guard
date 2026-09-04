import { describe, expect, it } from 'vitest';
import type { ResourceRow } from '@resx-guard/core-ts';
import {
  applySnapshotSelection,
  resolveAddedKey,
  revealFocusLocale,
} from '../packages/ui/utils/revealRow';

const welcome: ResourceRow = {
  familyId: 'fam',
  key: 'Welcome',
  comment: '',
  values: { '': 'Welcome back', pt: '' },
  issues: [],
};

const added: ResourceRow = {
  familyId: 'fam',
  key: 'SaveFailed',
  comment: '',
  values: { '': '', pt: '' },
  issues: [],
};

describe('resolveAddedKey', () => {
  it('uses PascalCase from the neutral value when the key is empty', () => {
    expect(resolveAddedKey('', 'Save failed.', 'pascalFromNeutral')).toBe('SaveFailed');
  });

  it('falls back to NewKey when nothing can be derived', () => {
    expect(resolveAddedKey('', '', 'manual')).toBe('NewKey');
  });
});

describe('applySnapshotSelection', () => {
  it('selects the newly added row so the grid can scroll to it', () => {
    expect(
      applySnapshotSelection([welcome, added], welcome, { familyId: 'fam', key: 'SaveFailed' })
    ).toEqual(added);
  });

  it('keeps the previous selection when nothing was just added', () => {
    expect(applySnapshotSelection([welcome, added], welcome, null)?.key).toBe('Welcome');
  });
});

describe('revealFocusLocale', () => {
  it('focuses the first empty visible locale so the value can be typed immediately', () => {
    expect(revealFocusLocale(added, ['', 'pt'])).toBe('');
    expect(revealFocusLocale(welcome, ['', 'pt'])).toBe('pt');
  });
});
