import en from './i18n/en.json';
import pt from './i18n/pt.json';

const catalogs: Record<string, Record<string, string>> = {
  en,
  pt,
};

let current = 'en';

export function setLanguage(lang: string): void {
  current = lang.startsWith('pt') ? 'pt' : 'en';
}

export function t(key: string, ...args: string[]): string {
  const catalog = catalogs[current] ?? catalogs.en;
  let text = catalog[key] ?? catalogs.en[key] ?? key;
  args.forEach((arg, i) => {
    text = text.replace(`{${i}}`, arg);
  });
  return text;
}
