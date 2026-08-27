import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  createEmptyResxXml,
  parseResxXml,
  setResxValue,
  deleteResxEntry,
  addResxEntry,
  renameResxKey,
} from '../src/services/resx-parser';

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<root>
  <resheader name="resmimetype">
    <value>text/microsoft-resx</value>
  </resheader>
  <data name="Hello" xml:space="preserve">
    <value>Hello world</value>
    <comment>greeting</comment>
  </data>
  <data name="Bye" xml:space="preserve">
    <value>Goodbye</value>
  </data>
</root>`;

describe('resx parser', () => {
  it('parses entries and locale', () => {
    const file = parseResxXml(SAMPLE, 'C:/proj/Resources.pt.resx');
    expect(file.locale).toBe('pt');
    expect(file.entries).toHaveLength(2);
    expect(file.entries[0]).toMatchObject({
      key: 'Hello',
      value: 'Hello world',
      comment: 'greeting',
    });
  });

  it('detects duplicate keys', () => {
    const xml = SAMPLE.replace(
      '</root>',
      `  <data name="Hello" xml:space="preserve"><value>dup</value></data>\n</root>`
    );
    const file = parseResxXml(xml, 'Resources.resx');
    expect(file.duplicateKeys).toContain('Hello');
  });

  it('round-trips set/add/rename/delete', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resx-guard-'));
    const filePath = path.join(dir, 'Resources.resx');
    await fs.writeFile(filePath, createEmptyResxXml(), 'utf8');

    await addResxEntry(filePath, 'Alpha', 'A');
    await setResxValue(filePath, 'Alpha', 'A!');
    await renameResxKey(filePath, 'Alpha', 'Beta');
    let parsed = parseResxXml(await fs.readFile(filePath, 'utf8'), filePath);
    expect(parsed.entries.map((e) => e.key)).toEqual(['Beta']);
    expect(parsed.entries[0].value).toBe('A!');

    await deleteResxEntry(filePath, 'Beta');
    parsed = parseResxXml(await fs.readFile(filePath, 'utf8'), filePath);
    expect(parsed.entries).toHaveLength(0);
  });
});
