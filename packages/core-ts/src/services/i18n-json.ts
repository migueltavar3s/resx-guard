import type { ResxEntry } from '../models/types';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function leafToString(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export function parseI18nJsonText(content: string): Record<string, unknown> {
  const trimmed = content.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return {};
  }
  const data = JSON.parse(trimmed) as unknown;
  return isPlainObject(data) ? data : {};
}

export function flattenI18nObject(data: unknown): { entries: ResxEntry[]; duplicateKeys: string[] } {
  const entries: ResxEntry[] = [];
  const counts = new Map<string, number>();

  const walk = (value: unknown, prefix: string): void => {
    if (isPlainObject(value)) {
      for (const key of Object.keys(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        walk(value[key], path);
      }
      return;
    }
    if (!prefix) {
      return;
    }
    counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    entries.push({
      key: prefix,
      value: leafToString(value),
      comment: '',
    });
  };

  walk(isPlainObject(data) ? data : {}, '');

  const duplicateKeys = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);

  return { entries, duplicateKeys };
}

export function getNestedValue(obj: unknown, key: string): unknown {
  if (!key) {
    return undefined;
  }
  let current: unknown = obj;
  for (const part of key.split('.')) {
    if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

export function setNestedValue(obj: Record<string, unknown>, key: string, value: string): void {
  const parts = key.split('.').filter((part) => part.length > 0);
  if (parts.length === 0) {
    return;
  }
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = current[part];
    if (!isPlainObject(next)) {
      const created: Record<string, unknown> = {};
      current[part] = created;
      current = created;
    } else {
      current = next;
    }
  }
  current[parts[parts.length - 1]] = value;
}

export function deleteNestedValue(obj: Record<string, unknown>, key: string): void {
  const parts = key.split('.').filter((part) => part.length > 0);
  if (parts.length === 0) {
    return;
  }

  const stack: { parent: Record<string, unknown>; part: string }[] = [];
  let current: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
      return;
    }
    stack.push({ parent: current, part });
    current = current[part];
  }

  if (!isPlainObject(current)) {
    return;
  }
  delete current[parts[parts.length - 1]];

  for (let i = stack.length - 1; i >= 0; i--) {
    const { parent, part } = stack[i];
    const child = parent[part];
    if (isPlainObject(child) && Object.keys(child).length === 0) {
      delete parent[part];
    } else {
      break;
    }
  }
}
