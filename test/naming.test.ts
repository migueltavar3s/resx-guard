import { describe, expect, it } from 'vitest';
import {
  endingsMatch,
  extractEndingSuffix,
  extractPlaceholders,
  getBaseName,
  normalizePathKey,
  parseLocaleFromFileName,
  placeholdersMatch,
  resolveResxIdentity,
  toPascalCaseKey,
} from '@resx-guard/core-ts';

describe('toPascalCaseKey', () => {
  it('converts English phrases to PascalCase', () => {
    expect(toPascalCaseKey('Invalid resource file:')).toBe('InvalidResourceFile');
    expect(toPascalCaseKey('Save failed.')).toBe('SaveFailed');
    expect(toPascalCaseKey("Duplicate keys in '{0}': {1}")).toBe('DuplicateKeysIn01');
  });

  it('handles empty and digit-leading', () => {
    expect(toPascalCaseKey('')).toBe('');
    expect(toPascalCaseKey('!!!')).toBe('');
    expect(toPascalCaseKey('123 abc')).toBe('N123Abc');
  });
});

describe('suffix matching', () => {
  it('extracts punctuation and whitespace endings', () => {
    expect(extractEndingSuffix('Save failed.')).toBe('.');
    expect(extractEndingSuffix('Hello:')).toBe(':');
    expect(extractEndingSuffix('Done! ')).toBe('! ');
    expect(extractEndingSuffix('No punctuation')).toBe('');
  });

  it('compares endings like ResX Manager', () => {
    expect(endingsMatch('Save failed.', 'Falha ao guardar.')).toBe(true);
    expect(endingsMatch('Save failed.', 'Falha ao guardar')).toBe(false);
    expect(endingsMatch('Invalid resource file:', 'Ficheiro inválido:')).toBe(true);
  });
});

describe('placeholders', () => {
  it('extracts and compares placeholders', () => {
    expect(extractPlaceholders("Hello {0} and {name}")).toEqual(['{0}', '{name}']);
    expect(placeholdersMatch("A {0} B {1}", "X {0} Y {1}")).toBe(true);
    expect(placeholdersMatch("A {0}", "X {1}")).toBe(false);
    expect(placeholdersMatch("A {0}", "no placeholders")).toBe(false);
  });
});

describe('locale from file name', () => {
  it('parses cultures', () => {
    expect(parseLocaleFromFileName('Resources.resx')).toBe('');
    expect(parseLocaleFromFileName('Resources.pt.resx')).toBe('pt');
    expect(parseLocaleFromFileName('Resources.pt-PT.resx')).toBe('pt-PT');
    expect(parseLocaleFromFileName('Resources.en-US.resx')).toBe('en-US');
    expect(getBaseName('Resources.pt.resx')).toBe('Resources');
    expect(getBaseName('Resources.resx')).toBe('Resources');
  });

  it('canonicalizes case, underscores, and dotted resource names', () => {
    expect(parseLocaleFromFileName('Resources.PT.resx')).toBe('pt');
    expect(parseLocaleFromFileName('Resources.pt_PT.resx')).toBe('pt-PT');
    expect(parseLocaleFromFileName('Default.aspx.pt.resx')).toBe('pt');
    expect(getBaseName('Default.aspx.pt.resx')).toBe('Default.aspx');
    expect(parseLocaleFromFileName('pt.resx')).toBe('pt');
  });

  it('does not treat project/module suffixes as cultures', () => {
    expect(parseLocaleFromFileName('App.Web.resx')).toBe('');
    expect(getBaseName('App.Web.resx')).toBe('App.Web');
    expect(parseLocaleFromFileName('MyApp.UI.resx')).toBe('');
    expect(parseLocaleFromFileName('Form.cs.resx')).toBe('');
  });

  it('groups folder-based cultures only when the invariant sibling exists', () => {
    const files = new Set([
      normalizePathKey('C:/ws/Properties/Resources.resx'),
      normalizePathKey('C:/ws/Properties/pt/Resources.resx'),
    ]);
    expect(resolveResxIdentity('C:/ws/Properties/pt/Resources.resx', files)).toMatchObject({
      locale: 'pt',
      baseName: 'Resources',
      familyDir: 'C:/ws/Properties',
    });
    expect(resolveResxIdentity('C:/ws/src/cs/Resources.resx', files)).toMatchObject({
      locale: '',
      baseName: 'Resources',
    });
    const czech = new Set([
      normalizePathKey('C:/ws/Properties/Resources.resx'),
      normalizePathKey('C:/ws/Properties/Resources.cs.resx'),
    ]);
    expect(resolveResxIdentity('C:/ws/Properties/Resources.cs.resx', czech).locale).toBe('cs');
  });
});
