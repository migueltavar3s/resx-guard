import type { ExtensionSettings } from '../../src/models/types';
import { t } from '../i18n';

interface Props {
  settings: ExtensionSettings;
  onChange: (partial: Partial<ExtensionSettings>) => void;
}

const RULES = [
  'keyPascalCase',
  'matchingSuffix',
  'placeholders',
  'missingTranslation',
  'duplicateKeys',
] as const;

export function SettingsPage({ settings, onChange }: Props) {
  return (
    <div className="settings">
      <header className="settings-hero">
        <h2>{t('settings.title')}</h2>
        <p className="hint">{t('settings.hint')}</p>
      </header>

      <section className="setting-card">
        <div className="setting-card-head">
          <h3>{t('settings.keyNaming')}</h3>
          <p>{t('settings.keyNaming.hint')}</p>
        </div>
        <div className="segmented" role="radiogroup" aria-label={t('settings.keyNaming')}>
          <button
            type="button"
            className={settings.keyNaming === 'pascalFromNeutral' ? 'on' : ''}
            onClick={() => onChange({ keyNaming: 'pascalFromNeutral' })}
          >
            {t('settings.keyNaming.pascal')}
          </button>
          <button
            type="button"
            className={settings.keyNaming === 'manual' ? 'on' : ''}
            onClick={() => onChange({ keyNaming: 'manual' })}
          >
            {t('settings.keyNaming.manual')}
          </button>
        </div>
      </section>

      <section className="setting-card">
        <label className="toggle-row">
          <span>
            <span className="toggle-title">{t('settings.designer')}</span>
            <span className="toggle-hint">{t('settings.designer.hint')}</span>
          </span>
          <input
            type="checkbox"
            checked={settings.updateDesignerCs}
            onChange={(e) => onChange({ updateDesignerCs: e.target.checked })}
          />
          <span className="toggle-track" aria-hidden />
        </label>
      </section>

      <section className="setting-card">
        <div className="setting-card-head">
          <h3>{t('settings.rules')}</h3>
          <p>{t('settings.rules.hint')}</p>
        </div>
        <div className="setting-toggles">
          {RULES.map((rule) => (
            <label key={rule} className="toggle-row">
              <span>
                <span className="toggle-title">{t(`settings.rules.${rule}`)}</span>
              </span>
              <input
                type="checkbox"
                checked={settings.rules[rule]}
                onChange={(e) =>
                  onChange({
                    rules: { ...settings.rules, [rule]: e.target.checked },
                  })
                }
              />
              <span className="toggle-track" aria-hidden />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
