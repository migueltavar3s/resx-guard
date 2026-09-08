import * as fs from 'fs/promises';
import type { ResxFile } from '../models/types';
import { flattenI18nObject, parseI18nJsonText } from './i18n-json';
import { resolveResxIdentity } from './naming';

export async function parseI18nFile(filePath: string): Promise<ResxFile> {
  let content = '';
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch {
    // Missing files are treated as empty translation objects.
  }

  let data: Record<string, unknown> = {};
  if (content.trim()) {
    try {
      data = parseI18nJsonText(content);
    } catch {
      throw new Error(`Invalid JSON in i18n file: ${filePath}`);
    }
  }

  const identity = resolveResxIdentity(filePath);
  const { entries, duplicateKeys } = flattenI18nObject(data);

  return {
    path: filePath,
    locale: identity.locale,
    entries,
    duplicateKeys,
  };
}
