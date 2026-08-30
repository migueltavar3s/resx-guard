using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EnvDTE;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Newtonsoft.Json.Linq;
using ResXGuard.Core;
using Task = System.Threading.Tasks.Task;

namespace ResXGuard;

public interface IWorkspaceService
{
    Task<IReadOnlyList<string>> FindResxFilesAsync(CancellationToken ct);
    IReadOnlyList<WorkspaceFolder> GetWorkspaceFolders();
    IReadOnlyList<string> GetWatchRoots();
}

public interface IDiagnosticsService
{
    void Publish(IReadOnlyList<ValidationIssue> issues);
}

public sealed class VsWorkspaceService : IWorkspaceService
{
    private const string SolutionFolderKind = "{66A26720-8FB5-11D2-AA7E-00C04F688DDE}";

    public async Task<IReadOnlyList<string>> FindResxFilesAsync(CancellationToken ct)
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(ct);
        var results = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var dte = (DTE?)Package.GetGlobalService(typeof(DTE));
        if (dte?.Solution == null)
            return results.ToList();

        foreach (Project project in dte.Solution.Projects)
            CollectResxFromProject(project, results);

        foreach (var root in GetWatchRoots())
            ScanDirectory(root, results);

        return results.Select(NormalizePath).ToList();
    }

    public IReadOnlyList<WorkspaceFolder> GetWorkspaceFolders()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        var dte = (DTE)Package.GetGlobalService(typeof(DTE));
        var solutionDir = Path.GetDirectoryName(dte?.Solution?.FullName ?? "") ?? "";
        var name = string.IsNullOrEmpty(solutionDir) ? "Solution" : Path.GetFileName(solutionDir);
        return new[] { new WorkspaceFolder { Name = name, FsPath = solutionDir } };
    }

    public IReadOnlyList<string> GetWatchRoots()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        var roots = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var dte = (DTE?)Package.GetGlobalService(typeof(DTE));
        if (dte?.Solution?.FullName is { Length: > 0 } solutionPath)
        {
            var solutionDir = Path.GetDirectoryName(solutionPath);
            if (!string.IsNullOrEmpty(solutionDir))
                roots.Add(solutionDir);
        }

        if (dte?.Solution != null)
        {
            foreach (Project project in dte.Solution.Projects)
                AddProjectRoot(project, roots);
        }

        return roots.ToList();
    }

    private static string NormalizePath(string path)
    {
        try { return Path.GetFullPath(path); }
        catch { return path; }
    }

    private static void AddProjectRoot(Project project, HashSet<string> roots)
    {
        if (project == null) return;
        try
        {
            if (IsSolutionFolder(project))
            {
                foreach (ProjectItem item in project.ProjectItems)
                {
                    if (item.SubProject != null)
                        AddProjectRoot(item.SubProject, roots);
                }
                return;
            }

            if (!string.IsNullOrEmpty(project.FullName))
            {
                var dir = Path.GetDirectoryName(project.FullName);
                if (!string.IsNullOrEmpty(dir))
                    roots.Add(dir);
            }
        }
        catch { /* unloaded */ }
    }

    private static bool IsSolutionFolder(Project project) =>
        string.Equals(project.Kind, SolutionFolderKind, StringComparison.OrdinalIgnoreCase);

    private static void CollectResxFromProject(Project project, HashSet<string> results)
    {
        if (project == null) return;
        try
        {
            if (IsSolutionFolder(project))
            {
                foreach (ProjectItem item in project.ProjectItems)
                {
                    if (item.SubProject != null)
                        CollectResxFromProject(item.SubProject, results);
                }
                return;
            }

            if (project.ProjectItems != null)
                WalkItems(project.ProjectItems, results);
        }
        catch { /* unloaded project */ }
    }

    private static void WalkItems(ProjectItems items, HashSet<string> results)
    {
        foreach (ProjectItem item in items)
        {
            try
            {
                if (item.FileCount > 0)
                {
                    var path = item.FileNames[0];
                    if (ResxFileNames.IsResxFile(path))
                        results.Add(NormalizePath(path));
                }
                if (item.ProjectItems != null && item.ProjectItems.Count > 0)
                    WalkItems(item.ProjectItems, results);
            }
            catch { /* skip item */ }
        }
    }

    private static void ScanDirectory(string root, HashSet<string> results)
    {
        if (!Directory.Exists(root))
            return;

        try
        {
            foreach (var file in Directory.EnumerateFiles(root, "*.resx", SearchOption.AllDirectories))
            {
                if (!ResxPaths.IsExcludedPath(file))
                    results.Add(NormalizePath(file));
            }
        }
        catch { /* skip unreadable tree */ }
    }
}

public sealed class VsErrorListService : IDiagnosticsService
{
    public void Publish(IReadOnlyList<ValidationIssue> issues) => _ = issues.Count;
}

public sealed class ResourceIndexHost : IDisposable
{
    private readonly ResXGuardPackage _package;
    private readonly IWorkspaceService _workspace;
    private readonly IDiagnosticsService _diagnostics;
    private readonly ResxFileWatcher _fileWatcher;
    private VsProjectDocumentsTracker? _docTracker;
    private System.Threading.Timer? _pollTimer;
    private string? _resxFingerprint;
    private readonly Dictionary<string, ResxFile> _fileCache = new(StringComparer.OrdinalIgnoreCase);
    private List<ResxFamily> _families = new();
    private List<ResourceRow> _rows = new();
    private List<string> _locales = new();
    private List<TreeNode> _tree = new();
    private HashSet<string> _selectedFamilyIds = new(StringComparer.Ordinal);
    private List<string> _visibleLocales = new();
    private ExtensionSettings _settings = ValidationEngine.DefaultSettings();
    private List<ValidationIssue> _issues = new();
    private System.Threading.Timer? _rescanTimer;
    private bool _updatingFromUs;

    public event EventHandler? Changed;

    public ResourceIndexHost(ResXGuardPackage package)
    {
        _package = package;
        _workspace = new VsWorkspaceService();
        _diagnostics = new VsErrorListService();
        _fileWatcher = new ResxFileWatcher(ScheduleRescan);
    }

    public async Task InitializeAsync(CancellationToken ct)
    {
        await RefreshAsync(ct).ConfigureAwait(false);
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(ct);
        _fileWatcher.UpdateWatchRoots(_workspace.GetWatchRoots());
        _resxFingerprint = await BuildFingerprintAsync(ct).ConfigureAwait(true);
        _docTracker = new VsProjectDocumentsTracker(ScheduleRescan);
        _docTracker.Advise();
        StartResxPolling();
        WireSolutionEvents();
    }

    private async Task<string> BuildFingerprintAsync(CancellationToken ct)
    {
        var files = await _workspace.FindResxFilesAsync(ct).ConfigureAwait(true);
        return string.Join("\n", files.OrderBy(f => f, StringComparer.OrdinalIgnoreCase));
    }

    private void StartResxPolling()
    {
        _pollTimer?.Dispose();
        _pollTimer = new System.Threading.Timer(_ =>
        {
            if (_updatingFromUs)
                return;

            ThreadHelper.JoinableTaskFactory.RunAsync(async () =>
            {
                try
                {
                    await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                    var fingerprint = await BuildFingerprintAsync(CancellationToken.None).ConfigureAwait(true);
                    if (string.Equals(fingerprint, _resxFingerprint, StringComparison.Ordinal))
                        return;

                    _resxFingerprint = fingerprint;
                    await RefreshAsync(CancellationToken.None).ConfigureAwait(true);
                }
                catch
                {
                    // Ignore transient DTE/polling errors.
                }
            });
        }, null, 1500, 1500);
    }

    private void NotifyChanged()
    {
        Changed?.Invoke(this, EventArgs.Empty);
    }

    private SolutionEvents? _solutionEvents;

    private void WireSolutionEvents()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (Package.GetGlobalService(typeof(DTE)) is not DTE dte)
            return;

        _solutionEvents = dte.Events.SolutionEvents;
        _solutionEvents.Opened += OnSolutionChanged;
        _solutionEvents.AfterClosing += OnSolutionClosed;
    }

    private void OnSolutionChanged()
    {
        _fileWatcher.UpdateWatchRoots(_workspace.GetWatchRoots());
        ScheduleRescan();
    }

    private void OnSolutionClosed()
    {
        _fileWatcher.UpdateWatchRoots(Array.Empty<string>());
        _families.Clear();
        _rows.Clear();
        _tree.Clear();
        _fileCache.Clear();
        NotifyChanged();
    }

    public async Task RefreshAsync(CancellationToken ct)
    {
        var files = await _workspace.FindResxFilesAsync(ct).ConfigureAwait(true);
        var previousFamilyIds = new HashSet<string>(_families.Select(f => f.Id), StringComparer.Ordinal);
        var scanned = WorkspaceScanner.GroupResxFiles(files, _workspace.GetWorkspaceFolders());
        _families = scanned.Families;
        _tree = scanned.Tree;
        _fileCache.Clear();

        var parseTasks = files.Select(async path =>
        {
            try
            {
                var parsed = await ResxParser.ParseResxFileAsync(path, ct).ConfigureAwait(false);
                lock (_fileCache) _fileCache[path] = parsed;
            }
            catch
            {
                var identity = Naming.ResolveResxIdentity(path);
                lock (_fileCache) _fileCache[path] = new ResxFile
                {
                    Path = path,
                    Locale = identity.Locale,
                    Entries = new List<ResxEntry>()
                };
            }
        });
        await Task.WhenAll(parseTasks).ConfigureAwait(false);

        ReconcileSelection(previousFamilyIds);
        RebuildRowsAndValidate();
        _fileWatcher.UpdateWatchRoots(_workspace.GetWatchRoots());
        _resxFingerprint = string.Join("\n", files.OrderBy(f => f, StringComparer.OrdinalIgnoreCase));
        NotifyChanged();
    }

    public IndexSnapshot GetSnapshot(string? language = null)
    {
        var selected = _selectedFamilyIds.Count > 0
            ? _selectedFamilyIds.ToList()
            : _families.Select(f => f.Id).ToList();
        var lang = language ?? System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
        return new IndexSnapshot
        {
            Families = _families,
            Rows = _rows.Where(r => selected.Contains(r.FamilyId)).ToList(),
            Locales = _locales,
            Tree = ApplyCheckedState(_tree),
            SelectedFamilyIds = selected,
            VisibleLocales = _visibleLocales.Count > 0 ? _visibleLocales : _locales,
            Settings = _settings,
            Language = lang.StartsWith("pt", StringComparison.OrdinalIgnoreCase) ? "pt" : "en",
            Version = VersionInfo.ExtensionVersion
        };
    }

    public async Task HandleMessageAsync(JObject msg, WebViewBridge bridge)
    {
        var type = msg["type"]?.ToString();
        switch (type)
        {
            case "refresh":
                await RefreshAsync(CancellationToken.None).ConfigureAwait(true);
                PostSnapshot(bridge);
                break;
            case "setSelectedFamilies":
                _selectedFamilyIds = new HashSet<string>(msg["familyIds"]?.ToObject<List<string>>() ?? new List<string>(), StringComparer.Ordinal);
                RebuildRowsAndValidate();
                PostSnapshot(bridge);
                break;
            case "setVisibleLocales":
                _visibleLocales = msg["locales"]?.ToObject<List<string>>() ?? new List<string>();
                PostSnapshot(bridge);
                break;
            case "updateCell":
                await UpdateCellAsync(
                    msg["familyId"]?.ToString() ?? "",
                    msg["key"]?.ToString() ?? "",
                    msg["locale"]?.ToString() ?? "",
                    msg["value"]?.ToString() ?? "").ConfigureAwait(true);
                PostSnapshot(bridge);
                break;
            case "updateComment":
                await UpdateCommentAsync(
                    msg["familyId"]?.ToString() ?? "",
                    msg["key"]?.ToString() ?? "",
                    msg["comment"]?.ToString() ?? "").ConfigureAwait(true);
                PostSnapshot(bridge);
                break;
            case "addEntry":
                await AddEntryAsync(
                    msg["familyId"]?.ToString() ?? "",
                    msg["key"]?.ToString() ?? "",
                    msg["neutralValue"]?.ToString() ?? "").ConfigureAwait(true);
                PostSnapshot(bridge);
                break;
            case "deleteEntry":
                await DeleteEntryAsync(
                    msg["familyId"]?.ToString() ?? "",
                    msg["key"]?.ToString() ?? "").ConfigureAwait(true);
                PostSnapshot(bridge);
                break;
            case "renameKey":
                await RenameKeyAsync(
                    msg["familyId"]?.ToString() ?? "",
                    msg["oldKey"]?.ToString() ?? "",
                    msg["newKey"]?.ToString() ?? "").ConfigureAwait(true);
                PostSnapshot(bridge);
                break;
            case "updateSettings":
                UpdateSettings(msg["settings"] as JObject);
                PostSnapshot(bridge);
                break;
            case "openInEditor":
                await OpenInEditorAsync(
                    msg["familyId"]?.ToString() ?? "",
                    msg["key"]?.ToString() ?? "",
                    msg["locale"]?.ToString()).ConfigureAwait(true);
                break;
            case "openUrl":
                var url = msg["url"]?.ToString();
                if (!string.IsNullOrEmpty(url))
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
                break;
            case "exportExcel":
            case "importExcel":
                PackageLog.Write("Excel import/export is not yet available in the Visual Studio extension.");
                break;
        }
    }

    private static void PostSnapshot(WebViewBridge bridge) =>
        bridge.Post(new { type = "snapshot", payload = ResXGuardPackage.Instance?.IndexHost?.GetSnapshot() });

    private async Task UpdateCellAsync(string familyId, string key, string locale, string value)
    {
        var family = _families.FirstOrDefault(f => f.Id == familyId);
        if (family == null) return;

        if (!family.Files.TryGetValue(locale, out var path))
        {
            path = ResxPaths.SatellitePath(family.BasePath, locale);
            family.Files[locale] = path;
        }

        _updatingFromUs = true;
        try
        {
            await ResxParser.SetResxValueAsync(path, key, value).ConfigureAwait(false);
            _fileCache[path] = await ResxParser.ParseResxFileAsync(path).ConfigureAwait(false);
            if (!_locales.Contains(locale))
                CollectLocales();
        }
        finally
        {
            _ = Task.Delay(400).ContinueWith(_ => _updatingFromUs = false);
        }

        RebuildRowsAndValidate();
        if (_settings.UpdateDesignerCs)
            await MaybeUpdateDesignerAsync(family).ConfigureAwait(false);
    }

    private async Task UpdateCommentAsync(string familyId, string key, string comment)
    {
        var family = _families.FirstOrDefault(f => f.Id == familyId);
        if (family == null) return;
        var path = family.Files.TryGetValue("", out var neutral) ? neutral : family.BasePath;
        _fileCache.TryGetValue(path, out var cached);
        var currentValue = cached?.Entries.FirstOrDefault(e => e.Key == key)?.Value ?? "";

        _updatingFromUs = true;
        try
        {
            await ResxParser.SetResxValueAsync(path, key, currentValue, comment).ConfigureAwait(false);
            _fileCache[path] = await ResxParser.ParseResxFileAsync(path).ConfigureAwait(false);
        }
        finally
        {
            _ = Task.Delay(400).ContinueWith(_ => _updatingFromUs = false);
        }

        RebuildRowsAndValidate();
    }

    private async Task AddEntryAsync(string familyId, string key, string neutralValue)
    {
        var family = _families.FirstOrDefault(f => f.Id == familyId);
        if (family == null) return;

        var finalKey = key.Trim();
        if (string.IsNullOrEmpty(finalKey) && _settings.KeyNaming == "pascalFromNeutral")
            finalKey = Naming.ToPascalCaseKey(neutralValue);
        if (string.IsNullOrEmpty(finalKey))
            finalKey = "NewKey";
        if (FamilyHasKey(family, finalKey))
            return;

        var filePath = family.Files.TryGetValue("", out var neutral) ? neutral : family.BasePath;
        _updatingFromUs = true;
        try
        {
            await ResxParser.AddResxEntryAsync(filePath, finalKey, neutralValue).ConfigureAwait(false);
            _fileCache[filePath] = await ResxParser.ParseResxFileAsync(filePath).ConfigureAwait(false);

            foreach (var kvp in family.Files.ToList())
            {
                var locale = kvp.Key;
                var satellitePath = kvp.Value;
                if (locale == "" || string.Equals(satellitePath, filePath, StringComparison.OrdinalIgnoreCase))
                    continue;
                await ResxParser.AddResxEntryAsync(satellitePath, finalKey, "").ConfigureAwait(false);
                _fileCache[satellitePath] = await ResxParser.ParseResxFileAsync(satellitePath).ConfigureAwait(false);
            }
        }
        finally
        {
            _ = Task.Delay(400).ContinueWith(_ => _updatingFromUs = false);
        }

        RebuildRowsAndValidate();
        if (_settings.UpdateDesignerCs)
            await MaybeUpdateDesignerAsync(family).ConfigureAwait(false);
    }

    private async Task DeleteEntryAsync(string familyId, string key)
    {
        var family = _families.FirstOrDefault(f => f.Id == familyId);
        if (family == null) return;

        _updatingFromUs = true;
        try
        {
            foreach (var filePath in family.Files.Values.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                await ResxParser.DeleteResxEntryAsync(filePath, key).ConfigureAwait(false);
                try
                {
                    _fileCache[filePath] = await ResxParser.ParseResxFileAsync(filePath).ConfigureAwait(false);
                }
                catch
                {
                    _fileCache.Remove(filePath);
                }
            }
        }
        finally
        {
            _ = Task.Delay(400).ContinueWith(_ => _updatingFromUs = false);
        }

        RebuildRowsAndValidate();
        if (_settings.UpdateDesignerCs)
            await MaybeUpdateDesignerAsync(family).ConfigureAwait(false);
    }

    private async Task RenameKeyAsync(string familyId, string oldKey, string newKey)
    {
        var family = _families.FirstOrDefault(f => f.Id == familyId);
        if (family == null || string.IsNullOrWhiteSpace(newKey) || oldKey == newKey)
            return;

        var trimmed = newKey.Trim();
        if (FamilyHasKey(family, trimmed))
            return;

        _updatingFromUs = true;
        try
        {
            foreach (var filePath in family.Files.Values.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                await ResxParser.RenameResxKeyAsync(filePath, oldKey, trimmed).ConfigureAwait(false);
                try
                {
                    _fileCache[filePath] = await ResxParser.ParseResxFileAsync(filePath).ConfigureAwait(false);
                }
                catch
                {
                    _fileCache.Remove(filePath);
                }
            }
        }
        finally
        {
            _ = Task.Delay(400).ContinueWith(_ => _updatingFromUs = false);
        }

        RebuildRowsAndValidate();
        if (_settings.UpdateDesignerCs)
            await MaybeUpdateDesignerAsync(family).ConfigureAwait(false);
    }

    private void UpdateSettings(JObject? partial)
    {
        if (partial == null) return;

        var keyNaming = partial["keyNaming"]?.ToString() ?? _settings.KeyNaming;
        var updateDesigner = partial["updateDesignerCs"]?.Type == JTokenType.Boolean
            ? partial["updateDesignerCs"]!.Value<bool>()
            : _settings.UpdateDesignerCs;
        var rules = _settings.Rules;
        if (partial["rules"] is JObject rulesPatch)
        {
            rules = new ValidationRulesConfig
            {
                KeyPascalCase = rulesPatch["keyPascalCase"]?.Value<bool>() ?? rules.KeyPascalCase,
                MatchingSuffix = rulesPatch["matchingSuffix"]?.Value<bool>() ?? rules.MatchingSuffix,
                Placeholders = rulesPatch["placeholders"]?.Value<bool>() ?? rules.Placeholders,
                MissingTranslation = rulesPatch["missingTranslation"]?.Value<bool>() ?? rules.MissingTranslation,
                DuplicateKeys = rulesPatch["duplicateKeys"]?.Value<bool>() ?? rules.DuplicateKeys,
            };
        }

        _settings = new ExtensionSettings
        {
            NeutralLocale = _settings.NeutralLocale,
            KeyNaming = keyNaming,
            UpdateDesignerCs = updateDesigner,
            VisibleLocales = _settings.VisibleLocales,
            Rules = rules,
        };

        if (partial["visibleLocales"] is JArray locales)
            _visibleLocales = locales.ToObject<List<string>>() ?? _visibleLocales;

        RebuildRowsAndValidate();
    }

    private async Task OpenInEditorAsync(string familyId, string key, string? locale)
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
        var family = _families.FirstOrDefault(f => f.Id == familyId);
        if (family == null) return;

        var loc = locale ?? "";
        var path = family.Files.TryGetValue(loc, out var filePath) ? filePath : family.BasePath;
        if (Package.GetGlobalService(typeof(DTE)) is not DTE dte)
            return;

        dte.ItemOperations.OpenFile(path);
        try
        {
            if (dte.ActiveDocument?.Selection is TextSelection selection)
                selection.FindText($"name=\"{key}\"", (int)vsFindOptions.vsFindOptionsMatchWholeWord);
        }
        catch { /* best effort */ }
    }

    private async Task MaybeUpdateDesignerAsync(ResxFamily family)
    {
        var neutralPath = family.Files.TryGetValue("", out var neutral) ? neutral : family.BasePath;
        var familyRows = _rows.Where(r => r.FamilyId == family.Id).ToList();
        var locales = family.Files.Keys.OrderBy(x => x, StringComparer.Ordinal).ToList();
        if (locales.Remove("")) locales.Insert(0, "");

        try
        {
            var meta = await DesignerGenerator.ResolveDesignerMetaAsync(neutralPath).ConfigureAwait(false);
            var entries = DesignerGenerator.BuildDesignerEntries(familyRows, locales);
            await DesignerGenerator.WriteDesignerCsAsync(meta.DesignerPath, new DesignerOptions
            {
                ClassName = meta.ClassName,
                Namespace = meta.Namespace,
                IsPublic = meta.IsPublic,
                ResourceBaseName = meta.ResourceBaseName,
                Entries = entries,
                Locales = locales,
            }).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            PackageLog.Write("Designer update failed: " + ex.Message);
        }
    }

    private bool FamilyHasKey(ResxFamily family, string key) =>
        _rows.Any(r => r.FamilyId == family.Id && r.Key == key);

    private void ReconcileSelection(HashSet<string> previousFamilyIds)
    {
        var existing = new HashSet<string>(_families.Select(f => f.Id), StringComparer.Ordinal);
        _selectedFamilyIds = new HashSet<string>(_selectedFamilyIds.Where(existing.Contains), StringComparer.Ordinal);
        foreach (var family in _families)
        {
            if (!previousFamilyIds.Contains(family.Id))
                _selectedFamilyIds.Add(family.Id);
        }
        if (_selectedFamilyIds.Count == 0)
        {
            foreach (var family in _families)
                _selectedFamilyIds.Add(family.Id);
        }
    }

    private void CollectLocales()
    {
        var localeSet = new HashSet<string>(StringComparer.Ordinal);
        foreach (var family in _families)
        {
            foreach (var locale in family.Files.Keys)
                localeSet.Add(locale);
        }
        _locales = localeSet.OrderBy(x => x, StringComparer.Ordinal).ToList();
        if (_locales.Remove("")) _locales.Insert(0, "");
        _visibleLocales = LocaleColumns.MergeVisibleLocales(_visibleLocales, _locales);
    }

    private ResxFile GetFamilyFile(ResxFamily family, string path)
    {
        if (_fileCache.TryGetValue(path, out var cached))
            return cached;

        var locale = family.Files.FirstOrDefault(kvp => string.Equals(kvp.Value, path, StringComparison.OrdinalIgnoreCase)).Key
            ?? Naming.ResolveResxIdentity(path).Locale;
        return new ResxFile { Path = path, Locale = locale, Entries = new List<ResxEntry>() };
    }

    private void RebuildRowsAndValidate()
    {
        var allRows = new List<ResourceRow>();
        _issues.Clear();
        foreach (var family in _families)
        {
            var files = family.Files.Values
                .Select(path => GetFamilyFile(family, path))
                .ToList();
            var rows = ValidationEngine.BuildRows(family, files);
            var issues = ValidationEngine.ValidateFamily(family, files, _settings.Rules);
            _issues.AddRange(issues);
            allRows.AddRange(ValidationEngine.AttachIssuesToRows(rows, issues));
        }
        _rows = allRows;
        CollectLocales();
        _diagnostics.Publish(_issues);
    }

    private List<TreeNode> ApplyCheckedState(List<TreeNode> nodes) =>
        nodes.Select(node =>
        {
            if (node.Kind == "family" && node.FamilyId != null)
                return new TreeNode { Kind = node.Kind, Label = node.Label, FamilyId = node.FamilyId, Checked = _selectedFamilyIds.Contains(node.FamilyId), Children = node.Children != null ? ApplyCheckedState(node.Children) : null };
            if (node.Children != null)
                return new TreeNode { Kind = node.Kind, Label = node.Label, FamilyId = node.FamilyId, Checked = node.Checked, Children = ApplyCheckedState(node.Children) };
            return node;
        }).ToList();

    public void ScheduleRescan()
    {
        if (_updatingFromUs)
            return;

        _rescanTimer?.Dispose();
        _rescanTimer = new System.Threading.Timer(_ =>
        {
            ThreadHelper.JoinableTaskFactory.RunAsync(async () =>
            {
                await RefreshAsync(CancellationToken.None).ConfigureAwait(true);
            });
        }, null, 180, Timeout.Infinite);
    }

    public void Dispose()
    {
        if (_solutionEvents != null)
        {
            _solutionEvents.Opened -= OnSolutionChanged;
            _solutionEvents.AfterClosing -= OnSolutionClosed;
        }
        _docTracker?.Dispose();
        _pollTimer?.Dispose();
        _rescanTimer?.Dispose();
        _fileWatcher.Dispose();
    }
}
