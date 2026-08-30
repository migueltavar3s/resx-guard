import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ResxEntry, ResxFile } from '../models/types';
import { resolveResxIdentity } from './naming';

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

function setTextContent(doc: XNode, el: XNode, value: string): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
  el.appendChild(doc.createTextNode(value));
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

export function detectAndDecodeResx(buffer: Buffer): { text: string; encoding: ResxEncoding } {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: buffer.subarray(2).toString('utf16le'), encoding: 'utf16le' };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const le = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i + 1 < buffer.length; i += 2) {
      le[i - 2] = buffer[i + 1];
      le[i - 1] = buffer[i];
    }
    return { text: le.toString('utf16le'), encoding: 'utf16le' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.subarray(3).toString('utf8'), encoding: 'utf8' };
  }
  if (looksLikeUtf16Le(buffer)) {
    return { text: buffer.toString('utf16le'), encoding: 'utf16le' };
  }
  return { text: buffer.toString('utf8'), encoding: 'utf8' };
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

async function readResxText(filePath: string): Promise<{ text: string; encoding: ResxEncoding }> {
  const buffer = await fs.readFile(filePath);
  return detectAndDecodeResx(buffer);
}

async function writeResxText(filePath: string, xml: string, encoding: ResxEncoding): Promise<void> {
  if (encoding === 'utf16le') {
    await fs.writeFile(
      filePath,
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, 'utf16le')])
    );
    return;
  }
  await fs.writeFile(filePath, xml, 'utf8');
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

async function loadOrCreateDoc(
  filePath: string
): Promise<{ doc: XNode; encoding: ResxEncoding }> {
  let xml: string;
  let encoding: ResxEncoding = 'utf8';
  try {
    const decoded = await readResxText(filePath);
    xml = decoded.text;
    encoding = decoded.encoding;
  } catch {
    xml = createEmptyResxXml();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, xml, 'utf8');
  }
  return { doc: new DOMParser().parseFromString(xml, 'text/xml'), encoding };
}

function serialize(doc: XNode): string {
  return new XMLSerializer().serializeToString(doc);
}

function ensureRoot(doc: XNode): XNode {
  let root = doc.documentElement;
  if (!root) {
    root = doc.createElement('root');
    doc.appendChild(root);
  }
  return root;
}

function findDataElement(root: XNode, key: string): XNode {
  let found: XNode = null;
  forEachRootData(root, (data) => {
    if (!found && data.getAttribute('name') === key) {
      found = data;
    }
  });
  return found;
}

function createDataElement(doc: XNode, key: string, value: string, comment?: string): XNode {
  const data = doc.createElement('data');
  data.setAttribute('name', key);
  data.setAttribute('xml:space', 'preserve');
  const valueEl = doc.createElement('value');
  setTextContent(doc, valueEl, value);
  data.appendChild(valueEl);
  if (comment) {
    const commentEl = doc.createElement('comment');
    setTextContent(doc, commentEl, comment);
    data.appendChild(commentEl);
  }
  return data;
}

export async function setResxValue(
  filePath: string,
  key: string,
  value: string,
  comment?: string
): Promise<void> {
  const { doc, encoding } = await loadOrCreateDoc(filePath);
  const root = ensureRoot(doc);
  let data = findDataElement(root, key);
  if (!data) {
    data = createDataElement(doc, key, value, comment);
    root.appendChild(doc.createTextNode('\n  '));
    root.appendChild(data);
  } else {
    let valueEl = findChild(data, 'value');
    if (!valueEl) {
      valueEl = doc.createElement('value');
      data.appendChild(valueEl);
    }
    setTextContent(doc, valueEl, value);
    if (comment !== undefined) {
      let commentEl = findChild(data, 'comment');
      if (!commentEl) {
        commentEl = doc.createElement('comment');
        data.appendChild(commentEl);
      }
      setTextContent(doc, commentEl, comment);
    }
  }
  await writeResxText(filePath, serialize(doc), encoding);
}

export async function setResxComment(filePath: string, key: string, comment: string): Promise<void> {
  const { doc, encoding } = await loadOrCreateDoc(filePath);
  const root = ensureRoot(doc);
  const data = findDataElement(root, key);
  if (!data) {
    return;
  }
  let commentEl = findChild(data, 'comment');
  if (!commentEl) {
    commentEl = doc.createElement('comment');
    data.appendChild(commentEl);
  }
  setTextContent(doc, commentEl, comment);
  await writeResxText(filePath, serialize(doc), encoding);
}

export async function addResxEntry(
  filePath: string,
  key: string,
  value: string,
  comment = ''
): Promise<void> {
  await setResxValue(filePath, key, value, comment);
}

export async function deleteResxEntry(filePath: string, key: string): Promise<void> {
  const { doc, encoding } = await loadOrCreateDoc(filePath);
  const root = ensureRoot(doc);
  const data = findDataElement(root, key);
  if (!data) {
    return;
  }
  root.removeChild(data);
  await writeResxText(filePath, serialize(doc), encoding);
}

export async function renameResxKey(
  filePath: string,
  oldKey: string,
  newKey: string
): Promise<void> {
  const { doc, encoding } = await loadOrCreateDoc(filePath);
  const root = ensureRoot(doc);
  const data = findDataElement(root, oldKey);
  if (!data) {
    return;
  }
  data.setAttribute('name', newKey);
  await writeResxText(filePath, serialize(doc), encoding);
}

export async function ensureResxFile(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, createEmptyResxXml(), 'utf8');
  }
}
