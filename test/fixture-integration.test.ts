import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { parseResxFile } from '../src/services/resx-parser';
import { groupResxFiles } from '../src/services/workspace-scanner';
import { buildRows, validateFamily } from '../src/services/validation-engine';
import { resolveDesignerMeta, generateDesignerCs } from '../src/services/designer-generator';

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
    expect(rows.length).toBeGreaterThanOrEqual(4);

    const issues = validateFamily(family, files, {
      keyPascalCase: true,
      matchingSuffix: true,
      placeholders: true,
      missingTranslation: true,
      duplicateKeys: true,
    });

    // SaveFailed PT missing trailing period → matchingSuffix
    expect(issues.some((i) => i.rule === 'matchingSuffix' && i.key === 'SaveFailed')).toBe(
      true
    );

    const meta = await resolveDesignerMeta(neutral);
    expect(meta.namespace).toBe('SampleProject');
    const cs = generateDesignerCs({
      ...meta,
      entries: files[0].entries,
    });
    expect(cs).toContain('SaveFailed');
  });
});
