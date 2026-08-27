import { useMemo, useState } from 'react';
import type { ResxFamily } from '../../src/models/types';
import { t } from '../i18n';

interface Props {
  families: ResxFamily[];
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

export function AddEntryModal({ families, keyNaming, onCancel, onConfirm }: Props) {
  const [familyId, setFamilyId] = useState(families[0]?.id ?? '');
  const [value, setValue] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);

  const suggested = useMemo(() => toPascalCaseKey(value), [value]);

  const effectiveKey =
    keyNaming === 'pascalFromNeutral' && !keyTouched ? suggested : key;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('add.title')}</h3>

        {families.length > 1 && (
          <>
            <label htmlFor="family">Resource</label>
            <select
              id="family"
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              style={{
                width: '100%',
                marginBottom: 12,
                padding: '8px 10px',
                background: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border, transparent)',
                borderRadius: 4,
              }}
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.displayName}
                </option>
              ))}
            </select>
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
          value={effectiveKey}
          onChange={(e) => {
            setKeyTouched(true);
            setKey(e.target.value);
          }}
        />
        {keyNaming === 'pascalFromNeutral' && suggested && !keyTouched && (
          <div className="suggest-hint">{t('add.suggest')}: {suggested}</div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('add.cancel')}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!familyId || (!effectiveKey && !value)}
            onClick={() => onConfirm(familyId, effectiveKey, value)}
          >
            {t('add.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
