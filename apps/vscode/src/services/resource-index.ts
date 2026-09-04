import * as vscode from 'vscode';
import * as path from 'path';
import type {
  ExtensionSettings,
  IndexSnapshot,
  ResxFamily,
  ResxFile,
  ResourceRow,
  TreeNode,
  ValidationIssue,
} from '@resx-guard/core-ts';
import { NEUTRAL_LOCALE, EXTENSION_VERSION } from '@resx-guard/core-ts';
import {
  addResxEntry,
  deleteResxEntry,
  parseResxFile,
  renameResxKey,
  setResxComment,
  setResxValue,
  groupResxFiles,
  attachIssuesToRows,
  buildRows,
  defaultSettings,
  effectiveValidationRules,
  validateFamily,
  buildDesignerEntries,
  resolveDesignerMeta,
  writeDesignerCs,
  resolveResxIdentity,
  toPascalCaseKey,
  mergeVisibleLocales,
  buildExcelPayload,
  parseWorkbook,
  remapImportedLocales,
  resolveFamilyForImport,
  UsageIndex,
  isUsageSourcePath,
  type ExcelWorkbookPayload,
} from '@resx-guard/core-ts';

export class ResourceIndex {
  private families: ResxFamily[] = [];
  private fileCache = new Map<string, ResxFile>();
  private rows: ResourceRow[] = [];
  private locales: string[] = [];
  private tree: TreeNode[] = [];
  private selectedFamilyIds = new Set<string>();
  private visibleLocales: string[] = [];
  private settings: ExtensionSettings = defaultSettings();
  private issues: ValidationIssue[] = [];
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;
  private updatingFromUs = false;
  private readonly usageIndex = new UsageIndex();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly diagnostics: vscode.DiagnosticCollection
  ) {}

  get isUpdatingFromUs(): boolean {
    return this.updatingFromUs;
  }

  async refresh(): Promise<void> {
    await this.rescanWorkspace();
    this.rebuildRowsAndValidate();
    this.onDidChangeEmitter.fire();
  }

  async initialize(): Promise<void> {
    this.settings = this.readSettings();
    const stored = this.context.workspaceState.get<string[]>('selectedFamilyIds');
    const storedLocales = this.context.workspaceState.get<string[]>('visibleLocales');
    if (storedLocales) {
      this.visibleLocales = storedLocales;
    } else if (this.settings.visibleLocales.length > 0) {
      this.visibleLocales = [...this.settings.visibleLocales];
    }
    await this.fullScan();
    if (stored && stored.length > 0) {
      this.selectedFamilyIds = new Set(stored.filter((id) => this.families.some((f) => f.id === id)));
    }
    if (this.selectedFamilyIds.size === 0) {
      this.families.forEach((f) => this.selectedFamilyIds.add(f.id));
    }
    this.rebuildRowsAndValidate();
    this.onDidChangeEmitter.fire();
    void this.scanUsageWorkspace();
  }

  async fullScan(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
      this.families = [];
      this.tree = [];
      this.fileCache.clear();
      return;
    }

    const uris: vscode.Uri[] = [];
    for (const folder of folders) {
      const found = await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, '**/*.resx'),
        '{**/node_modules/**,**/bin/**,**/obj/**,**/.git/**}'
      );
      uris.push(...found);
    }

    const paths = uris.map((u) => u.fsPath);
    const scanned = groupResxFiles(
      paths,
      folders.map((f) => ({ name: f.name, uri: { fsPath: f.uri.fsPath } }))
    );
    this.families = scanned.families;
    this.tree = scanned.tree;

    this.fileCache.clear();
    await Promise.all(
      paths.map(async (p) => {
        try {
          const parsed = await parseResxFile(p);
          this.fileCache.set(path.normalize(p), parsed);
        } catch (err) {
          console.error('Failed to parse', p, err);
        }
      })
    );

    this.collectLocales();
    this.syncVisibleLocales();
  }

  private async rescanWorkspace(): Promise<void> {
    const previous = new Set(this.families.map((f) => f.id));
    await this.fullScan();
    this.reconcileSelection(previous);
  }

  private reconcileSelection(previousIds: Set<string>): void {
    const existing = new Set(this.families.map((f) => f.id));
    this.selectedFamilyIds = new Set(
      [...this.selectedFamilyIds].filter((id) => existing.has(id))
    );
    for (const family of this.families) {
      if (!previousIds.has(family.id)) {
        this.selectedFamilyIds.add(family.id);
      }
    }
    if (this.selectedFamilyIds.size === 0) {
      this.families.forEach((f) => this.selectedFamilyIds.add(f.id));
    }
    void this.context.workspaceState.update('selectedFamilyIds', [...this.selectedFamilyIds]);
  }

  private syncVisibleLocales(): void {
    this.visibleLocales = mergeVisibleLocales(this.visibleLocales, this.locales);
    void this.context.workspaceState.update('visibleLocales', this.visibleLocales);
  }

  async refreshFile(filePath: string): Promise<void> {
    if (this.updatingFromUs) {
      return;
    }
    const normalized = path.normalize(filePath);
    try {
      const parsed = await parseResxFile(normalized);
      this.fileCache.set(normalized, parsed);
    } catch {
      this.fileCache.delete(normalized);
      await this.rescanWorkspace();
      this.rebuildRowsAndValidate();
      this.onDidChangeEmitter.fire();
      return;
    }
    const inFamily = this.families.some((f) =>
      Object.values(f.files).some((p) => path.normalize(p) === normalized)
    );
    if (!inFamily) {
      await this.rescanWorkspace();
    } else {
      this.collectLocales();
      this.syncVisibleLocales();
    }
    this.rebuildRowsAndValidate();
    this.onDidChangeEmitter.fire();
  }

  async removeFile(filePath: string): Promise<void> {
    this.fileCache.delete(path.normalize(filePath));
    await this.rescanWorkspace();
    this.rebuildRowsAndValidate();
    this.onDidChangeEmitter.fire();
  }

  getSnapshot(language: string): IndexSnapshot {
    const selected = [...this.selectedFamilyIds];
    const filteredRows = this.rows.filter((r) => this.selectedFamilyIds.has(r.familyId));
    const tree = this.applyCheckedState(this.tree);

    return {
      families: this.families,
      rows: filteredRows,
      locales: this.locales,
      tree,
      selectedFamilyIds: selected,
      visibleLocales: this.visibleLocales,
      settings: this.settings,
      language,
      version: EXTENSION_VERSION,
    };
  }

  setSelectedFamilies(familyIds: string[]): void {
    this.selectedFamilyIds = new Set(familyIds);
    void this.context.workspaceState.update('selectedFamilyIds', familyIds);
    this.rebuildRowsAndValidate();
    this.onDidChangeEmitter.fire();
  }

  setVisibleLocales(locales: string[]): void {
    this.visibleLocales = locales;
    void this.context.workspaceState.update('visibleLocales', locales);
    this.onDidChangeEmitter.fire();
  }

  updateSettings(partial: Partial<ExtensionSettings>): void {
    const config = vscode.workspace.getConfiguration('resxGuard');
    if (partial.keyNaming !== undefined) {
      void config.update('keyNaming', partial.keyNaming, vscode.ConfigurationTarget.Workspace);
      this.settings.keyNaming = partial.keyNaming;
    }
    if (partial.updateDesignerCs !== undefined) {
      void config.update('updateDesignerCs', partial.updateDesignerCs, vscode.ConfigurationTarget.Workspace);
      this.settings.updateDesignerCs = partial.updateDesignerCs;
    }
    if (partial.namingSuggestions !== undefined) {
      void config.update('namingSuggestions', partial.namingSuggestions, vscode.ConfigurationTarget.Workspace);
      this.settings.namingSuggestions = partial.namingSuggestions;
    }
    if (partial.rules) {
      const rules = { ...this.settings.rules, ...partial.rules };
      this.settings.rules = rules;
      void config.update('rules.keyPascalCase', rules.keyPascalCase, vscode.ConfigurationTarget.Workspace);
      void config.update('rules.matchingSuffix', rules.matchingSuffix, vscode.ConfigurationTarget.Workspace);
      void config.update('rules.placeholders', rules.placeholders, vscode.ConfigurationTarget.Workspace);
      void config.update('rules.missingTranslation', rules.missingTranslation, vscode.ConfigurationTarget.Workspace);
      void config.update('rules.duplicateKeys', rules.duplicateKeys, vscode.ConfigurationTarget.Workspace);
    }
    if (partial.visibleLocales) {
      this.setVisibleLocales(partial.visibleLocales);
      return;
    }
    if (partial.rules || partial.keyNaming !== undefined) {
      this.rebuildRowsAndValidate();
    }
    this.onDidChangeEmitter.fire();
  }

  reloadSettingsFromConfig(): void {
    this.settings = this.readSettings();
    this.rebuildRowsAndValidate();
    this.onDidChangeEmitter.fire();
  }

  async updateCell(familyId: string, key: string, locale: string, value: string): Promise<void> {
    const family = this.families.find((f) => f.id === familyId);
    if (!family) {
      return;
    }
    let filePath = family.files[locale];
    if (!filePath) {
      // Create satellite path from base
      filePath = this.satellitePath(family.basePath, locale);
      family.files[locale] = filePath;
    }

    this.updatingFromUs = true;
    try {
      await setResxValue(filePath, key, value);
      const parsed = await parseResxFile(filePath);
      this.fileCache.set(path.normalize(filePath), parsed);
      if (!this.locales.includes(locale)) {
        this.collectLocales();
        this.syncVisibleLocales();
      }
    } finally {
      // Small delay before accepting external watcher events
      setTimeout(() => {
        this.updatingFromUs = false;
      }, 400);
    }

    this.rebuildRowsAndValidate();

    if (this.settings.updateDesignerCs) {
      await this.maybeUpdateDesigner(family);
    }

    this.onDidChangeEmitter.fire();
  }

  async updateComment(familyId: string, key: string, comment: string): Promise<void> {
    const family = this.families.find((f) => f.id === familyId);
    if (!family) {
      return;
    }
    const filePath = family.files[NEUTRAL_LOCALE] ?? family.basePath;
    this.updatingFromUs = true;
    try {
      await setResxComment(filePath, key, comment);
      const parsed = await parseResxFile(filePath);
      this.fileCache.set(path.normalize(filePath), parsed);
    } finally {
      setTimeout(() => {
        this.updatingFromUs = false;
      }, 400);
    }
    this.rebuildRowsAndValidate();
    this.onDidChangeEmitter.fire();
  }

  async addEntry(familyId: string, key: string, neutralValue: string): Promise<void> {
    const family = this.families.find((f) => f.id === familyId);
    if (!family) {
      return;
    }
    let finalKey = key.trim();
    if (!finalKey && this.settings.keyNaming === 'pascalFromNeutral') {
      finalKey = toPascalCaseKey(neutralValue);
    }
    if (!finalKey) {
      finalKey = 'NewKey';
    }
    if (this.familyHasKey(family, finalKey)) {
      throw new Error(`Key "${finalKey}" already exists in ${family.displayName}`);
    }

    const filePath = family.files[NEUTRAL_LOCALE] ?? family.basePath;
    this.updatingFromUs = true;
    try {
      await addResxEntry(filePath, finalKey, neutralValue);
      const parsed = await parseResxFile(filePath);
      this.fileCache.set(path.normalize(filePath), parsed);

      for (const [locale, satellitePath] of Object.entries(family.files)) {
        if (locale === NEUTRAL_LOCALE || satellitePath === filePath) {
          continue;
        }
        await addResxEntry(satellitePath, finalKey, '');
        const satellite = await parseResxFile(satellitePath);
        this.fileCache.set(path.normalize(satellitePath), satellite);
      }
    } finally {
      setTimeout(() => {
        this.updatingFromUs = false;
      }, 400);
    }

    this.rebuildRowsAndValidate();
    if (this.settings.updateDesignerCs) {
      await this.maybeUpdateDesigner(family);
    }
    this.onDidChangeEmitter.fire();
  }

  async deleteEntry(familyId: string, key: string): Promise<void> {
    const family = this.families.find((f) => f.id === familyId);
    if (!family) {
      return;
    }
    this.updatingFromUs = true;
    try {
      for (const filePath of Object.values(family.files)) {
        await deleteResxEntry(filePath, key);
        try {
          const parsed = await parseResxFile(filePath);
          this.fileCache.set(path.normalize(filePath), parsed);
        } catch {
          /* ignore */
        }
      }
    } finally {
      setTimeout(() => {
        this.updatingFromUs = false;
      }, 400);
    }
    this.rebuildRowsAndValidate();
    if (this.settings.updateDesignerCs) {
      await this.maybeUpdateDesigner(family);
    }
    this.onDidChangeEmitter.fire();
  }

  async renameKey(familyId: string, oldKey: string, newKey: string): Promise<void> {
    const family = this.families.find((f) => f.id === familyId);
    if (!family || !newKey.trim() || oldKey === newKey) {
      return;
    }
    const trimmed = newKey.trim();
    if (this.familyHasKey(family, trimmed)) {
      throw new Error(`Key "${trimmed}" already exists in ${family.displayName}`);
    }
    this.updatingFromUs = true;
    try {
      for (const filePath of Object.values(family.files)) {
        await renameResxKey(filePath, oldKey, trimmed);
        try {
          const parsed = await parseResxFile(filePath);
          this.fileCache.set(path.normalize(filePath), parsed);
        } catch {
          /* ignore */
        }
      }
    } finally {
      setTimeout(() => {
        this.updatingFromUs = false;
      }, 400);
    }
    this.rebuildRowsAndValidate();
    if (this.settings.updateDesignerCs) {
      await this.maybeUpdateDesigner(family);
    }
    this.onDidChangeEmitter.fire();
  }

  async openInEditor(familyId: string, key: string, locale?: string): Promise<void> {
    const family = this.families.find((f) => f.id === familyId);
    if (!family) {
      return;
    }
    const loc = locale ?? NEUTRAL_LOCALE;
    const filePath = family.files[loc] ?? family.basePath;
    const doc = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(doc, { preview: true });
    const text = doc.getText();
    const needle = `name="${key}"`;
    const idx = text.indexOf(needle);
    if (idx >= 0) {
      const pos = doc.positionAt(idx);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos));
    }
  }

  getExcelPayload(): ExcelWorkbookPayload {
    const ids =
      this.selectedFamilyIds.size > 0
        ? this.selectedFamilyIds
        : new Set(this.families.map((f) => f.id));
    return buildExcelPayload(
      this.families.filter((f) => ids.has(f.id)),
      this.rows.filter((r) => ids.has(r.familyId)),
      this.locales
    );
  }

  async importExcelBuffer(buffer: Buffer): Promise<{ created: number; updated: number; skipped: number }> {
    const payload = parseWorkbook(buffer);
    return this.importExcelPayload(payload);
  }

  async importExcelPayload(
    payload: ExcelWorkbookPayload
  ): Promise<{ created: number; updated: number; skipped: number }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const touched = new Set<string>();

    this.updatingFromUs = true;
    try {
      for (const row of payload.rows) {
        const family = resolveFamilyForImport(this.families, row.resource, this.selectedFamilyIds);
        if (!family || !row.key.trim()) {
          skipped += 1;
          continue;
        }
        const key = row.key.trim();
        const values = remapImportedLocales(row.values, Object.keys(family.files));
        const exists = this.familyHasKey(family, key);
        if (!exists) {
          await this.writeKeyToFamily(family, key, values, row.comment);
          created += 1;
        } else {
          await this.mergeKeyValues(family, key, values);
          if (row.comment) {
            const filePath = family.files[NEUTRAL_LOCALE] ?? family.basePath;
            await setResxComment(filePath, key, row.comment);
          }
          updated += 1;
        }
        touched.add(family.id);
        await this.reloadFamilyFiles(family);
      }
    } finally {
      setTimeout(() => {
        this.updatingFromUs = false;
      }, 400);
    }

    this.collectLocales();
    this.syncVisibleLocales();
    this.rebuildRowsAndValidate();
    if (this.settings.updateDesignerCs) {
      for (const family of this.families) {
        if (touched.has(family.id)) {
          await this.maybeUpdateDesigner(family);
        }
      }
    }
    this.onDidChangeEmitter.fire();
    return { created, updated, skipped };
  }

  private async writeKeyToFamily(
    family: ResxFamily,
    key: string,
    values: Record<string, string>,
    comment = ''
  ): Promise<void> {
    const locales = new Set([...Object.keys(family.files), ...Object.keys(values)]);
    const neutralPath = this.ensureLocalePath(family, NEUTRAL_LOCALE);
    await addResxEntry(neutralPath, key, values[NEUTRAL_LOCALE] ?? '', comment);
    for (const locale of locales) {
      if (locale === NEUTRAL_LOCALE) {
        continue;
      }
      const filePath = this.ensureLocalePath(family, locale);
      await addResxEntry(filePath, key, values[locale] ?? '');
    }
  }

  private async mergeKeyValues(
    family: ResxFamily,
    key: string,
    values: Record<string, string>
  ): Promise<void> {
    for (const [locale, value] of Object.entries(values)) {
      if (value === '') {
        continue;
      }
      const filePath = this.ensureLocalePath(family, locale);
      await setResxValue(filePath, key, value);
    }
  }

  private ensureLocalePath(family: ResxFamily, locale: string): string {
    if (locale === NEUTRAL_LOCALE || locale === '') {
      return family.files[NEUTRAL_LOCALE] ?? family.basePath;
    }
    let filePath = family.files[locale];
    if (!filePath) {
      filePath = this.satellitePath(family.basePath, locale);
      family.files[locale] = filePath;
    }
    return filePath;
  }

  private async reloadFamilyFiles(family: ResxFamily): Promise<void> {
    for (const filePath of Object.values(family.files)) {
      try {
        const parsed = await parseResxFile(filePath);
        this.fileCache.set(path.normalize(filePath), parsed);
      } catch {
        /* ignore */
      }
    }
  }

  private familyHasKey(family: ResxFamily, key: string): boolean {
    if (this.rows.some((row) => row.familyId === family.id && row.key === key)) {
      return true;
    }
    const filePath = family.files[NEUTRAL_LOCALE] ?? family.basePath;
    const cached = this.fileCache.get(path.normalize(filePath));
    return cached?.entries.some((entry) => entry.key === key) ?? false;
  }

  private async maybeUpdateDesigner(family: ResxFamily): Promise<void> {
    const neutralPath = family.files[NEUTRAL_LOCALE] ?? family.basePath;
    const files: ResxFile[] = [];
    for (const [locale, filePath] of Object.entries(family.files)) {
      const cached = this.fileCache.get(path.normalize(filePath));
      if (cached) {
        files.push({ ...cached, locale });
      }
    }
    if (files.length === 0) {
      return;
    }
    try {
      const meta = await resolveDesignerMeta(neutralPath);
      const locales = [...new Set(files.map((f) => f.locale))].sort((a, b) => {
        if (a === NEUTRAL_LOCALE) {
          return -1;
        }
        if (b === NEUTRAL_LOCALE) {
          return 1;
        }
        return a.localeCompare(b);
      });
      await writeDesignerCs(meta.designerPath, {
        className: meta.className,
        namespace: meta.namespace,
        isPublic: meta.isPublic,
        resourceBaseName: meta.resourceBaseName,
        entries: buildDesignerEntries(files),
        locales,
      });
    } catch (err) {
      console.error('Designer update failed', err);
    }
  }

  private rebuildRowsAndValidate(): void {
    const allRows: ResourceRow[] = [];
    const allIssues: ValidationIssue[] = [];

    for (const family of this.families) {
      const files: ResxFile[] = [];
      for (const [locale, filePath] of Object.entries(family.files)) {
        const cached = this.fileCache.get(path.normalize(filePath));
        files.push({
          path: cached?.path ?? filePath,
          locale,
          entries: cached?.entries ?? [],
          duplicateKeys: cached?.duplicateKeys ?? [],
        });
      }
      const rows = buildRows(family, files);
      const issues = validateFamily(
        family,
        files,
        effectiveValidationRules(this.settings.rules, this.settings.keyNaming)
      );
      allIssues.push(...issues);
      allRows.push(...attachIssuesToRows(rows, issues));
    }

    this.rows = allRows.map((row) => ({
      ...row,
      usageCount: this.usageIndex.count(row.key),
    }));
    this.issues = allIssues;
    this.publishDiagnostics();
  }

  async scanUsageWorkspace(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    this.usageIndex.clear();
    if (folders.length === 0) {
      this.applyUsageCounts();
      this.onDidChangeEmitter.fire();
      return;
    }

    const uris: vscode.Uri[] = [];
    for (const folder of folders) {
      const found = await vscode.workspace.findFiles(
        new vscode.RelativePattern(
          folder,
          '**/*.{cs,cshtml,razor,vb,js,jsx,ts,tsx,html,aspx,ascx,master,vue}'
        ),
        '{**/node_modules/**,**/bin/**,**/obj/**,**/.git/**,**/.vs/**,**/*.Designer.cs}'
      );
      uris.push(...found);
    }

    await Promise.all(
      uris.map(async (uri) => {
        if (!isUsageSourcePath(uri.fsPath)) {
          return;
        }
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          this.usageIndex.indexFile(uri.fsPath, Buffer.from(bytes).toString('utf8'));
        } catch {
          /* unreadable */
        }
      })
    );
    this.applyUsageCounts();
    this.onDidChangeEmitter.fire();
  }

  async refreshUsageFile(filePath: string): Promise<void> {
    if (!isUsageSourcePath(filePath)) {
      return;
    }
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      this.usageIndex.indexFile(filePath, Buffer.from(bytes).toString('utf8'));
    } catch {
      this.usageIndex.removeFile(filePath);
    }
    this.applyUsageCounts();
    this.onDidChangeEmitter.fire();
  }

  refreshUsageText(filePath: string, text: string): void {
    if (!isUsageSourcePath(filePath)) {
      return;
    }
    this.usageIndex.indexFile(filePath, text);
    this.applyUsageCounts();
    this.onDidChangeEmitter.fire();
  }

  removeUsageFile(filePath: string): void {
    this.usageIndex.removeFile(filePath);
    this.applyUsageCounts();
    this.onDidChangeEmitter.fire();
  }

  private applyUsageCounts(): void {
    this.rows = this.rows.map((row) => ({
      ...row,
      usageCount: this.usageIndex.count(row.key),
    }));
  }

  private publishDiagnostics(): void {
    this.diagnostics.clear();
    const byFile = new Map<string, vscode.Diagnostic[]>();

    for (const issue of this.issues) {
      const family = this.families.find((f) => f.id === issue.familyId);
      if (!family) {
        continue;
      }
      const locale = issue.locale ?? NEUTRAL_LOCALE;
      const filePath = family.files[locale] ?? family.basePath;
      const severity =
        issue.severity === 'error'
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning;

      const diag = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        `[${issue.key}] ${issue.message}`,
        severity
      );
      diag.source = 'ResX Guard';
      diag.code = issue.rule;

      const list = byFile.get(filePath) ?? [];
      list.push(diag);
      byFile.set(filePath, list);
    }

    for (const [filePath, diags] of byFile) {
      this.diagnostics.set(vscode.Uri.file(filePath), diags);
    }
  }

  private collectLocales(): void {
    const set = new Set<string>();
    for (const family of this.families) {
      for (const locale of Object.keys(family.files)) {
        set.add(locale);
      }
    }
    // Neutral first
    const list = [...set].sort((a, b) => {
      if (a === NEUTRAL_LOCALE) {
        return -1;
      }
      if (b === NEUTRAL_LOCALE) {
        return 1;
      }
      return a.localeCompare(b);
    });
    this.locales = list;
  }

  private satellitePath(basePath: string, locale: string): string {
    if (!locale) {
      return basePath;
    }
    const dir = path.dirname(basePath);
    const identity = resolveResxIdentity(basePath);
    if (!identity.baseName) {
      return path.join(dir, `${locale}.resx`);
    }
    return path.join(dir, `${identity.baseName}.${locale}.resx`);
  }

  private readSettings(): ExtensionSettings {
    const config = vscode.workspace.getConfiguration('resxGuard');
    return {
      neutralLocale: config.get<string>('neutralLocale', ''),
      keyNaming: config.get<'pascalFromNeutral' | 'manual'>('keyNaming', 'pascalFromNeutral'),
      updateDesignerCs: config.get<boolean>('updateDesignerCs', true),
      namingSuggestions: config.get<boolean>('namingSuggestions', true),
      visibleLocales: config.get<string[]>('visibleLocales', []),
      rules: {
        keyPascalCase: config.get<boolean>('rules.keyPascalCase', true),
        matchingSuffix: config.get<boolean>('rules.matchingSuffix', true),
        placeholders: config.get<boolean>('rules.placeholders', true),
        missingTranslation: config.get<boolean>('rules.missingTranslation', true),
        duplicateKeys: config.get<boolean>('rules.duplicateKeys', true),
      },
    };
  }

  private applyCheckedState(nodes: TreeNode[]): TreeNode[] {
    return nodes.map((node) => {
      if (node.kind === 'family' && node.familyId) {
        return { ...node, checked: this.selectedFamilyIds.has(node.familyId) };
      }
      if (node.children) {
        return { ...node, children: this.applyCheckedState(node.children) };
      }
      return node;
    });
  }
}
