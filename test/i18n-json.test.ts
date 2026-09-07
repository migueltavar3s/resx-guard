import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  addI18nEntry,
  deleteI18nEntry,
  filterFamiliesByFileMode,
  flattenI18nObject,
  groupResxFiles,
  isI18nResourcePath,
  parseI18nFile,
  renameI18nKey,
  resolveResxIdentity,
  setI18nValue,
  validateFamily,
} from '@resx-guard/core-ts';
import type { ResxFamily, ResxFile } from '@resx-guard/core-ts';

const fixtureRoot = path.resolve(__dirname, '../fixtures/i18n-web');

const rules = {
  keyPascalCase: true,
  matchingSuffix: true,
  placeholders: true,
  missingTranslation: true,
  duplicateKeys: true,
};

describe('flattenI18nObject', () => {
  it('flattens nested objects to dot-notation keys', () => {
    const { entries, duplicateKeys } = flattenI18nObject({
      navigation: { dashboard: 'Dashboard', settings: 'Settings' },
      hello: 'Hello {0}',
    });
    const byKey = Object.fromEntries(entries.map((e) => [e.key, e.value]));
    expect(byKey).toEqual({
      'navigation.dashboard': 'Dashboard',
      'navigation.settings': 'Settings',
      hello: 'Hello {0}',
    });
    expect(duplicateKeys).toEqual([]);
  });

  it('stringifies arrays and flags dotted-key collisions', () => {
    const { entries, duplicateKeys } = flattenI18nObject({
      'a.b': 'leaf',
      a: { b: 'nested' },
      list: ['x', 'y'],
    });
    expect(entries.filter((e) => e.key === 'a.b')).toHaveLength(2);
    expect(duplicateKeys).toContain('a.b');
    expect(entries.find((e) => e.key === 'list')?.value).toBe('["x","y"]');
  });

  it('treats a non-object root as empty', () => {
    expect(flattenI18nObject(['nope']).entries).toEqual([]);
    expect(flattenI18nObject(null).entries).toEqual([]);
  });
});

describe('i18n path detection', () => {
  it('accepts locale-folder translation files', () => {
    expect(isI18nResourcePath('C:/ws/locales/en/translation.json')).toBe(true);
    expect(isI18nResourcePath('C:/ws/locales/pt-PT/messages.i18n')).toBe(true);
    expect(resolveResxIdentity('C:/ws/locales/en/translation.json')).toMatchObject({
      locale: 'en',
      baseName: 'translation',
      familyDir: 'C:/ws/locales',
    });
  });

  it('ignores config JSON and TypeScript source folders', () => {
    expect(isI18nResourcePath('C:/ws/package.json')).toBe(false);
    expect(isI18nResourcePath('C:/ws/tsconfig.json')).toBe(false);
    expect(isI18nResourcePath('C:/ws/src/ts/config.json')).toBe(false);
    expect(isI18nResourcePath('C:/ws/locales/en/package.json')).toBe(false);
  });

  it('accepts Czech locale files under a typical i18n directory', () => {
    expect(isI18nResourcePath('C:/ws/locales/cs/translation.json')).toBe(true);
  });
});

describe('i18n parse and write', () => {
  it('round-trips set, add, rename, and delete while preserving siblings', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resx-guard-i18n-'));
    const filePath = path.join(dir, 'en', 'translation.json');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      JSON.stringify({ navigation: { dashboard: 'Dashboard', settings: 'Settings' } }, null, 2),
      'utf8'
    );

    await setI18nValue(filePath, 'navigation.dashboard', 'Home');
    await addI18nEntry(filePath, 'navigation.logout', 'Log out');
    let parsed = await parseI18nFile(filePath);
    expect(parsed.locale).toBe('en');
    expect(parsed.entries.find((e) => e.key === 'navigation.dashboard')?.value).toBe('Home');
    expect(parsed.entries.find((e) => e.key === 'navigation.settings')?.value).toBe('Settings');
    expect(parsed.entries.find((e) => e.key === 'navigation.logout')?.value).toBe('Log out');

    await renameI18nKey(filePath, 'navigation.logout', 'account.logout');
    parsed = await parseI18nFile(filePath);
    expect(parsed.entries.find((e) => e.key === 'navigation.logout')).toBeUndefined();
    expect(parsed.entries.find((e) => e.key === 'account.logout')?.value).toBe('Log out');

    await deleteI18nEntry(filePath, 'account.logout');
    const saved = JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>;
    expect(saved.account).toBeUndefined();
    expect((saved.navigation as Record<string, string>).settings).toBe('Settings');
  });

  it('creates missing files and strips a UTF-8 BOM', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resx-guard-i18n-missing-'));
    const filePath = path.join(dir, 'pt', 'translation.json');
    await addI18nEntry(filePath, 'hello', 'Olá');
    const parsed = await parseI18nFile(filePath);
    expect(parsed.entries).toEqual([{ key: 'hello', value: 'Olá', comment: '' }]);

    const bomPath = path.join(dir, 'en', 'translation.json');
    await fs.mkdir(path.dirname(bomPath), { recursive: true });
    await fs.writeFile(bomPath, '\uFEFF{"hi":"Hello"}', 'utf8');
    const bomParsed = await parseI18nFile(bomPath);
    expect(bomParsed.entries[0]).toMatchObject({ key: 'hi', value: 'Hello' });
  });

  it('throws on invalid JSON', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resx-guard-i18n-bad-'));
    const filePath = path.join(dir, 'en', 'translation.json');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '{not json', 'utf8');
    await expect(parseI18nFile(filePath)).rejects.toThrow(/Invalid JSON/);
  });
});

describe('i18n workspace grouping', () => {
  it('groups locale JSON and ignores decoy config files', () => {
    const { families } = groupResxFiles(
      [
        path.join(fixtureRoot, 'package.json'),
        path.join(fixtureRoot, 'tsconfig.json'),
        path.join(fixtureRoot, 'src', 'ts', 'config.json'),
        path.join(fixtureRoot, 'locales', 'en', 'translation.json'),
        path.join(fixtureRoot, 'locales', 'pt', 'translation.json'),
      ],
      [{ name: 'i18n-web', uri: { fsPath: fixtureRoot } }]
    );
    expect(families).toHaveLength(1);
    expect(families[0].files.en).toMatch(/translation\.json$/);
    expect(families[0].files.pt).toMatch(/translation\.json$/);
    expect(families[0].files['']).toBeUndefined();
  });

  it('keeps .resx families unchanged when JSON decoys are mixed in', () => {
    const folders = [{ name: 'ws', uri: { fsPath: 'C:/ws' } }];
    const { families } = groupResxFiles(
      [
        'C:/ws/Properties/Resources.resx',
        'C:/ws/Properties/Resources.pt.resx',
        'C:/ws/package.json',
        'C:/ws/locales/en/translation.json',
        'C:/ws/locales/pt/translation.json',
      ],
      folders
    );
    expect(families).toHaveLength(2);
    const resources = families.find((f) => f.displayName.includes('Resources'));
    expect(resources?.files['']).toBeTruthy();
    expect(resources?.files.pt).toBeTruthy();
    const json = families.find((f) => Object.keys(f.files).includes('en'));
    expect(json?.files.en).toContain('translation.json');
    expect(json?.files.pt).toContain('translation.json');
  });

  it('filters families by file mode without dropping .resx', () => {
    const folders = [{ name: 'ws', uri: { fsPath: 'C:/ws' } }];
    const { families } = groupResxFiles(
      [
        'C:/ws/Properties/Resources.resx',
        'C:/ws/locales/en/translation.json',
      ],
      folders
    );
    expect(filterFamiliesByFileMode(families, 'all')).toHaveLength(2);
    expect(filterFamiliesByFileMode(families, 'resx')).toHaveLength(1);
    expect(filterFamiliesByFileMode(families, 'resx')[0].files['']).toContain('Resources.resx');
    expect(filterFamiliesByFileMode(families, 'json')).toHaveLength(1);
    expect(filterFamiliesByFileMode(families, 'json')[0].files.en).toContain('translation.json');
  });
});

describe('i18n validation', () => {
  function jsonFamily(): ResxFamily {
    return {
      id: 'json1',
      basePath: '/app/locales/en/translation.json',
      displayName: 'locales/translation',
      projectName: 'web',
      files: {
        en: '/app/locales/en/translation.json',
        pt: '/app/locales/pt/translation.json',
      },
    };
  }

  it('skips PascalCase naming but still flags placeholder mismatches', () => {
    const files: ResxFile[] = [
      {
        path: '/app/locales/en/translation.json',
        locale: 'en',
        duplicateKeys: [],
        entries: [{ key: 'navigation.dashboard', value: 'Hello {0}', comment: '' }],
      },
      {
        path: '/app/locales/pt/translation.json',
        locale: 'pt',
        duplicateKeys: [],
        entries: [{ key: 'navigation.dashboard', value: 'Olá {1}', comment: '' }],
      },
    ];
    const issues = validateFamily(jsonFamily(), files, rules);
    expect(issues.some((i) => i.rule === 'keyPascalCase')).toBe(false);
    expect(issues.some((i) => i.rule === 'placeholders')).toBe(true);
  });

  it('still flags PascalCase on .resx families', () => {
    const family: ResxFamily = {
      id: 'resx1',
      basePath: '/p/Resources.resx',
      displayName: 'Properties/Resources',
      projectName: 'Sample',
      files: { '': '/p/Resources.resx' },
    };
    const files: ResxFile[] = [
      {
        path: '/p/Resources.resx',
        locale: '',
        duplicateKeys: [],
        entries: [{ key: 'WrongKey', value: 'Save failed.', comment: '' }],
      },
    ];
    expect(validateFamily(family, files, rules).some((i) => i.rule === 'keyPascalCase')).toBe(true);
  });
});

describe('i18n fixture', () => {
  it('parses the sample nested translation files', async () => {
    const en = path.join(fixtureRoot, 'locales', 'en', 'translation.json');
    const pt = path.join(fixtureRoot, 'locales', 'pt', 'translation.json');
    const parsedEn = await parseI18nFile(en);
    const parsedPt = await parseI18nFile(pt);
    expect(parsedEn.entries.map((e) => e.key).sort()).toEqual([
      'hello',
      'navigation.dashboard',
      'navigation.settings',
    ]);
    expect(parsedPt.entries.find((e) => e.key === 'navigation.dashboard')?.value).toBe('Painel');
  });
});
