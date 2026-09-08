/** ISO 639-1 language codes — last path segments like "Web" or "UI" must not count as cultures. */
const ISO_639_1 = new Set(
  (
    'aa ab ae af ak am an ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de ' +
    'dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ' +
    'ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu ' +
    'lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu ' +
    'rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ' +
    'ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu'
  ).split(' ')
);

const ISO_639_2 = new Set(['fil', 'haw', 'swb', 'tlh', 'zho', 'cmn', 'yue']);

/** Language codes that are also common folder/file suffixes (C#, F#, TypeScript, …). */
const AMBIGUOUS_LANG = new Set(['cs', 'fs', 'ts', 'as', 'ps']);

export interface ResxIdentity {
  /** Canonical BCP-47 tag, or empty for the invariant/neutral file. */
  locale: string;
  /** Resource name without culture suffix, e.g. Resources or Default.aspx */
  baseName: string;
  /** Directory used to group a family (parent of a culture folder, otherwise the file dir). */
  familyDir: string;
}

/**
 * Parse culture from a .resx file name + path.
 * Supports Resources.pt.resx, Resources.pt-PT.resx, pt.resx, and pt/Resources.resx
 * when the invariant sibling exists.
 *
 * @param allNormalizedPaths optional set of `normalizePathKey` paths for the workspace scan.
 *        Used to confirm folder-based cultures against an invariant sibling.
 */
export function resolveResxIdentity(filePath: string, allNormalizedPaths?: Set<string>): ResxIdentity {
  const normalized = filePath.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  const fileName = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  const dir = slash >= 0 ? normalized.slice(0, slash) : '';

  const i18nExt = i18nExtensionOf(fileName);
  if (i18nExt) {
    const base = fileName.slice(0, -(i18nExt.length + 1));
    const parentName = dir.slice(dir.lastIndexOf('/') + 1);
    const parentCulture = canonicalizeCulture(parentName);
    if (parentCulture) {
      const familyDir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
      return { locale: parentCulture, baseName: base, familyDir };
    }
  }

  const base = fileName.replace(/\.resx$/i, '');

  const suffix = cultureFromResourceBase(base, dir, allNormalizedPaths);
  if (suffix) {
    return { locale: suffix.locale, baseName: suffix.baseName, familyDir: dir };
  }

  const whole = canonicalizeCulture(base);
  if (whole) {
    return { locale: whole, baseName: '', familyDir: dir };
  }

  const parentName = dir.slice(dir.lastIndexOf('/') + 1);
  const parentCulture = canonicalizeCulture(parentName);
  const parentLang = parentCulture?.split('-')[0]?.toLowerCase() ?? '';
  if (parentCulture && !AMBIGUOUS_LANG.has(parentLang) && allNormalizedPaths) {
    const familyDir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
    const sibling = normalizePathKey(`${familyDir}/${base}.resx`);
    if (allNormalizedPaths.has(sibling)) {
      return { locale: parentCulture, baseName: base, familyDir };
    }
  }

  return { locale: '', baseName: base, familyDir: dir };
}

function cultureFromResourceBase(
  base: string,
  dir: string,
  allNormalizedPaths?: Set<string>
): { locale: string; baseName: string } | null {
  const lastDot = base.lastIndexOf('.');
  if (lastDot <= 0) {
    return null;
  }
  const raw = base.slice(lastDot + 1);
  const locale = canonicalizeCulture(raw);
  if (!locale) {
    return null;
  }
  const lang = locale.split('-')[0]?.toLowerCase() ?? '';
  if (AMBIGUOUS_LANG.has(lang)) {
    if (!allNormalizedPaths) {
      return null;
    }
    const sibling = normalizePathKey(`${dir}/${base.slice(0, lastDot)}.resx`);
    if (!allNormalizedPaths.has(sibling)) {
      return null;
    }
  }
  return { locale, baseName: base.slice(0, lastDot) };
}

const CONFIG_JSON_NAMES = new Set([
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'tsconfig.json',
  'jsconfig.json',
  'project.json',
  'composer.json',
  'turbo.json',
  'nx.json',
  'lerna.json',
  'angular.json',
  'nest-cli.json',
  'appsettings.json',
  'launch.json',
  'settings.json',
  'tasks.json',
  'extensions.json',
  'manifest.json',
  'components.json',
  'vercel.json',
  'firebase.json',
  'typedoc.json',
  'cypress.json',
  'resources.json',
  'cto-files.json',
]);

const I18N_DIR_NAMES = new Set([
  'locales',
  'locale',
  'i18n',
  'lang',
  'langs',
  'languages',
  'l10n',
  'translations',
]);

function fileNameOf(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

export function i18nExtensionOf(filePath: string): 'json' | 'i18n' | null {
  const fileName = fileNameOf(filePath).toLowerCase();
  if (fileName.endsWith('.json')) {
    return 'json';
  }
  if (fileName.endsWith('.i18n')) {
    return 'i18n';
  }
  return null;
}

export function isI18nFilePath(filePath: string): boolean {
  return i18nExtensionOf(filePath) !== null;
}

function isConfigJsonFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (CONFIG_JSON_NAMES.has(lower)) {
    return true;
  }
  if (lower.startsWith('.')) {
    return true;
  }
  if (lower.startsWith('tsconfig.') && lower.endsWith('.json')) {
    return true;
  }
  if (lower.startsWith('jsconfig.') && lower.endsWith('.json')) {
    return true;
  }
  if (lower.startsWith('appsettings.') && lower.endsWith('.json')) {
    return true;
  }
  return false;
}

function hasI18nLocaleSibling(
  normalizedPath: string,
  fileName: string,
  familyDir: string,
  locale: string,
  allNormalizedPaths: Set<string>
): boolean {
  const prefix = normalizePathKey(familyDir ? `${familyDir}/` : '');
  const suffix = `/${fileName.toLowerCase()}`;
  const self = normalizePathKey(normalizedPath);
  for (const other of allNormalizedPaths) {
    if (other === self || !other.endsWith(suffix)) {
      continue;
    }
    if (prefix && !other.startsWith(prefix)) {
      continue;
    }
    const rest = prefix ? other.slice(prefix.length) : other;
    const otherParent = rest.split('/')[0] ?? '';
    const otherCulture = canonicalizeCulture(otherParent);
    if (otherCulture && otherCulture !== locale) {
      return true;
    }
  }
  return false;
}

/**
 * True when a .json/.i18n file lives in a locale folder and is not a known config file.
 * Ambiguous folder names like `ts`/`cs` only count inside typical i18n directories,
 * or when a sibling locale file with the same name exists.
 */
export function isI18nResourcePath(filePath: string, allNormalizedPaths?: Set<string>): boolean {
  if (!isI18nFilePath(filePath)) {
    return false;
  }
  const fileName = fileNameOf(filePath);
  if (isConfigJsonFileName(fileName)) {
    return false;
  }
  const normalized = filePath.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  if (slash < 0) {
    return false;
  }
  const dir = normalized.slice(0, slash);
  const parentName = dir.slice(dir.lastIndexOf('/') + 1);
  const parentCulture = canonicalizeCulture(parentName);
  if (!parentCulture) {
    return false;
  }

  const familyDir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
  const familyDirName = familyDir.slice(familyDir.lastIndexOf('/') + 1);
  const lang = parentCulture.split('-')[0]?.toLowerCase() ?? '';
  if (AMBIGUOUS_LANG.has(lang) && !I18N_DIR_NAMES.has(familyDirName.toLowerCase())) {
    if (!allNormalizedPaths) {
      return false;
    }
    return hasI18nLocaleSibling(normalized, fileName, familyDir, parentCulture, allNormalizedPaths);
  }
  return true;
}

export function isI18nFamily(family: { basePath: string }): boolean {
  return isI18nFilePath(family.basePath);
}

export function canonicalizeCulture(raw: string): string | null {
  if (!raw) {
    return null;
  }
  const tag = raw.replace(/_/g, '-').trim();
  const lang = tag.split('-')[0]?.toLowerCase() ?? '';
  if (!ISO_639_1.has(lang) && !ISO_639_2.has(lang)) {
    return null;
  }
  try {
    return new Intl.Locale(tag).toString();
  } catch {
    return null;
  }
}

export function parseLocaleFromFileName(fileName: string): string {
  return resolveResxIdentity(fileName).locale;
}

export function getBaseName(fileName: string): string {
  const id = resolveResxIdentity(fileName);
  return id.baseName || fileName.replace(/\.resx$/i, '');
}

export function normalizePathKey(filePath: string): string {
  return filePath.replace(/\\/g, '/').toLowerCase();
}

/**
 * Convert a human string into a PascalCase C# identifier.
 * "Invalid resource file:" → "InvalidResourceFile"
 * Placeholders like {0} / {name} are ignored so they do not become "Hello0".
 */
export function toPascalCaseKey(input: string): string {
  if (!input) {
    return '';
  }

  const cleaned = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\{[^{}]+\}/g, ' ')
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

/**
 * Convert a human string into a camelCase i18n leaf identifier.
 * "Open settings" → "openSettings"
 */
export function toCamelCaseKey(input: string): string {
  const pascal = toPascalCaseKey(input);
  if (!pascal) {
    return '';
  }
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Suggested key for nested JSON i18n: keep the dotted path, replace only the leaf.
 * `welcome.message` + "Welcome to ResX Guard" → `welcome.welcomeToResXGuard`
 */
export function suggestedI18nKey(currentKey: string, neutralValue: string): string {
  const leaf = toCamelCaseKey(neutralValue);
  if (!leaf) {
    return '';
  }
  const lastDot = currentKey.lastIndexOf('.');
  if (lastDot > 0) {
    return `${currentKey.slice(0, lastDot)}.${leaf}`;
  }
  return leaf;
}

/** Extract format placeholders like {0}, {1}, {name}. */
export function extractPlaceholders(text: string): string[] {
  if (!text) {
    return [];
  }
  const matches = text.match(/\{[^{}]+\}/g);
  if (!matches) {
    return [];
  }
  return [...new Set(matches)].sort();
}

/**
 * Suffix used for "ends the same way" checks:
 * trailing whitespace + terminal punctuation (. ? ! : ; …)
 */
export function extractEndingSuffix(text: string): string {
  if (!text) {
    return '';
  }
  const match = text.match(/([\s]*[.?!…:;]+[\s]*|[ \t\r\n]+)$/);
  return match ? match[0] : '';
}

export function endingsMatch(neutral: string, translation: string): boolean {
  if (!translation) {
    return true;
  }
  return extractEndingSuffix(neutral) === extractEndingSuffix(translation);
}

export function placeholdersMatch(neutral: string, translation: string): boolean {
  if (!translation) {
    return true;
  }
  const a = extractPlaceholders(neutral);
  const b = extractPlaceholders(translation);
  if (a.length !== b.length) {
    return false;
  }
  return a.every((p, i) => p === b[i]);
}

export function normalizeSearch(text: string): string {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
