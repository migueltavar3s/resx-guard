import type { ResourceRow } from '@resx-guard/core-ts';
import { t } from '../i18n';
import { ruleClass, ruleLabel } from '../utils/issueMeta';

const NEUTRAL = '';

interface Props {
  row: ResourceRow | null;
  locales: string[];
  onApplyNamingSuggestion?: (familyId: string, oldKey: string, newKey: string) => void;
}

function localeLabel(locale: string): string {
  return locale === NEUTRAL || locale === '' ? t('column.neutral') : locale;
}

export function SummaryPanel({ row, locales, onApplyNamingSuggestion }: Props) {
  return (
    <div className="summary-body">
      {!row ? (
        <div className="summary-empty">
          <span className="summary-empty-icon" aria-hidden>
            ↖
          </span>
          <p>{t('summary.noSelection')}</p>
        </div>
      ) : (
        <>
          <div className="summary-block">
            <div className="summary-key" title={row.key}>
              {row.key}
            </div>
            {row.comment && (
              <div className="summary-locale">
                <div className="label">{t('column.comment')}</div>
                <div className="value">{row.comment}</div>
              </div>
            )}
          </div>

          <div className="summary-block">
            <div className="section-title">{t('summary.allLocales')}</div>
            <div className="summary-locale-grid">
              {locales.map((loc) => (
                <div key={loc || 'neutral'} className="summary-locale-card">
                  <div className="label">{localeLabel(loc)}</div>
                  <div className="value">{row.values[loc] ?? ''}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="summary-block">
            <div className="section-title">{t('summary.issues')}</div>
            <p className="summary-issues-hint">{t('summary.issuesHint')}</p>
            {row.issues.length === 0 ? (
              <p className="summary-ok">{t('summary.noIssues')}</p>
            ) : (
              <ul className="issue-list">
                {row.issues.map((issue, i) => (
                  <li
                    key={`${issue.rule}-${issue.locale ?? ''}-${i}`}
                    className={`issue-item ${ruleClass(issue.rule)}`}
                  >
                    <div className="issue-item-head">
                      <div className="issue-item-tag">{ruleLabel(issue.rule)}</div>
                      <div className="issue-item-severity">
                        {t(`issue.severity.${issue.severity}`)}
                      </div>
                    </div>
                    <div className="issue-item-message">{issue.message}</div>
                    {issue.rule === 'keyPascalCase' && issue.suggestedKey ? (
                      <button
                        type="button"
                        className="btn issue-apply-btn"
                        onClick={() =>
                          onApplyNamingSuggestion?.(row.familyId, row.key, issue.suggestedKey!)
                        }
                      >
                        {t('issue.naming.apply', issue.suggestedKey)}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
