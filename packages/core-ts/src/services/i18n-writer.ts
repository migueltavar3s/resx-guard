import * as fs from 'fs/promises';
import * as path from 'path';
import {
  deleteNestedValue,
  getNestedValue,
  isPlainObject,
  leafToString,
  parseI18nJsonText,
  setNestedValue,
} from './i18n-json';

async function loadI18n(filePath: string): Promise<Record<string, unknown>> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return parseI18nJsonText(content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    if (err instanceof SyntaxError) {
      return {};
    }
    throw err;
  }
}

async function saveI18n(filePath: string, data: Record<string, unknown>): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export async function setI18nValue(filePath: string, key: string, value: string): Promise<void> {
  const data = await loadI18n(filePath);
  setNestedValue(data, key, value);
  await saveI18n(filePath, data);
}

export async function addI18nEntry(filePath: string, key: string, value: string): Promise<void> {
  return setI18nValue(filePath, key, value);
}

export async function deleteI18nEntry(filePath: string, key: string): Promise<void> {
  const data = await loadI18n(filePath);
  deleteNestedValue(data, key);
  await saveI18n(filePath, data);
}

export async function renameI18nKey(filePath: string, oldKey: string, newKey: string): Promise<void> {
  if (!oldKey || oldKey === newKey) {
    return;
  }
  const data = await loadI18n(filePath);
  const value = getNestedValue(data, oldKey);
  if (value === undefined || isPlainObject(value)) {
    return;
  }
  deleteNestedValue(data, oldKey);
  setNestedValue(data, newKey, typeof value === 'string' ? value : leafToString(value));
  await saveI18n(filePath, data);
}
