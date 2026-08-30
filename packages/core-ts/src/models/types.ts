/** Neutral/uncultured locale key used for base .resx files. */
export const NEUTRAL_LOCALE = '';

export type IssueSeverity = 'warning' | 'error' | 'hint' | 'info';

export type IssueRule =
  | 'keyPascalCase'
  | 'matchingSuffix'
  | 'placeholders'
  | 'missingTranslation'
  | 'duplicateKeys';

export interface ValidationIssue {
  rule: IssueRule;
  severity: IssueSeverity;
  message: string;
  locale?: string;
  key: string;
  familyId: string;
}

export interface ResxEntry {
  key: string;
  value: string;
  comment: string;
  /** Character offset of the <data> element in the file (best-effort). */
  offset?: number;
}

export interface ResxFile {
  path: string;
  /** Empty string for neutral/uncultured file. */
  locale: string;
  entries: ResxEntry[];
  /** Keys that appear more than once (parser-detected). */
  duplicateKeys: string[];
}

/** A base .resx + its satellite culture files. */
export interface ResxFamily {
  id: string;
  /** Absolute path of the neutral (or primary) .resx */
  basePath: string;
  /** Display name e.g. Properties/Resources */
  displayName: string;
  /** Project folder or workspace-relative project root */
  projectName: string;
  /** locale → absolute path */
  files: Record<string, string>;
}

export interface ResourceRow {
  familyId: string;
  key: string;
  comment: string;
  /** locale → value */
  values: Record<string, string>;
  issues: ValidationIssue[];
}

export interface ValidationRulesConfig {
  keyPascalCase: boolean;
  matchingSuffix: boolean;
  placeholders: boolean;
  missingTranslation: boolean;
  duplicateKeys: boolean;
}

export interface ExtensionSettings {
  neutralLocale: string;
  keyNaming: 'pascalFromNeutral' | 'manual';
  updateDesignerCs: boolean;
  visibleLocales: string[];
  rules: ValidationRulesConfig;
}

export interface TreeNode {
  id: string;
  label: string;
  kind: 'project' | 'folder' | 'family';
  children?: TreeNode[];
  familyId?: string;
  checked?: boolean;
}

export interface IndexSnapshot {
  families: ResxFamily[];
  rows: ResourceRow[];
  locales: string[];
  tree: TreeNode[];
  selectedFamilyIds: string[];
  visibleLocales: string[];
  settings: ExtensionSettings;
  language: string;
  version: string;
}

/** Messages: extension host ↔ webview */
export type HostToWebviewMessage =
  | { type: 'snapshot'; payload: IndexSnapshot }
  | { type: 'partialUpdate'; payload: Partial<IndexSnapshot> }
  | { type: 'error'; message: string };

export type WebviewToHostMessage =
  | { type: 'ready' }
  | { type: 'setSelectedFamilies'; familyIds: string[] }
  | { type: 'setVisibleLocales'; locales: string[] }
  | { type: 'updateCell'; familyId: string; key: string; locale: string; value: string }
  | { type: 'updateComment'; familyId: string; key: string; comment: string }
  | { type: 'addEntry'; familyId: string; key: string; neutralValue: string }
  | { type: 'deleteEntry'; familyId: string; key: string }
  | { type: 'renameKey'; familyId: string; oldKey: string; newKey: string }
  | { type: 'updateSettings'; settings: Partial<ExtensionSettings> }
  | { type: 'refresh' }
  | { type: 'openInEditor'; familyId: string; key: string; locale?: string }
  | { type: 'exportExcel' }
  | { type: 'importExcel' }
  | { type: 'openUrl'; url: string };
