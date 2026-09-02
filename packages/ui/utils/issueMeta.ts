import type { IssueRule, ValidationIssue } from '@resx-guard/core-ts';
import { t } from '../i18n';

/** Display order: errors first, then most actionable warnings. */
export const ISSUE_RULE_ORDER: IssueRule[] = [
  'duplicateKeys',
  'missingTranslation',
  'keyPascalCase',
  'matchingSuffix',
  'placeholders',
];

export function ruleLabel(rule: IssueRule): string {
  return t(`issue.rule.${rule}`);
}

export function ruleClass(rule: IssueRule): string {
  return `issue-rule--${rule}`;
}

export function localeDisplay(locale?: string): string {
  if (locale === undefined) {
    return t('issue.locale.key');
  }
  if (locale === '') {
    return t('column.neutral');
  }
  return locale;
}

export function issuesForCell(
  issues: ValidationIssue[],
  locale?: string
): ValidationIssue[] {
  if (locale === undefined) {
    return issues.filter((i) => i.locale === undefined);
  }
  return issues.filter((i) => i.locale === locale);
}

export function uniqueRules(issues: ValidationIssue[]): IssueRule[] {
  return ISSUE_RULE_ORDER.filter((rule) => issues.some((i) => i.rule === rule));
}

export function primaryRule(issues: ValidationIssue[]): IssueRule | null {
  const rules = uniqueRules(issues);
  return rules[0] ?? null;
}

export function namingSuggestedKey(issues: ValidationIssue[]): string | undefined {
  return issues.find((i) => i.rule === 'keyPascalCase' && i.suggestedKey)?.suggestedKey;
}

export interface IssueTooltipLine {
  rule: IssueRule;
  label: string;
  severity: ValidationIssue['severity'];
  message: string;
  locale?: string;
  localeLabel: string;
}

export function tooltipLines(issues: ValidationIssue[]): IssueTooltipLine[] {
  return issues.map((issue) => ({
    rule: issue.rule,
    label: ruleLabel(issue.rule),
    severity: issue.severity,
    message: issue.message,
    locale: issue.locale,
    localeLabel: localeDisplay(issue.locale),
  }));
}
