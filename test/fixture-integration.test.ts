import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { parseResxFile } from '../src/services/resx-parser';
import { groupResxFiles } from '../src/services/workspace-scanner';
import { buildRows, validateFamily } from '../src/services/validation-engine';
import { resolveDesignerMeta, generateDesignerCs, buildDesignerEntries } from '../src/services/designer-generator';

const fixtureRoot = path.resolve(__dirname, '../fixtures/sample-project');

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

    const issues = validateFamily(family, files, {
      keyPascalCase: true,
      matchingSuffix: true,
      placeholders: true,
      missingTranslation: true,
      duplicateKeys: true,
    });
    expect(Array.isArray(issues)).toBe(true);

    const meta = await resolveDesignerMeta(neutral);
    expect(meta.namespace).toBe('SampleProject');
    const cs = generateDesignerCs({
      ...meta,
      entries: buildDesignerEntries(files),
      locales: ['', 'pt'],
    });
    expect(cs).toContain('WelcomeMessage');
    expect(cs).toContain('Neutral: Welcome to ResX Guard');
    expect(cs).toContain('pt: Bem-vindo ao ResX Guard');
  });
});
