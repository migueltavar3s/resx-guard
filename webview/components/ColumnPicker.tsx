import { useEffect, useRef } from 'react';
import { t } from '../i18n';

const NEUTRAL = '';

interface Props {
  open: boolean;
  onClose: () => void;
  showKey: boolean;
  showIssues: boolean;
  allLocales: string[];
  visibleLocales: string[];
  onToggleKey: (v: boolean) => void;
  onToggleIssues: (v: boolean) => void;
  onToggleLocale: (locale: string, visible: boolean) => void;
}

function localeLabel(locale: string): string {
  return locale === NEUTRAL || locale === '' ? t('column.neutral') : locale;
}

export function ColumnPicker({
  open,
  onClose,
  showKey,
  showIssues,
  allLocales,
  visibleLocales,
  onToggleKey,
  onToggleIssues,
  onToggleLocale,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = new Set(visibleLocales);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="column-picker" ref={ref}>
      <div className="column-picker-title">{t('columns.title')}</div>
      <label className="column-picker-row">
        <input type="checkbox" checked={showKey} onChange={(e) => onToggleKey(e.target.checked)} />
        <span>{t('column.key')}</span>
      </label>
      <label className="column-picker-row">
        <input
          type="checkbox"
          checked={showIssues}
          onChange={(e) => onToggleIssues(e.target.checked)}
        />
        <span>{t('column.issues')}</span>
      </label>
      <div className="column-picker-divider" />
      <div className="column-picker-sub">{t('columns.languages')}</div>
      {allLocales.map((loc) => (
        <label key={loc || 'neutral'} className="column-picker-row">
          <input
            type="checkbox"
            checked={visible.has(loc)}
            onChange={(e) => onToggleLocale(loc, e.target.checked)}
          />
          <span>{localeLabel(loc)}</span>
        </label>
      ))}
    </div>
  );
}
