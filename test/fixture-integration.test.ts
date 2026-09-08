import { describe, expect, it } from 'vitest';
import * as path from 'path';
import {
  parseResxFile,
  parseI18nFile,
  groupResxFiles,
  filterFamiliesByFileMode,
  buildRows,
  validateFamily,
  resolveDesignerMeta,
  generateDesignerCs,
  buildDesignerEntries,
} from '@resx-guard/core-ts';

const fixtureRoot = path.resolve(__dirname, '../fixtures/sample-project');

const rules = {
  keyPascalCase: true,
  matchingSuffix: true,
  placeholders: true,
  missingTranslation: true,
  duplicateKeys: true,
};

describe('fixture sample-project', () => {
  it('loads Resources.resx family with pt satellite and validations', async () => {
    const neutral = path.join(fixtureRoot, 'Properties', 'Resources.resx');
    const pt = path.join(fixtureRoot, 'Properties', 'Resources.pt.resx');

    const { families } = groupResxFiles(
      [neutral, pt],
      [{ name: 'sample-project', uri: { fsPath: fixtureRoot } }]
    );
    expect(families).toHaveLength(1);

    const family = families[0];
    const files = [await parseResxFile(neutral), await parseResxFile(pt)];
    const rows = buildRows(family, files);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.key === 'WelcomeMessage')).toBe(true);

    const issues = validateFamily(family, files, rules);
    expect(Array.isArray(issues)).toBe(true);

    const meta = await resolveDesignerMeta(neutral);
    expect(meta.namespace).toBe('SampleProject.Properties');
    const cs = generateDesignerCs({
      ...meta,
      entries: buildDesignerEntries(files),
      locales: ['', 'pt'],
    });
    expect(cs).toContain('WelcomeMessage');
    expect(cs).toContain('Neutral: Welcome to ResX Guard');
    expect(cs).toContain('pt: Bem-vindo ao ResX Guard');
  });

  it('groups .resx and nested locale JSON families together', () => {
    const paths = [
      path.join(fixtureRoot, 'Properties', 'Resources.resx'),
      path.join(fixtureRoot, 'Properties', 'Resources.pt.resx'),
      path.join(fixtureRoot, 'Resources', 'Messages.resx'),
      path.join(fixtureRoot, 'Resources', 'Messages.pt.resx'),
      path.join(fixtureRoot, 'locales', 'en', 'translation.json'),
      path.join(fixtureRoot, 'locales', 'pt', 'translation.json'),
      path.join(fixtureRoot, 'locales', 'en', 'messages.json'),
      path.join(fixtureRoot, 'locales', 'pt', 'messages.json'),
    ];
    const { families } = groupResxFiles(paths, [
      { name: 'sample-project', uri: { fsPath: fixtureRoot } },
    ]);
    expect(families).toHaveLength(4);
    expect(filterFamiliesByFileMode(families, 'resx')).toHaveLength(2);
    expect(filterFamiliesByFileMode(families, 'json')).toHaveLength(2);
    expect(filterFamiliesByFileMode(families, 'all')).toHaveLength(4);
  });

  it('loads translation.json with flattened keys and JSON-specific validation', async () => {
    const en = path.join(fixtureRoot, 'locales', 'en', 'translation.json');
    const pt = path.join(fixtureRoot, 'locales', 'pt', 'translation.json');

    const { families } = groupResxFiles(
      [en, pt],
      [{ name: 'sample-project', uri: { fsPath: fixtureRoot } }]
    );
    expect(families).toHaveLength(1);

    const family = families[0];
    const files = [await parseI18nFile(en), await parseI18nFile(pt)];
    const rows = buildRows(family, files);
    expect(rows.some((r) => r.key === 'welcome.message')).toBe(true);
    expect(rows.some((r) => r.key === 'actions.openSettings')).toBe(true);
    expect(rows.some((r) => r.key === 'items.foundBad')).toBe(true);
    expect(rows.some((r) => r.key === 'untitled_key')).toBe(true);

    const issues = validateFamily(family, files, rules);
    expect(issues.some((i) => i.rule === 'keyPascalCase' && i.key === 'untitled_key')).toBe(true);
    expect(
      issues.find((i) => i.rule === 'keyPascalCase' && i.key === 'untitled_key')?.suggestedKey
    ).toBe('untitled');
    expect(issues.some((i) => i.rule === 'keyPascalCase' && i.key === 'welcome.message')).toBe(
      true
    );
    expect(
      issues.find((i) => i.rule === 'keyPascalCase' && i.key === 'welcome.message')?.suggestedKey
    ).toBe('welcome.welcomeToResXGuard');
    expect(issues.some((i) => i.rule === 'missingTranslation' && i.key === 'actions.openSettings')).toBe(
      true
    );
    expect(issues.some((i) => i.rule === 'placeholders' && i.key === 'items.foundBad')).toBe(true);
  });

  it('loads messages.json and flags missing loading in pt', async () => {
    const en = path.join(fixtureRoot, 'locales', 'en', 'messages.json');
    const pt = path.join(fixtureRoot, 'locales', 'pt', 'messages.json');

    const { families } = groupResxFiles(
      [en, pt],
      [{ name: 'sample-project', uri: { fsPath: fixtureRoot } }]
    );
    expect(families).toHaveLength(1);

    const family = families[0];
    const files = [await parseI18nFile(en), await parseI18nFile(pt)];
    const rows = buildRows(family, files);
    expect(rows.some((r) => r.key === 'actions.ok')).toBe(true);
    expect(rows.some((r) => r.key === 'errorOccurred')).toBe(true);
    expect(rows.some((r) => r.key === 'loading')).toBe(true);

    const issues = validateFamily(family, files, rules);
    expect(issues.some((i) => i.rule === 'missingTranslation' && i.key === 'loading')).toBe(true);
  });
});
