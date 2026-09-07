import { describe, expect, it } from 'vitest';
import * as path from 'path';
import {
  attachIssuesToRows,
  buildRows,
  effectiveValidationRules,
  validateFamily,
} from '@resx-guard/core-ts';
import type { ResxFamily, ResxFile } from '@resx-guard/core-ts';
import { groupResxFiles } from '@resx-guard/core-ts';

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
    const naming = issues.find((i) => i.rule === 'keyPascalCase' && i.key === 'WrongKey');
    expect(naming?.severity).toBe('warning');
    expect(naming?.suggestedKey).toBe('SaveFailed');
    expect(issues.find((i) => i.rule === 'duplicateKeys')).toBeUndefined();
  });

  it('skips PascalCase naming issues when keys are typed manually', () => {
    const files: ResxFile[] = [
      {
        path: '/p/Resources.resx',
        locale: '',
        duplicateKeys: [],
        entries: [{ key: 'WrongKey', value: 'Save failed.', comment: '' }],
      },
    ];
    const issues = validateFamily(
      family(),
      files,
      effectiveValidationRules(rules, 'manual')
    );
    expect(issues.some((i) => i.rule === 'keyPascalCase')).toBe(false);
    expect(
      validateFamily(family(), files, effectiveValidationRules(rules, 'pascalFromNeutral')).some(
        (i) => i.rule === 'keyPascalCase'
      )
    ).toBe(true);
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
      suggestedKey: 'Hello',
    },
    ]);
    expect(withIssues[0].issues).toHaveLength(1);
  });
});

describe('workspace scanner', () => {
  const folders = [{ name: 'ws', uri: { fsPath: 'C:/ws' } }];

  it('groups neutral and satellite files', () => {
    const { families } = groupResxFiles(
      [
        'C:/ws/Properties/Resources.resx',
        'C:/ws/Properties/Resources.pt.resx',
        'C:/ws/Other/Messages.resx',
      ],
      folders
    );
    expect(families).toHaveLength(2);
    const resources = families.find((f) => f.displayName.includes('Resources'));
    expect(resources?.files['']).toBeTruthy();
    expect(resources?.files.pt).toBeTruthy();
  });

  it('keeps App.Web.resx as its own family and groups aspx + underscore cultures', () => {
    const { families } = groupResxFiles(
      [
        'C:/ws/App.Web.resx',
        'C:/ws/App.resx',
        'C:/ws/Views/Default.aspx.resx',
        'C:/ws/Views/Default.aspx.pt.resx',
        'C:/ws/Lang/Resources.pt_PT.resx',
        'C:/ws/Lang/Resources.resx',
        'C:/ws/Forms/Form.cs.resx',
      ],
      folders
    );
    const web = families.find((f) => f.displayName.endsWith('App.Web'));
    expect(web?.files['']).toBeTruthy();
    expect(web?.files.web).toBeUndefined();

    const aspx = families.find((f) => f.displayName.includes('Default.aspx'));
    expect(aspx?.files['']).toBeTruthy();
    expect(aspx?.files.pt).toBeTruthy();

    const lang = families.find((f) => f.displayName.includes('Lang/Resources'));
    expect(lang?.files['pt-PT']).toBeTruthy();

    const formCs = families.find((f) => f.displayName.includes('Form.cs'));
    expect(formCs?.files['']).toBeTruthy();
    expect(formCs?.files.cs).toBeUndefined();
  });

  it('groups culture-named files in the same folder and folder-based pt satellites', () => {
    const { families } = groupResxFiles(
      [
        'C:/ws/i18n/en.resx',
        'C:/ws/i18n/pt.resx',
        'C:/ws/Properties/Resources.resx',
        'C:/ws/Properties/pt/Resources.resx',
      ],
      folders
    );
    const i18n = families.find((f) => Object.keys(f.files).includes('pt') && Object.keys(f.files).includes('en'));
    expect(i18n?.files.pt).toContain('pt.resx');
    expect(i18n?.files.en).toContain('en.resx');

    const resources = families.find((f) => f.displayName.includes('Properties/Resources'));
    expect(resources?.files['']).toContain('Resources.resx');
    expect(resources?.files.pt).toMatch(/[/\\]pt[/\\]Resources\.resx$/);
  });
});

describe('missing translations for new locale files', () => {
  it('flags every key when a satellite file exists but is empty', () => {
    const fam = family();
    fam.files.fr = '/p/Resources.fr.resx';
    const files: ResxFile[] = [
      {
        path: '/p/Resources.resx',
        locale: '',
        duplicateKeys: [],
        entries: [
          { key: 'Hello', value: 'Hello', comment: '' },
          { key: 'Bye', value: 'Bye', comment: '' },
        ],
      },
      {
        path: '/p/Resources.pt.resx',
        locale: 'pt',
        duplicateKeys: [],
        entries: [
          { key: 'Hello', value: 'Olá', comment: '' },
          { key: 'Bye', value: 'Adeus', comment: '' },
        ],
      },
      {
        path: '/p/Resources.fr.resx',
        locale: 'fr',
        duplicateKeys: [],
        entries: [],
      },
    ];
    const issues = validateFamily(fam, files, rules).filter((i) => i.rule === 'missingTranslation');
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.locale === 'fr')).toBe(true);
  });

  it('stops flagging a locale after its file is removed from the family', () => {
    const fam = family();
    const files: ResxFile[] = [
      {
        path: '/p/Resources.resx',
        locale: '',
        duplicateKeys: [],
        entries: [{ key: 'Hello', value: 'Hello', comment: '' }],
      },
    ];
    const issues = validateFamily(fam, files, rules).filter((i) => i.rule === 'missingTranslation');
    expect(issues.some((i) => i.locale === 'pt')).toBe(true);

    const withoutPt = { ...fam, files: { '': fam.files[''] } };
    const afterDelete = validateFamily(withoutPt, files, rules).filter(
      (i) => i.rule === 'missingTranslation'
    );
    expect(afterDelete.some((i) => i.locale === 'pt')).toBe(false);
  });
});
