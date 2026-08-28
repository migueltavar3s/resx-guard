import { t } from '../i18n';
import { post } from '../vscodeApi';

export const ABOUT_LINKS = {
  repo: 'https://github.com/migueltavar3s/resx-guard',
  issues: 'https://github.com/migueltavar3s/resx-guard/issues',
  donate: 'https://github.com/sponsors/migueltavar3s',
} as const;

export function AboutPage({ version }: { version: string }) {
  return (
    <div className="settings about-page">
      <header className="settings-hero">
        <h2>{t('about.title')}</h2>
        <p className="hint">{t('about.blurb')}</p>
        {version ? <p className="about-version">{t('about.version', version)}</p> : null}
      </header>

      <section className="setting-card">
        <div className="setting-card-head">
          <h3>{t('about.project')}</h3>
          <p>{t('about.projectHint')}</p>
        </div>
        <div className="about-actions">
          <button type="button" className="btn" onClick={() => post({ type: 'openUrl', url: ABOUT_LINKS.repo })}>
            {t('about.repo')}
          </button>
          <button type="button" className="btn" onClick={() => post({ type: 'openUrl', url: ABOUT_LINKS.issues })}>
            {t('about.issues')}
          </button>
        </div>
      </section>

      <section className="setting-card">
        <div className="setting-card-head">
          <h3>{t('about.donate')}</h3>
          <p>{t('about.donateHint')}</p>
        </div>
        <div className="about-actions">
          <button type="button" className="btn" onClick={() => post({ type: 'openUrl', url: ABOUT_LINKS.donate })}>
            {t('about.sponsor')}
          </button>
        </div>
      </section>
    </div>
  );
}
