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
}

public interface IDiagnosticsService
{
    void Publish(IReadOnlyList<ValidationIssue> issues);
}

public sealed class VsWorkspaceService : IWorkspaceService
{
    public async Task<IReadOnlyList<string>> FindResxFilesAsync(CancellationToken ct)
    {
        await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(ct);
        var dte = (DTE?)Package.GetGlobalService(typeof(DTE));
        var results = new List<string>();
        if (dte?.Solution == null) return results;
        foreach (Project project in dte.Solution.Projects)
            CollectResx(project, results);
        return results.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static void CollectResx(Project project, List<string> results)
    {
        if (project == null) return;
        try
        {
            if (project.ProjectItems != null)
                WalkItems(project.ProjectItems, results);
        }
        catch { /* unloaded project */ }
    }

    private static void WalkItems(ProjectItems items, List<string> results)
    {
        foreach (ProjectItem item in items)
        {
            try
            {
                if (item.FileCount > 0)
                {
                    var path = item.FileNames[0];
                    if (path.EndsWith(".resx", StringComparison.OrdinalIgnoreCase))
                        results.Add(path);
                }
                if (item.ProjectItems != null && item.ProjectItems.Count > 0)
                    WalkItems(item.ProjectItems, results);
            }
            catch { /* skip item */ }
        }
    }

    public IReadOnlyList<WorkspaceFolder> GetWorkspaceFolders()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        var dte = (DTE)Package.GetGlobalService(typeof(DTE));
        var solutionDir = Path.GetDirectoryName(dte?.Solution?.FullName ?? "") ?? "";
        var name = string.IsNullOrEmpty(solutionDir) ? "Solution" : Path.GetFileName(solutionDir);
        return new[] { new WorkspaceFolder { Name = name, FsPath = solutionDir } };
    }
}

public sealed class VsErrorListService : IDiagnosticsService
{
    public void Publish(IReadOnlyList<ValidationIssue> issues)
    {
        // Error List integration: tasks are published when full IVsBuildErrorList wiring is added.
        _ = issues.Count;
    }
}

public sealed class ResourceIndexHost : IDisposable
{
    private readonly ResXGuardPackage _package;
    private readonly IWorkspaceService _workspace;
    private readonly IDiagnosticsService _diagnostics;
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

    public ResourceIndexHost(ResXGuardPackage package)
    {
        _package = package;
        _workspace = new VsWorkspaceService();
        _diagnostics = new VsErrorListService();
    }

    public async Task InitializeAsync(CancellationToken ct)
    {
        await RefreshAsync(ct).ConfigureAwait(false);
    }

    public async Task RefreshAsync(CancellationToken ct)
    {
        var files = await _workspace.FindResxFilesAsync(ct).ConfigureAwait(false);
        var scanned = WorkspaceScanner.GroupResxFiles(files, _workspace.GetWorkspaceFolders());
        _families = scanned.Families;
        _tree = scanned.Tree;
        _fileCache.Clear();
        var parseTasks = files.Select(async path =>
        {
            var parsed = await ResxParser.ParseResxFileAsync(path, ct).ConfigureAwait(false);
            lock (_fileCache) _fileCache[path] = parsed;
        });
        await Task.WhenAll(parseTasks).ConfigureAwait(false);
        RebuildRowsAndValidate();
    }

    public IndexSnapshot GetSnapshot(string language)
    {
        var selected = _selectedFamilyIds.Count > 0
            ? _selectedFamilyIds.ToList()
            : _families.Select(f => f.Id).ToList();
        return new IndexSnapshot
        {
            Families = _families,
            Rows = _rows,
            Locales = _locales,
            Tree = _tree,
            SelectedFamilyIds = selected,
            VisibleLocales = _visibleLocales.Count > 0 ? _visibleLocales : _locales,
            Settings = _settings,
            Language = language.StartsWith("pt", StringComparison.OrdinalIgnoreCase) ? "pt" : "en",
            Version = VersionInfo.ExtensionVersion
        };
    }

    public async Task HandleMessageAsync(JObject msg, WebViewBridge bridge)
    {
        var type = msg["type"]?.ToString();
        switch (type)
        {
            case "refresh":
                await RefreshAsync(CancellationToken.None).ConfigureAwait(false);
                bridge.Post(new { type = "snapshot", payload = GetSnapshot("en") });
                break;
            case "setSelectedFamilies":
                _selectedFamilyIds = new HashSet<string>(msg["familyIds"]?.ToObject<List<string>>() ?? new List<string>(), StringComparer.Ordinal);
                RebuildRowsAndValidate();
                bridge.Post(new { type = "snapshot", payload = GetSnapshot("en") });
                break;
            case "setVisibleLocales":
                _visibleLocales = msg["locales"]?.ToObject<List<string>>() ?? new List<string>();
                bridge.Post(new { type = "snapshot", payload = GetSnapshot("en") });
                break;
            case "updateCell":
                await UpdateCellAsync(
                    msg["familyId"]?.ToString() ?? "",
                    msg["key"]?.ToString() ?? "",
                    msg["locale"]?.ToString() ?? "",
                    msg["value"]?.ToString() ?? "").ConfigureAwait(false);
                bridge.Post(new { type = "snapshot", payload = GetSnapshot("en") });
                break;
            case "openUrl":
                var url = msg["url"]?.ToString();
                if (!string.IsNullOrEmpty(url))
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
                break;
        }
    }

    private async Task UpdateCellAsync(string familyId, string key, string locale, string value)
    {
        var family = _families.FirstOrDefault(f => f.Id == familyId);
        if (family == null || !family.Files.TryGetValue(locale, out var path)) return;
        await ResxParser.SetResxValueAsync(path, key, value).ConfigureAwait(false);
        _fileCache[path] = await ResxParser.ParseResxFileAsync(path).ConfigureAwait(false);
        RebuildRowsAndValidate();
    }

    private void RebuildRowsAndValidate()
    {
        var selectedFamilies = _families.Where(f => _selectedFamilyIds.Count == 0 || _selectedFamilyIds.Contains(f.Id)).ToList();
        var localeSet = new HashSet<string>(StringComparer.Ordinal);
        var allRows = new List<ResourceRow>();
        _issues.Clear();
        foreach (var family in selectedFamilies)
        {
            var files = family.Files.Values
                .Where(p => _fileCache.ContainsKey(p))
                .Select(p => _fileCache[p])
                .ToList();
            foreach (var f in files) localeSet.Add(f.Locale);
            var rows = ValidationEngine.BuildRows(family, files);
            var issues = ValidationEngine.ValidateFamily(family, files, _settings.Rules);
            _issues.AddRange(issues);
            allRows.AddRange(ValidationEngine.AttachIssuesToRows(rows, issues));
        }
        _locales = localeSet.OrderBy(x => x, StringComparer.Ordinal).ToList();
        if (_locales.Remove("")) _locales.Insert(0, "");
        _visibleLocales = LocaleColumns.MergeVisibleLocales(_visibleLocales, _locales);
        _rows = allRows;
        _diagnostics.Publish(_issues);
    }

    public void ScheduleRescan()
    {
        _rescanTimer?.Dispose();
        _rescanTimer = new System.Threading.Timer(_ =>
        {
            ThreadHelper.JoinableTaskFactory.Run(async () =>
            {
                await RefreshAsync(CancellationToken.None).ConfigureAwait(true);
                await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                (_package.FindToolWindow(typeof(ResxGuardToolWindow), 0, false) as ResxGuardToolWindow)?.PostSnapshot();
            });
        }, null, 180, Timeout.Infinite);
    }

    public void Dispose()
    {
        _rescanTimer?.Dispose();
    }
}
