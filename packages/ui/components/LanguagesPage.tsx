import { t } from '../i18n';

const NEUTRAL = '';

interface Props {
  locales: string[];
  visibleLocales: string[];
  onChange: (locales: string[]) => void;
}

function label(locale: string): string {
  return locale === NEUTRAL || locale === '' ? t('column.neutral') : locale;
}

export function LanguagesPage({ locales, visibleLocales, onChange }: Props) {
  const visible = new Set(visibleLocales);

  return (
    <>
      <h2>{t('languages.title')}</h2>
      <p className="hint">{t('languages.hint')}</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" className="btn" onClick={() => onChange([...locales])}>
          {t('languages.selectAll')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => onChange(locales.includes(NEUTRAL) ? [NEUTRAL] : locales.slice(0, 1))}
        >
          {t('languages.clear')}
        </button>
      </div>
      <div className="locale-list">
        {locales.map((loc) => (
          <label key={loc || 'neutral'} className="setting-row">
            <input
              type="checkbox"
              checked={visible.has(loc)}
              onChange={(e) => {
                const next = new Set(visibleLocales);
                if (e.target.checked) {
                  next.add(loc);
                } else {
                  next.delete(loc);
                }
                // Keep neutral-first order
                const ordered = locales.filter((l) => next.has(l));
                onChange(ordered);
              }}
            />
            <span>{label(loc)}</span>
          </label>
        ))}
      </div>
    </>
  );
}
