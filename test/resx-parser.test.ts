import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
  createEmptyResxXml,
  detectAndDecodeResx,
  parseResxFile,
  parseResxXml,
  setResxValue,
  deleteResxEntry,
  addResxEntry,
  renameResxKey,
} from '@resx-guard/core-ts';

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

  it('decodes Visual Studio UTF-16 LE .resx files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resx-guard-utf16-'));
    const filePath = path.join(dir, 'Resources.pt.resx');
    const xml = SAMPLE.replace('Hello world', 'Olá');
    const bom = Buffer.from([0xff, 0xfe]);
    await fs.writeFile(filePath, Buffer.concat([bom, Buffer.from(xml, 'utf16le')]));

    const decoded = detectAndDecodeResx(await fs.readFile(filePath));
    expect(decoded.encoding).toBe('utf16le');
    expect(decoded.text).toContain('Olá');

    const parsed = await parseResxFile(filePath);
    expect(parsed.locale).toBe('pt');
    expect(parsed.entries[0]?.value).toBe('Olá');

    await setResxValue(filePath, 'Hello', 'Olá mundo');
    const again = await parseResxFile(filePath);
    expect(again.entries.find((e) => e.key === 'Hello')?.value).toBe('Olá mundo');
  });

  it('reads Visual Studio schema files and System.String typed entries, skipping binaries', () => {
    const xml = vsStyleResx({
      Hello: { value: 'Hello world', type: 'System.String, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089' },
      Bye: { value: 'Goodbye' },
      Logo: {
        value: 'logo.png;System.Drawing.Bitmap, System.Drawing',
        type: 'System.Resources.ResXFileRef, System.Windows.Forms',
      },
    });
    const file = parseResxXml(xml, 'Resources.pt.resx');
    expect(file.locale).toBe('pt');
    expect(file.entries.map((e) => e.key).sort()).toEqual(['Bye', 'Hello']);
    expect(file.entries.find((e) => e.key === 'Hello')?.value).toBe('Hello world');
  });

  it('keeps the Visual Studio schema when editing a value', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'resx-guard-schema-'));
    const filePath = path.join(dir, 'Resources.resx');
    await fs.writeFile(
      filePath,
      vsStyleResx({
        Hello: {
          value: 'Hi',
          type: 'System.String, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089',
        },
      }),
      'utf8'
    );
    await setResxValue(filePath, 'Hello', 'Hello edited');
    const saved = await fs.readFile(filePath, 'utf8');
    expect(saved).toContain('xsd:schema');
    expect(saved).toContain('resheader');
    expect(saved).toContain('Hello edited');
    const parsed = await parseResxFile(filePath);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]?.value).toBe('Hello edited');
  });
});

function vsStyleResx(
  entries: Record<string, { value: string; type?: string; comment?: string }>
): string {
  const data = Object.entries(entries)
    .map(([name, entry]) => {
      const typeAttr = entry.type ? ` type="${entry.type}"` : '';
      const comment = entry.comment
        ? `\n    <comment>${entry.comment}</comment>`
        : '';
      return `  <data name="${name}" xml:space="preserve"${typeAttr}>
    <value>${entry.value}</value>${comment}
  </data>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<root>
  <xsd:schema id="root" xmlns="" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">
    <xsd:import namespace="http://www.w3.org/XML/1998/namespace" />
    <xsd:element name="root" msdata:IsDataSet="true">
      <xsd:complexType>
        <xsd:choice maxOccurs="unbounded">
          <xsd:element name="data">
            <xsd:complexType>
              <xsd:sequence>
                <xsd:element name="value" type="xsd:string" minOccurs="0" msdata:Ordinal="1" />
                <xsd:element name="comment" type="xsd:string" minOccurs="0" msdata:Ordinal="2" />
              </xsd:sequence>
              <xsd:attribute name="name" type="xsd:string" use="required" msdata:Ordinal="1" />
              <xsd:attribute name="type" type="xsd:string" msdata:Ordinal="3" />
              <xsd:attribute name="mimetype" type="xsd:string" msdata:Ordinal="4" />
              <xsd:attribute ref="xml:space" />
            </xsd:complexType>
          </xsd:element>
          <xsd:element name="resheader">
            <xsd:complexType>
              <xsd:sequence>
                <xsd:element name="value" type="xsd:string" minOccurs="0" msdata:Ordinal="1" />
              </xsd:sequence>
              <xsd:attribute name="name" type="xsd:string" use="required" />
            </xsd:complexType>
          </xsd:element>
        </xsd:choice>
      </xsd:complexType>
    </xsd:element>
  </xsd:schema>
  <resheader name="resmimetype">
    <value>text/microsoft-resx</value>
  </resheader>
  <resheader name="version">
    <value>2.0</value>
  </resheader>
${data}
</root>`;
}
