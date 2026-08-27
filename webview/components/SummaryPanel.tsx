import type { ResourceRow } from '../../src/models/types';
import { t } from '../i18n';

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
    <div>
      <div className="section-title">{t('summary.title')}</div>
      {!row ? (
        <p className="hint" style={{ opacity: 0.7, fontSize: 12 }}>
          {t('summary.noSelection')}
        </p>
      ) : (
        <>
          <div className="summary-block">
            <div className="summary-key">{row.key}</div>
            {row.comment && (
              <div className="summary-locale">
                <div className="label">{t('column.comment')}</div>
                <div className="value">{row.comment}</div>
              </div>
            )}
          </div>

          <div className="summary-block">
            <div className="section-title">{t('summary.allLocales')}</div>
            {locales.map((loc) => (
              <div key={loc || 'neutral'} className="summary-locale">
                <div className="label">{localeLabel(loc)}</div>
                <div className="value">{row.values[loc] ?? ''}</div>
              </div>
            ))}
          </div>

          <div className="summary-block">
            <div className="section-title">{t('summary.issues')}</div>
            {row.issues.length === 0 ? (
              <p style={{ fontSize: 12, opacity: 0.7 }}>{t('summary.noIssues')}</p>
            ) : (
              <ul className="issue-list">
                {row.issues.map((issue, i) => (
                  <li
                    key={`${issue.rule}-${issue.locale ?? ''}-${i}`}
                    className={issue.severity === 'error' ? 'error' : ''}
                  >
                    {issue.message}
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
