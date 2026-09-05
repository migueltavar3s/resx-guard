import * as fs from 'fs/promises';
import * as path from 'path';

async function loadI18n(filePath: string): Promise<any> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    if (content.trim()) {
      return JSON.parse(content);
    }
  } catch {
    // Return empty object if file doesn't exist or is invalid
  }
  return {};
}

async function saveI18n(filePath: string, data: any): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function setNestedValue(obj: any, key: string, value: string): void {
  const parts = key.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== 'object' || current[part] === null || Array.isArray(current[part])) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function deleteNestedValue(obj: any, key: string): void {
  const parts = key.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== 'object' || current[part] === null) {
      return; // Not found
    }
    current = current[part];
  }
  delete current[parts[parts.length - 1]];
  // Optional: prune empty objects? For now just delete the leaf.
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
  const data = await loadI18n(filePath);
  
  // Get old value
  const parts = oldKey.split('.');
  let current = data;
  let found = true;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== 'object' || current[part] === null) {
      found = false;
      break;
    }
    current = current[part];
  }
  
  if (found && current.hasOwnProperty(parts[parts.length - 1])) {
    const value = current[parts[parts.length - 1]];
    delete current[parts[parts.length - 1]];
    setNestedValue(data, newKey, String(value));
    await saveI18n(filePath, data);
  }
}
