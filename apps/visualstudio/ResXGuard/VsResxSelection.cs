using System;
using System.Runtime.InteropServices;
using EnvDTE;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using ResXGuard.Core;

namespace ResXGuard;

internal static class VsResxSelection
{
    public static bool TryGetSelectedResxPath(out string path)
    {
        ThreadHelper.ThrowIfNotOnUIThread();

        if (TryGetFromMonitorSelection(out path))
            return true;

        return TryGetFromDte(out path);
    }

    private static bool TryGetFromMonitorSelection(out string path)
    {
        path = string.Empty;
        if (Package.GetGlobalService(typeof(SVsShellMonitorSelection)) is not IVsMonitorSelection monitorSelection)
            return false;

        IntPtr hierarchyPtr = IntPtr.Zero;
        uint itemId;
        IVsMultiItemSelect? multiSelect;
        IntPtr selectionContainer;

        var hr = monitorSelection.GetCurrentSelection(out hierarchyPtr, out itemId, out multiSelect, out selectionContainer);
        if (!ErrorHandler.Succeeded(hr) || hierarchyPtr == IntPtr.Zero)
            return false;

        if (itemId == VSConstants.VSITEMID_NIL || itemId == VSConstants.VSITEMID_ROOT)
        {
            Marshal.Release(hierarchyPtr);
            return false;
        }

        try
        {
            if (Marshal.GetObjectForIUnknown(hierarchyPtr) is not IVsHierarchy hierarchy)
                return false;

            return TryGetPath(hierarchy, itemId, out path);
        }
        finally
        {
            Marshal.Release(hierarchyPtr);
        }
    }

    private static bool TryGetPath(IVsHierarchy hierarchy, uint itemId, out string path)
    {
        path = string.Empty;

        if (hierarchy.GetCanonicalName(itemId, out var canonical) == VSConstants.S_OK && ResxFileNames.IsResxFile(canonical))
        {
            path = canonical;
            return true;
        }

        if (ErrorHandler.Succeeded(hierarchy.GetProperty(itemId, (int)__VSHPROPID.VSHPROPID_Name, out var nameObj))
            && nameObj is string name
            && ResxFileNames.IsResxFile(name))
        {
            path = hierarchy.GetCanonicalName(itemId, out canonical) == VSConstants.S_OK && !string.IsNullOrEmpty(canonical)
                ? canonical
                : name;
            return true;
        }

        return false;
    }

    private static bool TryGetFromDte(out string path)
    {
        path = string.Empty;
        if (Package.GetGlobalService(typeof(DTE)) is not DTE dte || dte.SelectedItems == null)
            return false;

        foreach (SelectedItem item in dte.SelectedItems)
        {
            try
            {
                if (item.ProjectItem == null)
                    continue;

                if (item.ProjectItem.FileCount > 0)
                {
                    var file = item.ProjectItem.FileNames[0];
                    if (ResxFileNames.IsResxFile(file))
                    {
                        path = file;
                        return true;
                    }
                }

                if (ResxFileNames.IsResxFile(item.ProjectItem.Name))
                {
                    path = item.ProjectItem.FileCount > 0 ? item.ProjectItem.FileNames[0] : item.ProjectItem.Name;
                    return true;
                }
            }
            catch (COMException)
            {
                // Ignore stale selection entries.
            }
        }

        return false;
    }
}
