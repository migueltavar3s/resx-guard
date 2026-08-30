import { useMemo, useState } from 'react';
import type { ResxFamily, ResourceRow } from '@resx-guard/core-ts';
import { t } from '../i18n';
import { FilterSelect } from './FilterSelect';

interface Props {
  families: ResxFamily[];
  rows: ResourceRow[];
  keyNaming: 'pascalFromNeutral' | 'manual';
  onCancel: () => void;
  onConfirm: (familyId: string, key: string, neutralValue: string) => void;
}

function toPascalCaseKey(input: string): string {
  if (!input) {
    return '';
  }
  const cleaned = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`´]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  if (!cleaned) {
    return '';
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  let result = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  if (/^[0-9]/.test(result)) {
    result = 'N' + result;
  }
  return result;
}

export function AddEntryModal({ families, rows, keyNaming, onCancel, onConfirm }: Props) {
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '');
  const [value, setValue] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);

  const suggested = useMemo(() => toPascalCaseKey(value), [value]);

  const effectiveKey =
    keyNaming === 'pascalFromNeutral' && !keyTouched ? suggested : key;

  const duplicate = useMemo(() => {
    const needle = effectiveKey.trim();
    if (!needle) {
      return false;
    }
    return rows.some((row) => row.familyId === familyId && row.key === needle);
  }, [rows, familyId, effectiveKey]);

  const canSubmit = Boolean(familyId && (effectiveKey.trim() || value.trim()) && !duplicate);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('add.title')}</h3>

        {families.length > 1 && (
          <>
            <label htmlFor="family">{t('add.resource')}</label>
            <FilterSelect
              value={familyId}
              onChange={setFamilyId}
              options={families.map((f) => ({ value: f.id, label: f.displayName }))}
            />
          </>
        )}

        <label htmlFor="value">{t('add.value')}</label>
        <textarea
          id="value"
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />

        <label htmlFor="key">{t('add.key')}</label>
        <input
          id="key"
          className={duplicate ? 'has-error' : ''}
          value={effectiveKey}
          onChange={(e) => {
            setKeyTouched(true);
            setKey(e.target.value);
          }}
        />
        {duplicate && <div className="field-error">{t('add.duplicate', effectiveKey.trim())}</div>}
        {keyNaming === 'pascalFromNeutral' && suggested && !keyTouched && !duplicate && (
          <div className="suggest-hint">{t('add.suggest')}: {suggested}</div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('add.cancel')}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!canSubmit}
            onClick={() => onConfirm(familyId, effectiveKey.trim(), value)}
          >
            {t('add.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
