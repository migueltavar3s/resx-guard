import { DOMParser } from '@xmldom/xmldom';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ResxEntry, ResxFile } from '../models/types';
import { resolveResxIdentity } from './naming';
import {
  addResxEntryInXml,
  deleteResxEntryInXml,
  renameResxKeyInXml,
  setResxCommentInXml,
  setResxValueInXml,
} from './resx-text';

/** xmldom nodes are structurally DOM-like but conflict with lib.dom typings. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XNode = any;

function elementLocalName(node: XNode): string {
  if (!node) {
    return '';
  }
  if (node.localName) {
    return String(node.localName);
  }
  const tag = String(node.tagName || node.nodeName || '');
  const colon = tag.indexOf(':');
  return colon >= 0 ? tag.slice(colon + 1) : tag;
}

function textContent(el: XNode): string {
  if (!el) {
    return '';
  }
  let text = '';
  const walk = (node: XNode): void => {
    if (!node) {
      return;
    }
    if (node.nodeType === 3 || node.nodeType === 4) {
      text += node.nodeValue ?? '';
      return;
    }
    if (node.nodeType === 1) {
      for (let i = 0; i < node.childNodes.length; i++) {
        walk(node.childNodes[i]);
      }
    }
  };
  walk(el);
  return text;
}

function findChild(el: XNode, localName: string): XNode {
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes[i];
    if (n.nodeType === 1 && elementLocalName(n) === localName) {
      return n;
    }
  }
  return null;
}

/**
 * Visual Studio (especially older ResX 1.x / some templates) stamps
 * type="System.String, mscorlib, ..." on string entries. Binary/file
 * resources use mimetype or ResXFileRef / other CLR types.
 */
function isPlainStringData(data: XNode): boolean {
  const mime = (data.getAttribute('mimetype') as string | null)?.trim();
  if (mime) {
    return false;
  }
  const type = (data.getAttribute('type') as string | null)?.trim() ?? '';
  if (!type) {
    return true;
  }
  const typeName = type.split(',')[0]?.trim() ?? '';
  return /^(System\.)?(String|Char)$/i.test(typeName);
}

/** ResX string entries are direct children of <root>, never inside the XSD schema. */
function forEachRootData(root: XNode, visit: (data: XNode) => void): void {
  for (let i = 0; i < root.childNodes.length; i++) {
    const node = root.childNodes[i];
    if (node.nodeType === 1 && elementLocalName(node) === 'data') {
      visit(node);
    }
  }
}

/** Minimal valid .resx document skeleton. */
export function createEmptyResxXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<root>
  <xsd:schema id="root" xmlns="" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">
    <xsd:element name="root" msdata:IsDataSet="true">
    </xsd:element>
  </xsd:schema>
  <resheader name="resmimetype">
    <value>text/microsoft-resx</value>
  </resheader>
  <resheader name="version">
    <value>2.0</value>
  </resheader>
  <resheader name="reader">
    <value>System.Resources.ResXResourceReader, System.Windows.Forms, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089</value>
  </resheader>
  <resheader name="writer">
    <value>System.Resources.ResXResourceWriter, System.Windows.Forms, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089</value>
  </resheader>
</root>
`;
}

export type ResxEncoding = 'utf8' | 'utf16le';

export function detectAndDecodeResx(buffer: Buffer): {
  text: string;
  encoding: ResxEncoding;
  bom: boolean;
} {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: buffer.subarray(2).toString('utf16le'), encoding: 'utf16le', bom: true };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const le = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i + 1 < buffer.length; i += 2) {
      le[i - 2] = buffer[i + 1];
      le[i - 1] = buffer[i];
    }
    return { text: le.toString('utf16le'), encoding: 'utf16le', bom: true };
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.subarray(3).toString('utf8'), encoding: 'utf8', bom: true };
  }
  if (looksLikeUtf16Le(buffer)) {
    return { text: buffer.toString('utf16le'), encoding: 'utf16le', bom: false };
  }
  return { text: buffer.toString('utf8'), encoding: 'utf8', bom: false };
}

function looksLikeUtf16Le(buffer: Buffer): boolean {
  if (buffer.length < 8 || buffer.length % 2 !== 0) {
    return false;
  }
  const sample = Math.min(buffer.length, 200);
  let zerosOnOdd = 0;
  for (let i = 1; i < sample; i += 2) {
    if (buffer[i] === 0) {
      zerosOnOdd++;
    }
  }
  return zerosOnOdd > sample / 4;
}

async function readResxText(
  filePath: string
): Promise<{ text: string; encoding: ResxEncoding; bom: boolean }> {
  const buffer = await fs.readFile(filePath);
  return detectAndDecodeResx(buffer);
}

async function writeResxText(
  filePath: string,
  xml: string,
  encoding: ResxEncoding,
  bom: boolean
): Promise<void> {
  if (encoding === 'utf16le') {
    const body = Buffer.from(xml, 'utf16le');
    await fs.writeFile(filePath, bom ? Buffer.concat([Buffer.from([0xff, 0xfe]), body]) : body);
    return;
  }
  if (bom) {
    await fs.writeFile(
      filePath,
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(xml, 'utf8')])
    );
    return;
  }
  await fs.writeFile(filePath, xml, 'utf8');
}

async function loadOrCreateXml(
  filePath: string
): Promise<{ text: string; encoding: ResxEncoding; bom: boolean }> {
  try {
    return await readResxText(filePath);
  } catch {
    const xml = createEmptyResxXml();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await writeResxText(filePath, xml, 'utf8', false);
    return { text: xml, encoding: 'utf8', bom: false };
  }
}

async function mutateResxXml(filePath: string, mutate: (xml: string) => string): Promise<void> {
  const loaded = await loadOrCreateXml(filePath);
  const next = mutate(loaded.text);
  if (next === loaded.text) {
    return;
  }
  await writeResxText(filePath, next, loaded.encoding, loaded.bom);
}

export async function parseResxFile(filePath: string): Promise<ResxFile> {
  const { text } = await readResxText(filePath);
  return parseResxXml(text, filePath);
}

export function parseResxXml(xml: string, filePath: string): ResxFile {
  const locale = resolveResxIdentity(filePath).locale;
  const doc: XNode = new DOMParser().parseFromString(xml, 'text/xml');
  const root = doc.documentElement;
  if (!root) {
    return { path: filePath, locale, entries: [], duplicateKeys: [] };
  }

  const entries: ResxEntry[] = [];
  const seen = new Map<string, number>();
  const duplicateKeys: string[] = [];

  forEachRootData(root, (data) => {
    const name = data.getAttribute('name') as string | null;
    if (!name || !isPlainStringData(data)) {
      return;
    }

    const valueEl = findChild(data, 'value');
    const commentEl = findChild(data, 'comment');
    entries.push({
      key: name,
      value: textContent(valueEl),
      comment: textContent(commentEl),
    });

    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count === 2) {
      duplicateKeys.push(name);
    }
  });

  return { path: filePath, locale, entries, duplicateKeys };
}

export async function setResxValue(
  filePath: string,
  key: string,
  value: string,
  comment?: string
): Promise<void> {
  await mutateResxXml(filePath, (xml) => setResxValueInXml(xml, key, value, comment));
}

export async function setResxComment(filePath: string, key: string, comment: string): Promise<void> {
  await mutateResxXml(filePath, (xml) => setResxCommentInXml(xml, key, comment));
}

export async function addResxEntry(
  filePath: string,
  key: string,
  value: string,
  comment = ''
): Promise<void> {
  await mutateResxXml(filePath, (xml) => addResxEntryInXml(xml, key, value, comment));
}

export async function deleteResxEntry(filePath: string, key: string): Promise<void> {
  await mutateResxXml(filePath, (xml) => deleteResxEntryInXml(xml, key));
}

export async function renameResxKey(
  filePath: string,
  oldKey: string,
  newKey: string
): Promise<void> {
  await mutateResxXml(filePath, (xml) => renameResxKeyInXml(xml, oldKey, newKey));
}

export async function ensureResxFile(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, createEmptyResxXml(), 'utf8');
  }
}
