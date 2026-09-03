using System;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using ResXGuard.Core;

namespace ResXGuard;

/// <summary>
/// Fires when Visual Studio adds, removes, or renames project files (more reliable than FileSystemWatcher on OneDrive).
/// </summary>
internal sealed class VsProjectDocumentsTracker : IVsTrackProjectDocumentsEvents2, IDisposable
{
    private readonly Action _onResxChanged;
    private readonly Action<string>? _onSourceFileChanged;
    private uint _cookie;
    private IVsTrackProjectDocuments2? _trackDocuments;

    public VsProjectDocumentsTracker(Action onResxChanged, Action<string>? onSourceFileChanged = null)
    {
        _onResxChanged = onResxChanged;
        _onSourceFileChanged = onSourceFileChanged;
    }

    public void Advise()
    {
        ThreadHelper.ThrowIfNotOnUIThread();
        if (Package.GetGlobalService(typeof(SVsTrackProjectDocuments)) is not IVsTrackProjectDocuments2 trackDocuments)
            return;

        _trackDocuments = trackDocuments;
        ErrorHandler.ThrowOnFailure(trackDocuments.AdviseTrackProjectDocumentsEvents(this, out _cookie));
    }

    public void Dispose()
    {
        if (_trackDocuments != null && _cookie != 0)
        {
            try { _trackDocuments.UnadviseTrackProjectDocumentsEvents(_cookie); } catch { /* ignore */ }
            _cookie = 0;
        }
    }

    public int OnAfterAddFilesEx(int cProjects, int cFiles, IVsProject[]? rgpProjects, int[]? rgFirstIndices, string[]? rgpszMkDocuments, VSADDFILEFLAGS[]? rgFlags)
    {
        NotifyIfAnyResx(rgpszMkDocuments);
        return VSConstants.S_OK;
    }

    public int OnAfterRemoveFiles(int cProjects, int cFiles, IVsProject[]? rgpProjects, int[]? rgFirstIndices, string[]? rgpszMkDocuments, VSREMOVEFILEFLAGS[]? rgFlags)
    {
        NotifyIfAnyResx(rgpszMkDocuments);
        return VSConstants.S_OK;
    }

    public int OnAfterRenameFiles(int cProjects, int cFiles, IVsProject[]? rgpProjects, int[]? rgFirstIndices, string[]? rgpszMkDocuments, string[]? rgpszMkDocumentsNew, VSRENAMEFILEFLAGS[]? rgFlags)
    {
        NotifyIfAnyResx(rgpszMkDocuments);
        NotifyIfAnyResx(rgpszMkDocumentsNew);
        return VSConstants.S_OK;
    }

    public int OnAfterSave(string pszMkDocument)
    {
        if (ResxFileNames.IsResxFile(pszMkDocument))
            _onResxChanged();
        else if (UsagePaths.IsUsageSourcePath(pszMkDocument))
            _onSourceFileChanged?.Invoke(pszMkDocument);
        return VSConstants.S_OK;
    }

    public int OnAfterSaveAll() => VSConstants.S_OK;
    public int OnBeforeSave(string pszMkDocument) => VSConstants.S_OK;
    public int OnBeforeSaveAll() => VSConstants.S_OK;
    public int OnAfterSynchronize(string? pszMkDocument) => VSConstants.S_OK;
    public int OnAfterAddDirectoriesEx(int cProjects, int cDirectories, IVsProject[]? rgpProjects, int[]? rgFirstIndices, string[]? rgpszMkDocuments, VSADDDIRECTORYFLAGS[]? rgFlags) => VSConstants.S_OK;
    public int OnAfterRemoveDirectories(int cProjects, int cDirectories, IVsProject[]? rgpProjects, int[]? rgFirstIndices, string[]? rgpszMkDocuments, VSREMOVEDIRECTORYFLAGS[]? rgFlags) => VSConstants.S_OK;
    public int OnAfterRenameDirectories(int cProjects, int cDirectories, IVsProject[]? rgpProjects, int[]? rgFirstIndices, string[]? rgpszMkDocuments, string[]? rgpszMkDocumentsNew, VSRENAMEDIRECTORYFLAGS[]? rgFlags) => VSConstants.S_OK;
    public int OnAfterRenameFileEx(int cProjects, int cFiles, IVsProject[]? rgpProjects, int[]? rgFirstIndices, string[]? rgpszMkOldDocuments, string[]? rgpszMkNewDocuments, int[]? rgFlags) => OnAfterRenameFiles(cProjects, cFiles, rgpProjects, rgFirstIndices, rgpszMkOldDocuments, rgpszMkNewDocuments, null);
    public int OnAfterSccStatusChanged(int cProjects, int cFiles, IVsProject[]? rgpProjects, int[]? rgFirstIndices, string[]? rgpszMkDocuments, uint[]? rgFlags) => VSConstants.S_OK;
    public int OnQueryAddFiles(IVsProject pProject, int cFiles, string[]? rgpszMkDocuments, VSQUERYADDFILEFLAGS[]? rgFlags, VSQUERYADDFILERESULTS[]? pSummaryResult, VSQUERYADDFILERESULTS[]? rgResults) => VSConstants.S_OK;
    public int OnQueryRenameFiles(IVsProject pProject, int cFiles, string[]? rgszMkOldDocuments, string[]? rgszMkNewDocuments, VSQUERYRENAMEFILEFLAGS[]? rgFlags, VSQUERYRENAMEFILERESULTS[]? pSummaryResult, VSQUERYRENAMEFILERESULTS[]? rgResults) => VSConstants.S_OK;
    public int OnQueryRenameDirectories(IVsProject pProject, int cDirs, string[]? rgszMkOldDocuments, string[]? rgszMkNewDocuments, VSQUERYRENAMEDIRECTORYFLAGS[]? rgFlags, VSQUERYRENAMEDIRECTORYRESULTS[]? pSummaryResult, VSQUERYRENAMEDIRECTORYRESULTS[]? rgResults) => VSConstants.S_OK;
    public int OnQueryAddDirectories(IVsProject pProject, int cDirectories, string[]? rgpszMkDocuments, VSQUERYADDDIRECTORYFLAGS[]? rgFlags, VSQUERYADDDIRECTORYRESULTS[]? pSummaryResult, VSQUERYADDDIRECTORYRESULTS[]? rgResults) => VSConstants.S_OK;
    public int OnBeforeAddFiles(IVsProject pProject, int cFiles, string[]? rgpszMkDocuments, VSQUERYADDFILEFLAGS[]? rgFlags, VSQUERYADDFILERESULTS[]? pSummaryResult, VSQUERYADDFILERESULTS[]? rgResults) => VSConstants.S_OK;
    public int OnBeforeRemoveFiles(IVsProject pProject, int cFiles, string[]? rgpszMkDocuments, VSQUERYREMOVEFILEFLAGS[]? rgFlags, VSQUERYREMOVEFILERESULTS[]? pSummaryResult, VSQUERYREMOVEFILERESULTS[]? rgResults) => VSConstants.S_OK;
    public int OnQueryRemoveFiles(IVsProject pProject, int cFiles, string[]? rgpszMkDocuments, VSQUERYREMOVEFILEFLAGS[]? rgFlags, VSQUERYREMOVEFILERESULTS[]? pSummaryResult, VSQUERYREMOVEFILERESULTS[]? rgResults) => VSConstants.S_OK;
    public int OnQueryRemoveDirectories(IVsProject pProject, int cDirectories, string[]? rgpszMkDocuments, VSQUERYREMOVEDIRECTORYFLAGS[]? rgFlags, VSQUERYREMOVEDIRECTORYRESULTS[]? pSummaryResult, VSQUERYREMOVEDIRECTORYRESULTS[]? rgResults) => VSConstants.S_OK;

    private void NotifyIfAnyResx(string[]? paths)
    {
        if (paths == null)
            return;
        foreach (var path in paths)
        {
            if (ResxFileNames.IsResxFile(path))
            {
                _onResxChanged();
                return;
            }
            if (UsagePaths.IsUsageSourcePath(path))
                _onSourceFileChanged?.Invoke(path);
        }
    }
}
