/**
 * Surgical .resx text edits. Parse with the DOM for reads; mutate the original
 * XML string for writes so encoding, newlines, declaration, and schema stay put.
 */

export type ResxNewline = '\n' | '\r\n';

export function detectNewline(text: string): ResxNewline {
  let crlf = 0;
  let lf = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      if (i > 0 && text[i - 1] === '\r') {
        crlf++;
      } else {
        lf++;
      }
    }
  }
  return crlf > lf ? '\r\n' : '\n';
}

export function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeXmlAttr(value: string): string {
  return escapeXmlText(value).replace(/"/g, '&quot;');
}

interface DataBlock {
  start: number;
  end: number;
  openTagStart: number;
  openTagEnd: number;
  key: string;
  nameValueStart: number;
  nameValueEnd: number;
  valueInnerStart: number;
  valueInnerEnd: number;
  commentInnerStart: number;
  commentInnerEnd: number;
  hasComment: boolean;
}

const DATA_OPEN = /<data\b/gi;

function findNameAttr(openTag: string, absStart: number): { key: string; valueStart: number; valueEnd: number } | null {
  const match = /\bname\s*=\s*"([^"]*)"/i.exec(openTag);
  if (!match || match.index === undefined) {
    return null;
  }
  const valueStart = absStart + match.index + match[0].indexOf('"') + 1;
  return {
    key: match[1],
    valueStart,
    valueEnd: valueStart + match[1].length,
  };
}

function findInnerElement(
  xml: string,
  innerStart: number,
  innerEnd: number,
  tag: 'value' | 'comment'
): { innerStart: number; innerEnd: number } | null {
  const open = new RegExp(`<${tag}\\b[^>]*>`, 'i');
  const slice = xml.slice(innerStart, innerEnd);
  const openMatch = open.exec(slice);
  if (!openMatch) {
    return null;
  }
  const contentStart = innerStart + openMatch.index + openMatch[0].length;
  const closeTag = `</${tag}>`;
  const closeAt = xml.toLowerCase().indexOf(closeTag, contentStart);
  if (closeAt < 0 || closeAt > innerEnd) {
    return null;
  }
  return { innerStart: contentStart, innerEnd: closeAt };
}

export function findRootDataBlocks(xml: string): DataBlock[] {
  const blocks: DataBlock[] = [];
  DATA_OPEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DATA_OPEN.exec(xml))) {
    const start = match.index;
    const openTagEnd = xml.indexOf('>', start);
    if (openTagEnd < 0) {
      break;
    }
    const openTag = xml.slice(start, openTagEnd + 1);
    if (/\/\s*>$/.test(openTag)) {
      DATA_OPEN.lastIndex = openTagEnd + 1;
      continue;
    }
    const name = findNameAttr(openTag, start);
    if (!name) {
      DATA_OPEN.lastIndex = openTagEnd + 1;
      continue;
    }
    const closeAt = xml.toLowerCase().indexOf('</data>', openTagEnd + 1);
    if (closeAt < 0) {
      break;
    }
    const end = closeAt + '</data>'.length;
    const value = findInnerElement(xml, openTagEnd + 1, closeAt, 'value');
    const comment = findInnerElement(xml, openTagEnd + 1, closeAt, 'comment');
    blocks.push({
      start,
      end,
      openTagStart: start,
      openTagEnd: openTagEnd + 1,
      key: name.key,
      nameValueStart: name.valueStart,
      nameValueEnd: name.valueEnd,
      valueInnerStart: value?.innerStart ?? -1,
      valueInnerEnd: value?.innerEnd ?? -1,
      commentInnerStart: comment?.innerStart ?? -1,
      commentInnerEnd: comment?.innerEnd ?? -1,
      hasComment: Boolean(comment),
    });
    DATA_OPEN.lastIndex = end;
  }
  return blocks;
}

function replaceRange(xml: string, start: number, end: number, insert: string): string {
  return xml.slice(0, start) + insert + xml.slice(end);
}

function findBlock(xml: string, key: string): DataBlock | undefined {
  return findRootDataBlocks(xml).find((block) => block.key === key);
}

function indentOf(xml: string, index: number): string {
  let i = index;
  while (i > 0 && xml[i - 1] !== '\n') {
    i--;
  }
  const prefix = xml.slice(i, index);
  return /^\s*$/.test(prefix) ? prefix : '  ';
}

function rootCloseIndex(xml: string): number {
  const match = /<\/root\s*>/i.exec(xml);
  return match ? match.index : xml.length;
}

function formatDataElement(
  newline: ResxNewline,
  indent: string,
  key: string,
  value: string,
  comment?: string
): string {
  const inner = `${indent}  `;
  const commentXml =
    comment !== undefined && comment !== ''
      ? `${newline}${inner}<comment>${escapeXmlText(comment)}</comment>`
      : '';
  return `${indent}<data name="${escapeXmlAttr(key)}" xml:space="preserve">${newline}${inner}<value>${escapeXmlText(value)}</value>${commentXml}${newline}${indent}</data>`;
}

export function compareResxKeys(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }) || a.localeCompare(b);
}

export function renameResxKeyInXml(xml: string, oldKey: string, newKey: string): string {
  const block = findBlock(xml, oldKey);
  if (!block) {
    return xml;
  }
  const next = replaceRange(xml, block.nameValueStart, block.nameValueEnd, escapeXmlAttr(newKey));
  return sortResxDataEntries(next);
}

export function setResxValueInXml(xml: string, key: string, value: string, comment?: string): string {
  const block = findBlock(xml, key);
  const escaped = escapeXmlText(value);
  if (!block) {
    return insertDataBlock(xml, key, value, comment);
  }
  let next = xml;
  if (block.valueInnerStart >= 0) {
    next = replaceRange(next, block.valueInnerStart, block.valueInnerEnd, escaped);
  } else {
    const insertAt = block.openTagEnd;
    const newline = detectNewline(xml);
    const indent = indentOf(xml, block.start);
    next = replaceRange(next, insertAt, insertAt, `${newline}${indent}  <value>${escaped}</value>`);
  }
  if (comment !== undefined) {
    next = setResxCommentInXml(next, key, comment);
  }
  return next;
}

export function setResxCommentInXml(xml: string, key: string, comment: string): string {
  const block = findBlock(xml, key);
  if (!block) {
    return xml;
  }
  const escaped = escapeXmlText(comment);
  if (block.hasComment && block.commentInnerStart >= 0) {
    return replaceRange(xml, block.commentInnerStart, block.commentInnerEnd, escaped);
  }
  const newline = detectNewline(xml);
  const indent = indentOf(xml, block.start);
  let insertAt = block.openTagEnd;
  if (block.valueInnerEnd >= 0) {
    const valueClose = xml.toLowerCase().indexOf('</value>', block.valueInnerEnd);
    if (valueClose >= 0) {
      insertAt = valueClose + '</value>'.length;
    }
  }
  return replaceRange(xml, insertAt, insertAt, `${newline}${indent}  <comment>${escaped}</comment>`);
}

export function deleteResxEntryInXml(xml: string, key: string): string {
  const block = findBlock(xml, key);
  if (!block) {
    return xml;
  }
  let start = block.start;
  let end = block.end;
  while (start > 0 && (xml[start - 1] === ' ' || xml[start - 1] === '\t')) {
    start--;
  }
  if (end < xml.length && xml[end] === '\r' && xml[end + 1] === '\n') {
    end += 2;
  } else if (end < xml.length && xml[end] === '\n') {
    end += 1;
  }
  return xml.slice(0, start) + xml.slice(end);
}

function insertDataBlock(xml: string, key: string, value: string, comment?: string): string {
  const newline = detectNewline(xml);
  const blocks = findRootDataBlocks(xml);
  const indent = blocks.length > 0 ? indentOf(xml, blocks[0].start) : '  ';
  const block = formatDataElement(newline, indent, key, value, comment);
  const closeAt = rootCloseIndex(xml);
  const before = xml.slice(0, closeAt);
  const needsNl = before.endsWith('\n') ? '' : newline;
  return sortResxDataEntries(`${before}${needsNl}${block}${newline}${xml.slice(closeAt)}`);
}

/** Reorder contiguous `<data>` entries A–Z. Schema and resheaders stay put. */
export function sortResxDataEntries(xml: string): string {
  const blocks = findRootDataBlocks(xml);
  if (blocks.length < 2) {
    return xml;
  }
  const spans = blocks.map((block) => {
    const { start, end } = spanOfBlock(xml, block);
    return { key: block.key, start, end, text: xml.slice(start, end) };
  });
  for (let i = 1; i < spans.length; i++) {
    if (xml.slice(spans[i - 1].end, spans[i].start).trim() !== '') {
      return xml;
    }
  }
  const sorted = [...spans].sort((a, b) => compareResxKeys(a.key, b.key));
  if (sorted.every((span, i) => span.key === spans[i].key)) {
    return xml;
  }
  return xml.slice(0, spans[0].start) + sorted.map((span) => span.text).join('') + xml.slice(spans[spans.length - 1].end);
}

function spanOfBlock(xml: string, block: DataBlock): { start: number; end: number } {
  let start = block.start;
  let end = block.end;
  while (start > 0 && (xml[start - 1] === ' ' || xml[start - 1] === '\t')) {
    start--;
  }
  if (end < xml.length && xml[end] === '\r' && xml[end + 1] === '\n') {
    end += 2;
  } else if (end < xml.length && xml[end] === '\n') {
    end += 1;
  }
  return { start, end };
}

export function addResxEntryInXml(xml: string, key: string, value: string, comment = ''): string {
  if (findBlock(xml, key)) {
    return setResxValueInXml(xml, key, value, comment || undefined);
  }
  return insertDataBlock(xml, key, value, comment);
}
