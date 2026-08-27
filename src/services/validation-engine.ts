import type {
  ExtensionSettings,
  ResxFamily,
  ResxFile,
  ResourceRow,
  ValidationIssue,
  ValidationRulesConfig,
} from '../models/types';
import { NEUTRAL_LOCALE } from '../models/types';
import {
  endingsMatch,
  placeholdersMatch,
  toPascalCaseKey,
} from './naming';

export function validateFamily(
  family: ResxFamily,
  files: ResxFile[],
  rules: ValidationRulesConfig,
  localesToCheck?: string[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byLocale = new Map<string, ResxFile>();
  for (const f of files) {
    byLocale.set(f.locale, f);
  }

  const neutral = byLocale.get(NEUTRAL_LOCALE) ?? files[0];
  if (!neutral) {
    return issues;
  }

  if (rules.duplicateKeys) {
    for (const f of files) {
      for (const key of f.duplicateKeys) {
        issues.push({
          rule: 'duplicateKeys',
          severity: 'error',
          message: `Duplicate key "${key}" in ${localeLabel(f.locale)}`,
          key,
          locale: f.locale,
          familyId: family.id,
        });
      }
    }
  }

  const keys = new Set<string>();
  for (const e of neutral.entries) {
    keys.add(e.key);
  }
  // Also include keys that only exist in satellites
  for (const f of files) {
    for (const e of f.entries) {
      keys.add(e.key);
    }
  }

  const locales =
    localesToCheck && localesToCheck.length > 0
      ? localesToCheck
      : [...byLocale.keys()];

  for (const key of keys) {
    const neutralEntry = neutral.entries.find((e) => e.key === key);
    const neutralValue = neutralEntry?.value ?? '';

    if (rules.keyPascalCase && neutralEntry) {
      const expected = toPascalCaseKey(neutralValue);
      if (expected && key !== expected) {
        issues.push({
          rule: 'keyPascalCase',
          severity: 'warning',
          message: `Key should be PascalCase of neutral value: expected "${expected}"`,
          key,
          familyId: family.id,
        });
      }
    }

    for (const locale of locales) {
      if (locale === NEUTRAL_LOCALE && byLocale.get(NEUTRAL_LOCALE) === neutral) {
        // still validate satellites primarily for suffix/placeholders/missing
      }
      const file = byLocale.get(locale);
      const entry = file?.entries.find((e) => e.key === key);
      const value = entry?.value ?? '';

      if (locale !== (neutral.locale ?? NEUTRAL_LOCALE) || file !== neutral) {
        if (rules.missingTranslation && neutralEntry && !value) {
          // Only flag missing if this locale file exists in the family
          if (family.files[locale] !== undefined) {
            issues.push({
              rule: 'missingTranslation',
              severity: 'warning',
              message: `Missing translation for ${localeLabel(locale)}`,
              key,
              locale,
              familyId: family.id,
            });
          }
        }

        if (value && neutralValue) {
          if (rules.matchingSuffix && !endingsMatch(neutralValue, value)) {
            issues.push({
              rule: 'matchingSuffix',
              severity: 'warning',
              message: `Ending does not match neutral for ${localeLabel(locale)}`,
              key,
              locale,
              familyId: family.id,
            });
          }
          if (rules.placeholders && !placeholdersMatch(neutralValue, value)) {
            issues.push({
              rule: 'placeholders',
              severity: 'warning',
              message: `Placeholders differ from neutral for ${localeLabel(locale)}`,
              key,
              locale,
              familyId: family.id,
            });
          }
        }
      }
    }
  }

  return issues;
}

export function attachIssuesToRows(
  rows: ResourceRow[],
  issues: ValidationIssue[]
): ResourceRow[] {
  const byKey = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    const mapKey = `${issue.familyId}::${issue.key}`;
    let list = byKey.get(mapKey);
    if (!list) {
      list = [];
      byKey.set(mapKey, list);
    }
    list.push(issue);
  }

  return rows.map((row) => ({
    ...row,
    issues: byKey.get(`${row.familyId}::${row.key}`) ?? [],
  }));
}

export function buildRows(
  family: ResxFamily,
  files: ResxFile[]
): ResourceRow[] {
  const keys = new Map<string, { comment: string; values: Record<string, string> }>();

  for (const file of files) {
    for (const entry of file.entries) {
      let row = keys.get(entry.key);
      if (!row) {
        row = { comment: '', values: {} };
        keys.set(entry.key, row);
      }
      row.values[file.locale] = entry.value;
      if (file.locale === NEUTRAL_LOCALE && entry.comment) {
        row.comment = entry.comment;
      } else if (!row.comment && entry.comment) {
        row.comment = entry.comment;
      }
    }
  }

  const rows: ResourceRow[] = [];
  for (const [key, data] of keys) {
    rows.push({
      familyId: family.id,
      key,
      comment: data.comment,
      values: data.values,
      issues: [],
    });
  }

  rows.sort((a, b) => a.key.localeCompare(b.key, undefined, { sensitivity: 'base' }));
  return rows;
}

export function defaultSettings(): ExtensionSettings {
  return {
    neutralLocale: '',
    keyNaming: 'pascalFromNeutral',
    updateDesignerCs: true,
    visibleLocales: [],
    rules: {
      keyPascalCase: true,
      matchingSuffix: true,
      placeholders: true,
      missingTranslation: true,
      duplicateKeys: true,
    },
  };
}

function localeLabel(locale: string): string {
  return locale === NEUTRAL_LOCALE || locale === '' ? 'Neutral' : locale;
}
