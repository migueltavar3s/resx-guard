import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ResxEntry, ResxFile } from '../models/types';
import { parseLocaleFromFileName } from './naming';

/** xmldom nodes are structurally DOM-like but conflict with lib.dom typings. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XNode = any;

const DATA_SELECTOR = 'data';

function textContent(el: XNode): string {
  if (!el) {
    return '';
  }
  let text = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType === 3 || node.nodeType === 4) {
      text += node.nodeValue ?? '';
    }
  }
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
    if (n.nodeType === 1 && n.tagName === localName) {
      return n;
    }
  }
  return null;
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

export async function parseResxFile(filePath: string): Promise<ResxFile> {
  const xml = await fs.readFile(filePath, 'utf8');
  return parseResxXml(xml, filePath);
}

export function parseResxXml(xml: string, filePath: string): ResxFile {
  const fileName = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
  const locale = parseLocaleFromFileName(fileName);
  const doc: XNode = new DOMParser().parseFromString(xml, 'text/xml');
  const root = doc.documentElement;
  if (!root) {
    return { path: filePath, locale, entries: [], duplicateKeys: [] };
  }

  const entries: ResxEntry[] = [];
  const seen = new Map<string, number>();
  const duplicateKeys: string[] = [];

  const nodes = root.getElementsByTagName(DATA_SELECTOR);
  for (let i = 0; i < nodes.length; i++) {
    const data = nodes[i];
    const name = data.getAttribute('name') as string | null;
    if (!name) {
      continue;
    }
    const type = data.getAttribute('type');
    const mimetype = data.getAttribute('mimetype');
    if (type || mimetype) {
      continue;
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
  }

  return { path: filePath, locale, entries, duplicateKeys };
}

async function loadOrCreateDoc(filePath: string): Promise<XNode> {
  let xml: string;
  try {
    xml = await fs.readFile(filePath, 'utf8');
  } catch {
    xml = createEmptyResxXml();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, xml, 'utf8');
  }
  return new DOMParser().parseFromString(xml, 'text/xml');
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
  const nodes = root.getElementsByTagName(DATA_SELECTOR);
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].getAttribute('name') === key) {
      return nodes[i];
    }
  }
  return null;
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
  const doc = await loadOrCreateDoc(filePath);
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
  await fs.writeFile(filePath, serialize(doc), 'utf8');
}

export async function setResxComment(filePath: string, key: string, comment: string): Promise<void> {
  const doc = await loadOrCreateDoc(filePath);
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
  await fs.writeFile(filePath, serialize(doc), 'utf8');
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
  const doc = await loadOrCreateDoc(filePath);
  const root = ensureRoot(doc);
  const data = findDataElement(root, key);
  if (!data) {
    return;
  }
  root.removeChild(data);
  await fs.writeFile(filePath, serialize(doc), 'utf8');
}

export async function renameResxKey(
  filePath: string,
  oldKey: string,
  newKey: string
): Promise<void> {
  const doc = await loadOrCreateDoc(filePath);
  const root = ensureRoot(doc);
  const data = findDataElement(root, oldKey);
  if (!data) {
    return;
  }
  data.setAttribute('name', newKey);
  await fs.writeFile(filePath, serialize(doc), 'utf8');
}

export async function ensureResxFile(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, createEmptyResxXml(), 'utf8');
  }
}
