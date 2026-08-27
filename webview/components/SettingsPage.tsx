import type { ExtensionSettings } from '../../src/models/types';
import { t } from '../i18n';

interface Props {
  settings: ExtensionSettings;
  onChange: (partial: Partial<ExtensionSettings>) => void;
}

export function SettingsPage({ settings, onChange }: Props) {
  return (
    <>
      <h2>{t('settings.title')}</h2>

      <div className="setting-group">
        <h3>{t('settings.keyNaming')}</h3>
        <label className="setting-row">
          <input
            type="radio"
            name="keyNaming"
            checked={settings.keyNaming === 'pascalFromNeutral'}
            onChange={() => onChange({ keyNaming: 'pascalFromNeutral' })}
          />
          <span>{t('settings.keyNaming.pascal')}</span>
        </label>
        <label className="setting-row">
          <input
            type="radio"
            name="keyNaming"
            checked={settings.keyNaming === 'manual'}
            onChange={() => onChange({ keyNaming: 'manual' })}
          />
          <span>{t('settings.keyNaming.manual')}</span>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-row">
          <input
            type="checkbox"
            checked={settings.updateDesignerCs}
            onChange={(e) => onChange({ updateDesignerCs: e.target.checked })}
          />
          <span>{t('settings.designer')}</span>
        </label>
      </div>

      <div className="setting-group">
        <h3>{t('settings.rules')}</h3>
        {(
          [
            'keyPascalCase',
            'matchingSuffix',
            'placeholders',
            'missingTranslation',
            'duplicateKeys',
          ] as const
        ).map((rule) => (
          <label key={rule} className="setting-row">
            <input
              type="checkbox"
              checked={settings.rules[rule]}
              onChange={(e) =>
                onChange({
                  rules: { ...settings.rules, [rule]: e.target.checked },
                })
              }
            />
            <span>{t(`settings.rules.${rule}`)}</span>
          </label>
        ))}
      </div>
    </>
  );
}
