import { describe, expect, it } from 'vitest';
import {
  UsageIndex,
  countKeyUsages,
  createUsageExtractor,
  isUsageSourcePath,
  wordBoundaryPattern,
} from '@resx-guard/core-ts';

describe('usage matcher (wordBoundary)', () => {
  const extractor = createUsageExtractor('wordBoundary');

  it('matches C#, cshtml, JS and quoted keys', () => {
    const cs = 'var text = Resources.SaveFailed;';
    const cshtml = '@Localizer["SaveFailed"]';
    const js = "t('SaveFailed') + messages.SaveFailed";
    expect(countKeyUsages(cs, 'SaveFailed')).toBe(1);
    expect(countKeyUsages(cshtml, 'SaveFailed')).toBe(1);
    expect(countKeyUsages(js, 'SaveFailed')).toBe(2);
  });

  it('does not count longer identifiers as the shorter key (Save vs SaveFailed)', () => {
    expect(countKeyUsages('Resources.SaveFailed()', 'Save')).toBe(0);
    expect(countKeyUsages('GetString("SaveFailed")', 'Save')).toBe(0);
  });

  it('documents false positives of word-boundary matching', () => {
    const noisy = `
      public class Name { }
      var Name = 1;
      Console.WriteLine(Name);
    `;
    const hits = countKeyUsages(noisy, 'Name');
    expect(hits).toBeGreaterThan(1);
    expect(wordBoundaryPattern('Name')).toBe('\\bName\\b');
  });

  it('extracts identifier bags so the index can re-aggregate without a rescan', () => {
    const counts = extractor.extractCounts('Resources.SaveFailed; Localizer["SaveFailed"]; class Name {}');
    expect(counts.get('SaveFailed')).toBe(2);
    expect(counts.get('Name')).toBe(1);
    expect(counts.get('Resources')).toBe(1);
  });
});

describe('UsageIndex', () => {
  it('updates a single file without recounting the others', () => {
    const index = new UsageIndex();
    index.indexFile('/proj/Views/Home.cshtml', '@Localizer["Welcome"] @Localizer["Welcome"]');
    index.indexFile('/proj/wwwroot/app.js', "t('Welcome'); t('Bye')");
    expect(index.count('Welcome')).toBe(3);
    expect(index.count('Bye')).toBe(1);

    index.indexFile('/proj/wwwroot/app.js', "t('Bye')");
    expect(index.count('Welcome')).toBe(2);
    expect(index.count('Bye')).toBe(1);

    index.removeFile('/proj/Views/Home.cshtml');
    expect(index.count('Welcome')).toBe(0);
    expect(index.count('Bye')).toBe(1);
  });

  it('ignores .resx and Designer.cs so generated files are not usages', () => {
    const index = new UsageIndex();
    index.indexFile('/proj/Resources.resx', '<data name="Welcome">');
    index.indexFile('/proj/Resources.Designer.cs', 'public static string Welcome');
    expect(index.indexedFileCount).toBe(0);
    expect(index.count('Welcome')).toBe(0);
    expect(isUsageSourcePath('/proj/Home.cshtml')).toBe(true);
    expect(isUsageSourcePath('/proj/Resources.Designer.cs')).toBe(false);
  });
});
