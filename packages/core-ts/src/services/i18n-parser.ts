import * as fs from 'fs/promises';
import type { ResxEntry, ResxFile } from '../models/types';
import { resolveResxIdentity } from './naming';

export async function parseI18nFile(filePath: string): Promise<ResxFile> {
  let content = '';
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch {
    // If file doesn't exist yet, just return empty
  }
  let data: any = {};
  
  if (content.trim()) {
    try {
      data = JSON.parse(content);
    } catch (e) {
      throw new Error(`Invalid JSON in i18n file: ${filePath}`);
    }
  }

  const identity = resolveResxIdentity(filePath);
  const entries: ResxEntry[] = [];
  const duplicateKeys: string[] = [];
  
  // Flatten nested objects to dot-notation
  const flatten = (obj: any, prefix = '') => {
    for (const key of Object.keys(obj)) {
      const propName = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        flatten(obj[key], propName);
      } else {
        entries.push({
          key: propName,
          value: String(obj[key] ?? ''),
          comment: '' // JSON doesn't support comments
        });
      }
    }
  };
  
  flatten(data);

  return {
    path: filePath,
    locale: identity.locale,
    entries,
    duplicateKeys,
  };
}
