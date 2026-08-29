import type { ResourceRow } from '../../src/models/types';
import { t } from '../i18n';
import { ruleClass, ruleLabel } from '../utils/issueMeta';

const NEUTRAL = '';

interface Props {
  row: ResourceRow | null;
  locales: string[];
}

function localeLabel(locale: string): string {
  return locale === NEUTRAL || locale === '' ? t('column.neutral') : locale;
}

export function SummaryPanel({ row, locales }: Props) {
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
            {row.issues.length === 0 ? (
              <p className="summary-ok">{t('summary.noIssues')}</p>
            ) : (
              <ul className="issue-list">
                {row.issues.map((issue, i) => (
                  <li
                    key={`${issue.rule}-${issue.locale ?? ''}-${i}`}
                    className={`issue-item ${ruleClass(issue.rule)}`}
                  >
                    <div className="issue-item-tag">{ruleLabel(issue.rule)}</div>
                    <div className="issue-item-message">{issue.message}</div>
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
