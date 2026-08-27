import { describe, expect, it } from 'vitest';
import {
  attachIssuesToRows,
  buildRows,
  validateFamily,
} from '../src/services/validation-engine';
import type { ResxFamily, ResxFile } from '../src/models/types';
import { groupResxFiles } from '../src/services/workspace-scanner';

const rules = {
  keyPascalCase: true,
  matchingSuffix: true,
  placeholders: true,
  missingTranslation: true,
  duplicateKeys: true,
};

function family(): ResxFamily {
  return {
    id: 'f1',
    basePath: '/p/Resources.resx',
    displayName: 'Properties/Resources',
    projectName: 'Sample',
    files: {
      '': '/p/Resources.resx',
      pt: '/p/Resources.pt.resx',
    },
  };
}

describe('validation engine', () => {
  it('flags mismatched endings, placeholders, missing, and PascalCase', () => {
    const files: ResxFile[] = [
      {
        path: '/p/Resources.resx',
        locale: '',
        duplicateKeys: [],
        entries: [
          { key: 'WrongKey', value: 'Save failed.', comment: '' },
          { key: 'OkKey', value: 'Hello {0}', comment: '' },
          { key: 'MissingPt', value: 'Only English', comment: '' },
        ],
      },
      {
        path: '/p/Resources.pt.resx',
        locale: 'pt',
        duplicateKeys: [],
        entries: [
          { key: 'WrongKey', value: 'Falha ao guardar', comment: '' },
          { key: 'OkKey', value: 'Olá {1}', comment: '' },
        ],
      },
    ];

    const issues = validateFamily(family(), files, rules);
    const rulesHit = new Set(issues.map((i) => i.rule));
    expect(rulesHit.has('matchingSuffix')).toBe(true);
    expect(rulesHit.has('placeholders')).toBe(true);
    expect(rulesHit.has('missingTranslation')).toBe(true);
    expect(rulesHit.has('keyPascalCase')).toBe(true);
  });

  it('builds rows and attaches issues', () => {
    const files: ResxFile[] = [
      {
        path: '/p/Resources.resx',
        locale: '',
        duplicateKeys: [],
        entries: [{ key: 'Hello', value: 'Hello', comment: 'c' }],
      },
      {
        path: '/p/Resources.pt.resx',
        locale: 'pt',
        duplicateKeys: [],
        entries: [{ key: 'Hello', value: 'Olá', comment: '' }],
      },
    ];
    const rows = buildRows(family(), files);
    expect(rows).toHaveLength(1);
    expect(rows[0].values['']).toBe('Hello');
    expect(rows[0].values.pt).toBe('Olá');

    const withIssues = attachIssuesToRows(rows, [
      {
        rule: 'keyPascalCase',
        severity: 'warning',
        message: 'x',
        key: 'Hello',
        familyId: 'f1',
      },
    ]);
    expect(withIssues[0].issues).toHaveLength(1);
  });
});

describe('workspace scanner', () => {
  it('groups neutral and satellite files', () => {
    const { families } = groupResxFiles(
      [
        'C:/ws/Properties/Resources.resx',
        'C:/ws/Properties/Resources.pt.resx',
        'C:/ws/Other/Messages.resx',
      ],
      [{ name: 'ws', uri: { fsPath: 'C:/ws' } }]
    );
    expect(families).toHaveLength(2);
    const resources = families.find((f) => f.displayName.includes('Resources'));
    expect(resources?.files['']).toBeTruthy();
    expect(resources?.files.pt).toBeTruthy();
  });
});
