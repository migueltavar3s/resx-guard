import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { ResourceRow } from '../src/models/types';
import { SummaryPanel } from '../webview/components/SummaryPanel';

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
